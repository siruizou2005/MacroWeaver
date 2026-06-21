"""The per-agent pipeline: Profile → Perception → Memory+Reflection → Decision → action.

This is the generalized agent that the design's "internal pipeline" drawer visualizes.
Heterogeneity lives entirely in (profile, private_state, memory kind, reflection kind,
policy) — the kernel and the Market are agnostic to it.
"""

from __future__ import annotations

from ..market.base import MarketObservation, Outcome
from ..policy.base import Decision, DecisionPolicy
from .memory import Memory
from .reflection import Reflection


class AgentPipeline:
    def __init__(
        self,
        agent_id: str,
        cohort_id: str,
        persona: str,
        profile: dict,
        private_state: dict,
        memory: Memory,
        reflection: Reflection,
        policy: DecisionPolicy,
        market,
        rng,
    ):
        self.agent_id = agent_id
        self.cohort_id = cohort_id
        self.persona = persona
        self.profile = dict(profile)
        self.private_state = dict(private_state)
        self.memory = memory
        self.reflection = reflection
        self.policy = policy
        self.market = market
        self.rng = rng
        self.last_decision: Decision | None = None

    # --- Perception: fold the agent's own private state into the market observation ---
    def perceive(self, obs: MarketObservation) -> MarketObservation:
        merged = dict(obs.private)
        merged.update(self.private_state)
        return MarketObservation(public=obs.public, private=merged)

    # --- Decision ---
    def decide(self, obs: MarketObservation, round_no: int) -> Decision:
        perceived = self.perceive(obs)
        mem = self.memory.recall(round_no)
        decision = self.policy.decide(
            agent_id=self.agent_id,
            market_id=self.market.id,
            obs=perceived,
            memory=mem,
            profile=self.profile,
            persona=self.persona,
            round_no=round_no,
            rng=self.rng,
            decision_schema=self.market.decision_schema(),
            parse_decision=self.market.parse_decision,
        )
        self.last_decision = decision
        return decision

    # --- write-back: apply outcome, store memory, reflect on a boundary ---
    def reflect(self, outcome: Outcome, round_no: int, reflect_now: bool) -> None:
        # apply realized outcome to private state (additive numeric fields)
        for k, v in outcome.realized.items():
            if isinstance(v, (int, float)):
                self.private_state[k] = v
        self.memory.store(round_no, outcome, self.last_decision)
        if reflect_now and self.reflection.due(round_no):
            insight = self.reflection.update(self.memory, self.private_state)
            if insight:
                self.memory.add_insight(insight)
