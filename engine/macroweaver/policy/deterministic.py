"""DeterministicPolicy — a pure (obs, memory, profile, rng)→Decision heuristic per market.

Needs no API key and is byte-exact reproducible, so it produces the "golden trace" the
design demos. Market-specific heuristic logic lives WITH each market (Market.heuristic),
so this class is a thin dispatcher; the kernel can run a whole simulation with zero LLM
calls and still reproduce the qualitative result (e.g. Fish collusion 1.47→1.92).
"""

from __future__ import annotations

from ..market.base import AgentAction, Market, MarketObservation
from .base import Decision, DecisionPolicy


class DeterministicPolicy(DecisionPolicy):
    deterministic = True

    def __init__(self, market: Market):
        self.market = market

    def decide(
        self, agent_id, market_id, obs, memory, profile, persona, round_no, rng,
        decision_schema, parse_decision,
    ) -> Decision:
        return self.market.heuristic(agent_id, obs, memory, profile, persona, round_no, rng)
