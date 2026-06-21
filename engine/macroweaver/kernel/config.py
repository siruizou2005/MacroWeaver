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
    policy: str = "deterministic"           # "deterministic" | "claude"
    profile: dict = Field(default_factory=dict)        # cost/quality | demographics | biases
    initial_state: dict = Field(default_factory=dict)  # starting private state
    memory: str = "notepad"                 # "notepad" | "pool" | "bdi"
    reflection: str = "insight"             # "insight" | "quarterly" | "bdi"


class MarketConfig(BaseModel):
    """THE swappable block."""

    type: str                               # "fish_calvano" | "econagent" | "clob"
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


class Config(BaseModel):
    seed: int = 0
    rounds: int = 48                        # Fish T=48
    run_name: str = "run"

    market: MarketConfig
    cohorts: list[CohortConfig] = Field(default_factory=list)
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
