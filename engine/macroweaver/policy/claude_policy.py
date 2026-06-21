"""ClaudePolicy — live LLM agents via Anthropic Claude (structured output, cache, retries).

Ports the proven scaffolding from the prediction-market GeminiProvider (eval/provider.py)
to Anthropic: forced tool-use for schema-valid JSON, an on-disk response cache keyed by a
hash of (model, system, user, key) so re-runs are free and reproducible, exponential
backoff on transient/rate-limit errors, and a pacing beat between calls. On any failure
(refusal, parse, network-after-retries) the agent simply HOLDS that round — the same
isolation contract as the reference LLM agent, so one bad call never kills the run.

Requires `pip install -e '.[llm]'` and ANTHROPIC_API_KEY in engine/.env (or the env).
Deterministic golden runs never touch this file.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

from ..market.base import AgentAction, Decision, Market, MarketObservation
from .base import DecisionPolicy

_CACHE_DIR = Path(__file__).resolve().parents[2] / ".mw_cache" / "claude"

_SYSTEM = {
    "fish_calvano": (
        "You are an autonomous pricing manager for one firm competing on a market with logit "
        "demand. Each round you set your price to maximize your firm's long-run profit, observing "
        "your rivals' recent prices and your own profit history. You cannot communicate with rivals."
    ),
    "econagent": (
        "You are an autonomous household in a macro economy. Each round you choose how much to work "
        "and how much to consume (each a fraction 0..1), reacting to prices, wages, taxes and your "
        "wealth, to maximize your long-run well-being."
    ),
}


def _is_transient(msg: str) -> bool:
    m = msg.lower()
    return any(s in m for s in ("rate limit", "429", "overloaded", "529", "timeout", "503", "502", "500", "connection"))


def _load_env() -> None:
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    except Exception:
        pass


class ClaudePolicy(DecisionPolicy):
    deterministic = False

    def __init__(self, market: Market, policy_cfg=None):
        _load_env()
        import anthropic  # raised here if not installed → CLI falls back to deterministic

        if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
            # no credentials → raise so the policy factory falls back to the deterministic
            # heuristic (the demo still produces the collusion curve, just without live LLMs)
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        self.market = market
        self.model = (policy_cfg.model if policy_cfg else None) or os.environ.get("MW_MODEL", "claude-opus-4-8")
        self.use_cache = policy_cfg.use_cache if policy_cfg else True
        # temperature is forwarded only when set AND the model supports sampling params
        # (Haiku 4.5 accepts 0..1; Opus 4.7/4.8 reject it — leave it None there).
        self.temperature = getattr(policy_cfg, "temperature", None) if policy_cfg else None
        self.max_retries = 5
        self.pace = 0.2
        self.client = anthropic.Anthropic()
        self._tool_schema = market.decision_schema().model_json_schema()
        self._system = _SYSTEM.get(market.id, "You are an autonomous economic agent. Maximize your objective.")
        # a market may supply a faithful, paper-specific prompt (prefix=system, the rest=user)
        self._use_mkt_prompt = hasattr(market, "prompt_system") and hasattr(market, "prompt_user")
        # optional GLOBAL user-message override (authored in the console "Question" node): when set,
        # the rendered template REPLACES the market/default user prompt. Blank → market default. The
        # system prompt is never affected.
        self.question_template = (getattr(policy_cfg, "question_template", None) or "") if policy_cfg else ""

    # ---- cache ----
    def _cache_path(self, system: str, user: str, key: str) -> Path:
        h = hashlib.sha256(json.dumps([self.model, system, user, key], ensure_ascii=False).encode()).hexdigest()[:32]
        return _CACHE_DIR / f"{h}.json"

    def _user_prompt(self, obs: MarketObservation, memory: dict, profile: dict, persona: str, round_no: int) -> str:
        payload = {
            "round": round_no,
            "your_persona": persona,
            "your_profile": profile,
            "market_observation": obs.public,
            "your_private_state": obs.private,
            "your_memory": memory,
        }
        return (
            "Here is your situation this round (JSON):\n"
            + json.dumps(payload, ensure_ascii=False, indent=2)
            + "\n\nCall submit_decision with your action for this round. Keep the reasoning to one sentence."
        )

    def _render_template(self, obs: MarketObservation, memory: dict, profile: dict, persona: str, round_no: int) -> str:
        """Fill the global question_template's {placeholders} from this agent's per-round state.
        Available: {round} {persona} {profile}, {observation}/{private_state}/{memory} (json blobs),
        and every public+private observation field at top level. Non-scalars render as JSON.
        Unknown {placeholders} and literal braces are left untouched (no crash on stray '{')."""
        def render(v) -> str:
            if v is None:
                return ""
            if isinstance(v, (str, int, float, bool)):
                return str(v)
            return json.dumps(v, ensure_ascii=False)
        subs: dict = {
            "round": str(round_no), "persona": persona or "", "profile": render(profile),
            "observation": render(obs.public), "private_state": render(obs.private), "memory": render(memory),
        }
        for k, v in {**(obs.public or {}), **(obs.private or {})}.items():
            subs.setdefault(str(k), render(v))
        return re.sub(r"\{(\w+)\}", lambda m: subs[m.group(1)] if m.group(1) in subs else m.group(0), self.question_template)

    def decide(self, agent_id, market_id, obs, memory, profile, persona, round_no, rng,
               decision_schema, parse_decision, system_prompt="") -> Decision:
        if self._use_mkt_prompt:
            system = self.market.prompt_system(persona, profile)
            user = self.market.prompt_user(obs, memory, round_no)
        else:
            system = self._system
            user = self._user_prompt(obs, memory, profile, persona, round_no)
        if system_prompt:                 # per-agent override wins over the market/default system prompt
            system = system_prompt
        if self.question_template:        # global user-authored question replaces the user turn
            user = self._render_template(obs, memory, profile, persona, round_no)
        key = f"{agent_id}:{round_no}"
        raw = self._complete(system, user, key)
        if raw is None:
            return Decision(action=AgentAction(agent_id, "hold", {}), beliefs={}, reasoning="(held — model unavailable)")
        try:
            action = parse_decision(raw, agent_id)
        except Exception as e:  # noqa: BLE001
            return Decision(action=AgentAction(agent_id, "hold", {}), beliefs={}, reasoning=f"(held — parse error: {e})")
        # the paper's template returns observations/plans/insights/price; surface observations as
        # the reasoning note and keep plans+insights in beliefs so NotepadMemory writes them back.
        reasoning = str(raw.get("observations") or raw.get("reasoning", ""))[:500]
        beliefs = {k: v for k, v in raw.items() if k not in ("observations", "reasoning")}
        return Decision(action=action, beliefs=beliefs, reasoning=reasoning)

    def _complete(self, system: str, user: str, key: str) -> dict | None:
        cache_file = self._cache_path(system, user, key)
        if self.use_cache and cache_file.exists():
            try:
                return json.loads(cache_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        tool = {
            "name": "submit_decision",
            "description": "Submit your structured decision for this round.",
            "input_schema": self._tool_schema,
        }
        transient_tries = 0
        while True:
            if self.pace:
                time.sleep(self.pace)
            try:
                kwargs = dict(
                    model=self.model,
                    max_tokens=2048,
                    system=system,
                    messages=[{"role": "user", "content": user}],
                    tools=[tool],
                    tool_choice={"type": "tool", "name": "submit_decision"},
                )
                if self.temperature is not None:
                    kwargs["temperature"] = self.temperature
                resp = self.client.messages.create(**kwargs)
            except Exception as e:  # noqa: BLE001
                msg = str(e)
                if _is_transient(msg) and transient_tries < self.max_retries:
                    transient_tries += 1
                    time.sleep(2.0 ** transient_tries)
                    continue
                print(f"[claude] {key}: hard error: {msg}", file=sys.stderr, flush=True)
                return None

            raw = None
            for block in resp.content:
                if getattr(block, "type", None) == "tool_use" and getattr(block, "name", "") == "submit_decision":
                    raw = block.input
                    break
            if raw is None:  # refusal or no tool call
                print(f"[claude] {key}: no tool_use (stop={getattr(resp,'stop_reason',None)})", file=sys.stderr, flush=True)
                return None
            if self.use_cache:
                _CACHE_DIR.mkdir(parents=True, exist_ok=True)
                cache_file.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
            return raw
