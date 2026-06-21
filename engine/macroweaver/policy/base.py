"""The Agent Decision interface — ClaudePolicy (live) and ReplayPolicy (offline) live behind this."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..market.base import Decision, MarketObservation  # re-exported for callers

__all__ = ["Decision", "DecisionPolicy"]


class DecisionPolicy(ABC):
    """One method. Implementations: ClaudePolicy (live LLM), ReplayPolicy (replay a recorded trace)."""

    deterministic: bool = True

    @abstractmethod
    def decide(
        self,
        agent_id: str,
        market_id: str,
        obs: MarketObservation,
        memory: dict,
        profile: dict,
        persona: str,
        round_no: int,
        rng,
        decision_schema,
        parse_decision,
        system_prompt: str = "",
    ) -> Decision:
        ...
