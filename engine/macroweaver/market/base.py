"""The Market plugin interface — the ONLY swappable block in the five-primitive kernel.

The kernel (kernel/runner.py) owns the rng, clock, event ids and recorder; it talks to a
Market only through this narrow ABC. All numeric market state is plugin-owned and opaque
to the kernel. A Market `settle()` must be a pure function of (actions, state, rng) so the
deterministic golden trace is byte-exact reproducible.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel


@dataclass
class AgentAction:
    """What one agent's Decision step produced, market-typed."""

    agent_id: str
    kind: str                       # "set_price" | "propensity" | "place_order" | "hold"
    payload: dict = field(default_factory=dict)
    # fish: {price}; econ: {work, consume}; clob: {orders:[...]}


@dataclass
class Outcome:
    """Per-agent settlement result for one round."""

    agent_id: str
    realized: dict = field(default_factory=dict)
    # fish: {qty, profit}; econ: {income, consumption, tax}; clob: {fills, cash, holdings}
    description: str = ""
    # optional human-facing one-line summary of this outcome (the "result" of the Q&A record,
    # fed into the agent's memory for the next round). Empty by default; set by the runner via
    # Market.describe_outcome() only when record_qa is on, or by a market inside settle().


@dataclass
class MarketObservation:
    """What Perception builds FROM the market for one agent (never ground truth)."""

    public: dict = field(default_factory=dict)   # fish: rival prices; econ: macro; clob: book+tape
    private: dict = field(default_factory=dict)   # the agent's own private-state slice


@dataclass
class AgentSpec:
    """Minimal description the Market needs to initialise an agent in its world.

    `profile`/`initial_state` come from the cohort (or a per-agent override). The optional
    `persona`/`policy`/`memory`/`reflection` resolve the agent's pipeline (cohort defaults when
    None), and `traits` lets an explicitly-defined agent carry market-domain trait values
    (e.g. econ skill/name/age/job) so init_world can use them instead of sampling."""

    agent_id: str
    cohort_id: str
    profile: dict = field(default_factory=dict)
    initial_state: dict = field(default_factory=dict)
    persona: str | None = None
    system_prompt: str | None = None
    policy: str | None = None
    memory: str | None = None
    reflection: str | None = None
    traits: dict = field(default_factory=dict)


@dataclass
class Decision:
    """A policy's output: the action plus the belief/reasoning that justify it.

    Defined here (next to AgentAction) so DecisionPolicy implementations can return it
    without a circular import between the market and policy packages.
    """

    action: "AgentAction"
    beliefs: dict = field(default_factory=dict)
    reasoning: str = ""


class Market(ABC):
    id: str = "base"
    granularity: str = "round"      # default scheduler clock unit

    @abstractmethod
    def init_world(self, params: dict, agents: list[AgentSpec], rng) -> dict:
        """Build and return the opaque market state dict."""

    @abstractmethod
    def build_observation(self, state: dict, agent_id: str, round_no: int) -> MarketObservation:
        ...

    @abstractmethod
    def settle(
        self, actions: list[AgentAction], state: dict, round_no: int, rng
    ) -> tuple[list[Outcome], dict]:
        """actions → (per-agent outcomes, next_state). Pure given (actions, state, rng)."""

    @abstractmethod
    def public_series(self, state: dict, outcomes: list[Outcome], round_no: int) -> dict:
        """Recorder/chart hook: mean_price, inflation, last_trade, etc."""

    @abstractmethod
    def benchmarks(self, params: dict) -> dict:
        """Static reference lines: fish→{bertrand,monopoly}; econ→{target_inflation}; clob→{}."""

    @abstractmethod
    def decision_schema(self) -> type[BaseModel]:
        """The pydantic model ClaudePolicy forces (tool input_schema) for THIS market."""

    @abstractmethod
    def parse_decision(self, raw: dict, agent_id: str) -> AgentAction:
        """Turn a validated decision dict into a market-typed AgentAction."""

    def apply_shock(self, state: dict, kind: str, magnitude: float) -> dict:
        """Optional shock injection (COVID-style cost jump, demand shock, news event).
        Default: no-op. Markets override to react. Returns the (possibly new) state."""
        return state

    # --- optional hooks (markets may override) ---
    def describe_outcome(self, outcome: "Outcome", state: dict, round_no: int) -> str:
        """A one-line, human-facing summary of one agent's round outcome — the "result" half of
        the generic Q&A record, and what gets written into the agent's memory for next round.
        Honors an outcome.description a market set inside settle(); otherwise falls back to a
        deterministic canonical-JSON dump of realized. Markets may override for nicer prose."""
        if outcome.description:
            return outcome.description
        import json
        return "Outcome: " + json.dumps(
            outcome.realized, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

    def news_text(self, state: dict, round_no: int) -> str:
        """A one-line, human-facing news/observation string for the round (drives the UI)."""
        return ""

    def agent_public(self, state: dict, agent_id: str) -> dict:
        """Per-agent static facts for the trace 'agents' list (cost, persona-derived, ...)."""
        return {}


MARKET_REGISTRY: dict[str, type[Market]] = {}


def register(market_id: str):
    def deco(cls: type[Market]):
        cls.id = market_id
        MARKET_REGISTRY[market_id] = cls
        return cls
    return deco


def get_market(market_id: str) -> Market:
    if market_id not in MARKET_REGISTRY:
        # registry miss → try loading a user-authored mechanism (AST-gated) from MW_MECHANISMS_DIR.
        # built-in markets are pre-registered via market/__init__.py, so this never runs for them.
        from .loader import load_user_mechanism  # lazy import avoids an import cycle
        try:
            load_user_mechanism(market_id)
        except Exception as e:  # noqa: BLE001 — surface gate/syntax/ABC errors to the caller (UI)
            raise KeyError(f"mechanism '{market_id}' failed to load: {e}") from e
    if market_id not in MARKET_REGISTRY:
        raise KeyError(f"unknown market '{market_id}'. registered: {sorted(MARKET_REGISTRY)}")
    return MARKET_REGISTRY[market_id]()
