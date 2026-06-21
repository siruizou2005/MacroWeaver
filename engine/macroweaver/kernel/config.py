"""Extended pydantic Config — the contract between React ↔ Node ↔ Python.

Generalizes the prediction-market `Config` (market_sim/runner/config.py). The single
`markets[]` list is replaced by ONE swappable `market` block plus heterogeneous agent
`cohorts` plus optional `layers`. `Config.model_json_schema()` is exported to
shared/config.schema.json and drives the React Inspector + Node zod validation.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, Field


class CohortConfig(BaseModel):
    """A group of homogeneous agents — the design's cohorts[{id,name,n,persona}]."""

    id: str
    name: str
    n: int = 1
    persona: str = ""                       # natural-language persona for the LLM system prompt
    system_prompt: str = ""                 # optional system-prompt override (empty → market default)
    policy: str = "replay"                  # "claude" (live LLM) | "replay" (offline; needs replay_trace_path)
    profile: dict = Field(default_factory=dict)        # cost/quality | demographics | biases
    initial_state: dict = Field(default_factory=dict)  # starting private state
    memory: str = "notepad"                 # "notepad" | "pool" | "bdi"
    reflection: str = "insight"             # "insight" | "quarterly" | "bdi"


class AgentDef(BaseModel):
    """One explicitly-defined individual agent (the materialised-roster authoring layer).

    When `Config.agents` is set it is the authoritative roster: each entry is one agent, with
    `cohort` naming the archetype it was generated from (used for any unset defaults). Unset
    persona/policy/memory/reflection fall back to that archetype cohort; `traits` carries the
    agent's market-domain trait values (e.g. econ skill/name/age/job) so the market uses them
    instead of sampling. This keeps cohort-only presets (no `agents`) byte-exact."""

    id: str
    cohort: str = ""                        # archetype id (for defaults / which generator made it)
    n: int = 1                              # ×N byte-identical clones (replicated as id#0..n-1)
    persona: str | None = None
    system_prompt: str | None = None        # per-agent system-prompt override (None → cohort/market default)
    policy: str | None = None
    memory: str | None = None
    reflection: str | None = None
    profile: dict = Field(default_factory=dict)
    initial_state: dict = Field(default_factory=dict)
    traits: dict = Field(default_factory=dict)


class MarketConfig(BaseModel):
    """THE swappable block."""

    type: str                               # "fish_calvano" | "econagent"
    params: dict = Field(default_factory=dict)


class LayerConfig(BaseModel):
    observation: bool = True
    institution_fiscal: bool = False
    institution_monetary: bool = False
    production: bool = False
    social: bool = False
    news: bool = True
    shock: dict | None = None               # {round, kind, magnitude}


class SchedulerConfig(BaseModel):
    granularity: str = "round"              # "round" | "month" | "quarter" | "session"
    reflect_every: int = 4                  # reflection cadence in rounds


class PolicyConfig(BaseModel):
    model: str = "claude-opus-4-8"
    temperature: float | None = None        # omitted on opus-4-8 (sampling params unsupported)
    use_cache: bool = True
    max_concurrency: int = 5
    # GLOBAL user-message template posed to each LLM agent every round. {placeholders} are filled
    # from that agent's per-round state (round/persona + every observation field + json blobs).
    # When set it REPLACES the market's built-in user prompt; blank/None → market default unchanged.
    question_template: str | None = None


class Config(BaseModel):
    seed: int = 0
    rounds: int = 48                        # Fish T=48
    run_name: str = "run"
    # offline / no-API-key path: replay a previously recorded trace's decisions instead of
    # calling an LLM. The path is absolute or relative to the repo root (e.g. a golden trace).
    replay_trace_path: str | None = None

    market: MarketConfig
    cohorts: list[CohortConfig] = Field(default_factory=list)
    # optional explicit per-agent roster (materialised from cohorts, then editable). When set it
    # is authoritative; cohorts remain as archetypes for defaults. Absent → cohort flattening.
    agents: list[AgentDef] | None = None
    layers: LayerConfig = Field(default_factory=LayerConfig)
    scheduler: SchedulerConfig = Field(default_factory=SchedulerConfig)
    policy: PolicyConfig = Field(default_factory=PolicyConfig)

    def agent_ids(self) -> list[str]:
        """Flatten cohorts → stable, sorted agent ids (e.g. firms_0, firms_1, ...)."""
        out: list[str] = []
        for c in self.cohorts:
            for i in range(c.n):
                out.append(f"{c.id}_{i}")
        return out

    def cohort_of(self, agent_id: str) -> CohortConfig:
        cid = agent_id.rsplit("_", 1)[0]
        for c in self.cohorts:
            if c.id == cid:
                return c
        raise KeyError(agent_id)


def load_config(path: str | Path) -> Config:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    return Config(**(data or {}))


def load_config_data(data: dict) -> Config:
    return Config(**(data or {}))
