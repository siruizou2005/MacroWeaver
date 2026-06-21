"""ReplayPolicy — replay an agent's recorded decisions from a trace, no LLM, no heuristic.

This is the offline / no-API-key path: record a run once (with live LLM, or any policy), then
replay its `trace.json` forever. For each (agent_id, round) it returns the recorded action,
beliefs and reasoning verbatim; the kernel re-runs `market.settle()` with the same seed, so the
whole event stream regenerates byte-for-byte. It is preset-agnostic — it reads only the generic
`action / beliefs / reasoning` frame keys every market records.

Note: it reconstructs the AgentAction DIRECTLY from the recorded `action` payload (which is
already `decision.action.payload`); it does NOT route it back through `market.parse_decision`,
because parse_decision expects raw LLM keys (e.g. econ's "consumption") while the recorded
payload holds the parsed keys (e.g. "consume"). Every market's settle() reads `payload.get(...)`
and ignores the action `kind`, so a generic "replay" kind is safe.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..market.base import AgentAction, Decision, Market
from .base import DecisionPolicy


def load_trace(path: str) -> dict:
    """Load a trace.json for replay. Absolute paths are used as-is; relative paths are tried
    against the CWD then the repo root (so presets can use `traces/golden/<x>.trace.json`)."""
    p = Path(path)
    if not p.is_absolute() and not p.exists():
        repo_root = Path(__file__).resolve().parents[3]   # …/policy/replay.py → project
        for cand in (Path.cwd() / path, repo_root / path):
            if cand.exists():
                p = cand
                break
    return json.loads(p.read_text(encoding="utf-8"))


class ReplayPolicy(DecisionPolicy):
    deterministic = True

    def __init__(self, market: Market, trace: dict):
        self.market = market
        # index (agent_id, round) -> recorded frame
        self._by: dict[tuple[str, int], dict] = {}
        for rnd in trace.get("rounds", []) or []:
            r = rnd.get("round")
            for a in rnd.get("agents", []) or []:
                self._by[(a.get("id"), r)] = a

    def decide(
        self, agent_id, market_id, obs, memory, profile, persona, round_no, rng,
        decision_schema, parse_decision, system_prompt="",
    ) -> Decision:
        frame = self._by.get((agent_id, round_no))
        if frame is None:
            # an incomplete trace — hold this round rather than crash the replay
            return Decision(action=AgentAction(agent_id, "hold", {}), beliefs={},
                            reasoning="(held — no recorded decision)")
        return Decision(
            action=AgentAction(agent_id, "replay", dict(frame.get("action") or {})),
            beliefs=dict(frame.get("beliefs") or {}),
            reasoning=str(frame.get("reasoning") or ""),
        )
