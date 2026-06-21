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
from ..policy.deterministic import DeterministicPolicy
from .config import Config
from .events import Event
from .recorder import Recorder
from .scheduler import Scheduler
from .sinks import EventSink, ListSink


def _now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


class Runner:
    def __init__(self, config: Config, sink: EventSink | None = None,
                 policy_factory=None) -> None:
        self.config = config
        self.sink = sink if sink is not None else ListSink()
        self.round_no = 0
        self._eid = 0
        self._emit_lock = threading.Lock()

        self.market = get_market(config.market.type)
        self.scheduler = Scheduler(config.scheduler.granularity,
                                   config.scheduler.reflect_every, config.rounds)
        self.metrics = get_metrics(config.market.type)

        # --- agent specs (flattened cohorts, id-sorted for determinism) ---
        specs: list[AgentSpec] = []
        for c in config.cohorts:
            for i in range(c.n):
                specs.append(AgentSpec(f"{c.id}_{i}", c.id, dict(c.profile), dict(c.initial_state)))
        specs.sort(key=lambda s: s.agent_id)
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

        # --- build per-agent pipelines ---
        cohort_by_id = {c.id: c for c in config.cohorts}
        # policy_factory(cohort, market) -> DecisionPolicy. Default: deterministic golden.
        self.policy_factory = policy_factory or (lambda cohort, market: DeterministicPolicy(market))
        self.pipelines: dict[str, AgentPipeline] = {}
        for s in specs:
            cohort = cohort_by_id[s.cohort_id]
            self.pipelines[s.agent_id] = AgentPipeline(
                agent_id=s.agent_id,
                cohort_id=s.cohort_id,
                persona=cohort.persona,
                profile=s.profile,
                private_state=s.initial_state,
                memory=make_memory(cohort.memory),
                reflection=make_reflection(cohort.reflection, config.scheduler.reflect_every),
                policy=self.policy_factory(cohort, self.market),
                market=self.market,
                rng=agent_rng[s.agent_id],
            )
        self._all_deterministic = all(p.policy.deterministic for p in self.pipelines.values())

        # --- recorder ---
        agents_meta = []
        for s in specs:
            cohort = cohort_by_id[s.cohort_id]
            meta = {"id": s.agent_id, "cohort": s.cohort_id, "name": cohort.name,
                    "persona": cohort.persona, "policy": cohort.policy}
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
        if news:  # surface the news/info stream to the agents themselves, not just the trace
            for o in obs.values():
                o.public["news"] = news

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
            agent_frames.append(frame)
        self.recorder.record_round(r, series, news, agent_frames)

        self._emit("round_end", None, {"round": r})

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
