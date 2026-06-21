"""Policy factories. Offline (no live LLM) runs replay a recorded trace; there is no
algorithmic deterministic policy any more — record once, replay forever."""

from __future__ import annotations

from ..market.base import Decision
from .base import DecisionPolicy


class UnconfiguredPolicy(DecisionPolicy):
    """Constructs fine (so world-only commands like `roster` work) but errors the moment a
    round actually needs a decision and no live policy / replay trace was provided."""

    deterministic = True

    def decide(self, agent_id, market_id, obs, memory, profile, persona, round_no, rng,
               decision_schema, parse_decision, system_prompt="") -> Decision:
        raise RuntimeError(
            "no decision policy configured: set a cohort policy='claude' (with ANTHROPIC_API_KEY) "
            "for a live run, or set replay_trace_path to replay a recorded trace offline.")


def offline_factory(config):
    """The default factory (golden / verify / roster / tests, and the no-API-key fallback):
    replay a recorded trace when replay_trace_path is set, else a policy that errors clearly
    if a round is actually run."""
    if getattr(config, "replay_trace_path", None):
        from .replay import ReplayPolicy, load_trace
        trace = load_trace(config.replay_trace_path)
        return lambda cohort, market: ReplayPolicy(market, trace)
    return lambda cohort, market: UnconfiguredPolicy()
