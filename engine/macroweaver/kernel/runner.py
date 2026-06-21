"""Runner — the FIXED five-primitive kernel loop.

  Population·Agents → Mechanism(Market) → Observation → Scheduler → Recorder → write-back

Generalizes market_sim/runner/simulation.py: one np.random.SeedSequence(seed), spawned
substreams (rng[0] for kernel draws, one per agent in id-sorted order), an _emit_lock that
serializes event ids so concurrent Claude calls can't race, and a fixed per-round draw
order. The Market is the only swappable block; everything here is shared across all papers.
"""

from __future__ import annotations

import datetime as _dt
import threading
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from ..agent.memory import make_memory
from ..agent.pipeline import AgentPipeline
from ..agent.reflection import make_reflection
from ..market.base import AgentSpec, get_market
from ..metrics import get_metrics
from ..policy.factory import offline_factory
from .config import CohortConfig, Config
from .events import Event
from .recorder import Recorder
from .scheduler import Scheduler
from .sinks import EventSink, ListSink


def _now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


class Runner:
    def __init__(self, config: Config, sink: EventSink | None = None,
                 policy_factory=None, record_qa: bool = False) -> None:
        self.config = config
        self.sink = sink if sink is not None else ListSink()
        self.round_no = 0
        self._eid = 0
        self._emit_lock = threading.Lock()
        # Generic per-agent Q&A record. OFF by default so the golden event stream and trace.json
        # are byte-identical; the live console turns it on (CLI --record-qa). When on, the runner
        # sets Outcome.description, adds question/result_description to recorded frames, and emits
        # one trailing `agent_record` per agent AFTER round_end (so no event ids shift).
        self.record_qa = record_qa

        self.market = get_market(config.market.type)
        self.scheduler = Scheduler(config.scheduler.granularity,
                                   config.scheduler.reflect_every, config.rounds)
        self.metrics = get_metrics(config.market.type)

        # --- agent specs: explicit roster (config.agents) is authoritative when present, else
        #     flatten cohorts. Each spec carries its resolved pipeline fields; id-sorted. ---
        cohort_by_id = {c.id: c for c in config.cohorts}

        def _archetype(cid: str) -> CohortConfig:
            return cohort_by_id.get(cid) or CohortConfig(id=cid or "agent", name=cid or "Agent")

        pairs: list[tuple[AgentSpec, CohortConfig]] = []   # (spec, resolved-archetype cohort)
        if config.agents:
            for ad in config.agents:
                base = _archetype(ad.cohort)
                rc = CohortConfig(
                    id=base.id, name=base.name, n=1,
                    persona=ad.persona if ad.persona is not None else base.persona,
                    system_prompt=ad.system_prompt if ad.system_prompt is not None else base.system_prompt,
                    policy=ad.policy or base.policy,
                    profile={**base.profile, **ad.profile},
                    initial_state={**base.initial_state, **ad.initial_state},
                    memory=ad.memory or base.memory,
                    reflection=ad.reflection or base.reflection,
                )
                clones = max(1, int(ad.n))   # ×N byte-identical clones (same def, distinct id + rng)
                for k in range(clones):
                    aid = ad.id if clones == 1 else f"{ad.id}#{k}"
                    pairs.append((AgentSpec(aid, base.id, dict(rc.profile), dict(rc.initial_state),
                                            persona=rc.persona, system_prompt=rc.system_prompt,
                                            policy=rc.policy, memory=rc.memory,
                                            reflection=rc.reflection, traits=dict(ad.traits)), rc))
        else:
            for c in config.cohorts:
                for i in range(c.n):
                    pairs.append((AgentSpec(f"{c.id}_{i}", c.id, dict(c.profile), dict(c.initial_state),
                                            persona=c.persona, system_prompt=c.system_prompt,
                                            policy=c.policy, memory=c.memory,
                                            reflection=c.reflection), c))
        pairs.sort(key=lambda p: p[0].agent_id)
        specs: list[AgentSpec] = [s for s, _ in pairs]
        self._resolved: dict[str, CohortConfig] = {s.agent_id: rc for s, rc in pairs}
        self.agent_ids = [s.agent_id for s in specs]

        # --- seed the kernel rng + per-agent substreams ---
        root = np.random.SeedSequence(config.seed)
        children = root.spawn(1 + len(self.agent_ids))
        self.rng = np.random.default_rng(children[0])
        agent_rng = {aid: np.random.default_rng(ss)
                     for aid, ss in zip(self.agent_ids, children[1:])}

        # --- market world ---
        self.state = self.market.init_world(config.market.params, specs, self.rng)
        self.benchmarks = self.market.benchmarks(config.market.params)

        # --- build per-agent pipelines (per-spec fields; archetype cohort fills any gap) ---
        # policy_factory(cohort, market) -> DecisionPolicy. Default: replay a recorded trace if
        # replay_trace_path is set, else a policy that errors clearly when a round is run.
        self.policy_factory = policy_factory or offline_factory(config)
        self.pipelines: dict[str, AgentPipeline] = {}
        for s in specs:
            rc = self._resolved[s.agent_id]
            self.pipelines[s.agent_id] = AgentPipeline(
                agent_id=s.agent_id,
                cohort_id=s.cohort_id,
                persona=s.persona if s.persona is not None else rc.persona,
                system_prompt=s.system_prompt if s.system_prompt is not None else rc.system_prompt,
                profile=s.profile,
                private_state=s.initial_state,
                memory=make_memory(s.memory or rc.memory),
                reflection=make_reflection(s.reflection or rc.reflection, config.scheduler.reflect_every),
                policy=self.policy_factory(rc, self.market),
                market=self.market,
                rng=agent_rng[s.agent_id],
            )
        self._all_deterministic = all(p.policy.deterministic for p in self.pipelines.values())

        # --- recorder ---
        agents_meta = []
        for s in specs:
            rc = self._resolved[s.agent_id]
            meta = {"id": s.agent_id, "cohort": s.cohort_id, "name": rc.name,
                    "persona": s.persona if s.persona is not None else rc.persona, "policy": rc.policy}
            sp = s.system_prompt if s.system_prompt is not None else rc.system_prompt
            if sp:                               # only when explicitly set → golden agents block unchanged
                meta["system_prompt"] = sp
            meta.update(self.market.agent_public(self.state, s.agent_id))
            agents_meta.append(meta)
        self.recorder = Recorder(config.model_dump(), config.market.type,
                                 config.scheduler.granularity, self.benchmarks, agents_meta)

        # --- opening events ---
        self._emit("config", None, {"config": config.model_dump()})
        self._emit("benchmarks", None, dict(self.benchmarks))
        self._emit("snapshot", None, {"state": self._snapshot(0)})

    # ----- event plumbing -----
    def _emit(self, etype: str, agent_id: str | None, payload: dict, result: dict | None = None) -> Event:
        with self._emit_lock:
            ev = Event(self._eid, self.round_no, etype, agent_id, payload, result, ts=_now_iso())
            self._eid += 1
            self.sink.emit(ev)
        return ev

    def _snapshot(self, r: int) -> dict:
        return {
            "round": r,
            "market": self.config.market.type,
            "benchmarks": self.benchmarks,
            "agents": [{"id": a, **self.market.agent_public(self.state, a)} for a in self.agent_ids],
        }

    def _qa_question(self, agent_id: str) -> dict:
        """The "question" half of an agent's Q&A record: exactly what it perceived this round
        (its heterogeneous public + private observation slice) plus its memory snapshot at
        decision time. Read straight off the pipeline's last-decision snapshots."""
        p = self.pipelines[agent_id]
        perceived = p.last_perceived
        return {
            "public": dict(perceived.public) if perceived else {},
            "private": dict(perceived.private) if perceived else {},
            "memory": p.last_memory or {},
        }

    # ----- the loop -----
    def run(self, n: int | None = None) -> None:
        n = self.config.rounds if n is None else n
        for _ in range(n):
            self.step()

    def step(self) -> None:
        self.round_no += 1
        r = self.round_no
        self._emit("round_start", None, {"round": r, "label": self.scheduler.label(r)})

        # shock layer (optional): inject at the configured round
        shock = self.config.layers.shock
        if shock and int(shock.get("round", -1)) == r:
            kind = shock.get("kind", "cost_jump")
            mag = float(shock.get("magnitude", 0.1))
            self.state = self.market.apply_shock(self.state, kind, mag)
            self._emit("shock", None, {"round": r, "kind": kind, "magnitude": mag})

        # observation / news layer
        news = self.market.news_text(self.state, r) if self.config.layers.news else ""
        if news:
            self._emit("news", None, {"text": news})

        # build observations (reads only — blind submit)
        obs = {aid: self.market.build_observation(self.state, aid, r) for aid in self.agent_ids}

        # decision phase
        decisions = self._decide(obs, r)
        for aid in self.agent_ids:
            d = decisions[aid]
            self._emit("agent_decision", aid, {
                "beliefs": d.beliefs, "reasoning": d.reasoning[:300], "action": d.action.payload,
            })

        # settle (the mechanism)
        actions = [decisions[aid].action for aid in self.agent_ids]
        outcomes, new_state = self.market.settle(actions, self.state, r, self.rng)
        out_by_id = {o.agent_id: o for o in outcomes}
        # Q&A "result": describe each outcome BEFORE write-back so memory carries it into next round.
        if self.record_qa:
            for o in outcomes:
                o.description = self.market.describe_outcome(o, new_state, r)
        for aid in self.agent_ids:
            o = out_by_id.get(aid)
            if o:
                self._emit("settle", aid, dict(o.realized))

        # write-back: apply outcomes, update memory, reflect on boundary
        reflect_now = self.scheduler.reflect_now(r)
        for aid in self.agent_ids:
            o = out_by_id.get(aid)
            if o:
                self.pipelines[aid].reflect(o, r, reflect_now)
        self.state = new_state

        # series + recorder
        series = self.market.public_series(self.state, outcomes, r)
        self._emit("series", None, dict(series))
        agent_frames = []
        for aid in self.agent_ids:
            o = out_by_id.get(aid)
            d = decisions[aid]
            frame = {"id": aid}
            frame.update(self.market.agent_public(self.state, aid))
            if o:
                frame.update({k: o.realized[k] for k in ("price", "profit") if k in o.realized})
                frame["realized"] = o.realized
            frame["beliefs"] = d.beliefs
            frame["reasoning"] = d.reasoning
            frame["action"] = d.action.payload
            if self.record_qa:                       # additive Q&A keys (only when recording)
                frame["question"] = self._qa_question(aid)
                frame["result_description"] = o.description if o else ""
            agent_frames.append(frame)
        self.recorder.record_round(r, series, news, agent_frames)

        self._emit("round_end", None, {"round": r})

        # generic per-agent Q&A record — emitted AFTER round_end so it never shifts event ids in
        # the default (golden) stream. The live console reads question/result_description from here.
        if self.record_qa:
            for aid in self.agent_ids:
                o = out_by_id.get(aid)
                self._emit("agent_record", aid, {
                    "question": self._qa_question(aid),
                    "result_description": o.description if o else "",
                })

    def _decide(self, obs, r) -> dict:
        if self._all_deterministic:
            return {aid: self.pipelines[aid].decide(obs[aid], r) for aid in self.agent_ids}
        # concurrent LLM decisions — a round is blind-submit so they are independent
        out: dict = {}
        max_workers = max(1, min(self.config.policy.max_concurrency, len(self.agent_ids)))
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            futs = {ex.submit(self.pipelines[aid].decide, obs[aid], r): aid for aid in self.agent_ids}
            for fut in futs:
                aid = futs[fut]
                out[aid] = fut.result()
        return out

    # ----- finalize -----
    def finalize(self, trace_path: str) -> dict:
        metrics = self.metrics.compute(self.recorder, self.benchmarks)
        path = self.recorder.write(trace_path, metrics)
        self._emit("done", None, {"trace_path": path, "metrics": metrics})
        return metrics

    def trace(self, metrics: dict | None = None) -> dict:
        m = metrics if metrics is not None else self.metrics.compute(self.recorder, self.benchmarks)
        return self.recorder.build_trace(m)

    def roster(self) -> list[dict]:
        """Per-agent roster sampled from the initial world (no run): each agent's cohort plus its
        market-provided traits (Market.agent_public — the generic, EDSL-style trait bag). Lets the
        console show the individual, heterogeneous agents a cohort expands into."""
        out = []
        for aid in self.agent_ids:
            traits = dict(self.market.agent_public(self.state, aid))
            rc = self._resolved.get(aid)
            out.append({
                "id": aid,
                "cohort": self.pipelines[aid].cohort_id,
                "cohort_name": rc.name if rc else aid,
                "name": str(traits.get("name") or aid),
                "traits": traits,
            })
        return out
