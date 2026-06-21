"""Agent memory — three column-mapped implementations behind one ABC.

  notepad : Fish — free-text plans + accumulated insights (a running notepad)
  pool    : EconAgent — a bounded L-round pool of recent observations
  bdi     : CLOB/TwinMarket — Belief-Desire-Intention slots updated each round
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class Memory(ABC):
    @abstractmethod
    def recall(self, round_no: int) -> dict: ...

    @abstractmethod
    def store(self, round_no: int, outcome, decision) -> None: ...

    def add_insight(self, insight: str) -> None: ...


class NotepadMemory(Memory):
    def __init__(self, window: int = 100):
        # Fish: the prompt shows the last 100 rounds of market history (my price, competitor's
        # price, my quantity, my profit) plus the running PLANS.txt / INSIGHTS.txt files.
        self.window = window
        self.plans: str = ""
        self.insights: str = ""
        self.history: list[dict] = []   # [{round, price, rival_price, qty, profit}]

    def recall(self, round_no: int) -> dict:
        return {
            "plans": self.plans,
            "insights": self.insights,
            "history": self.history[-self.window:],
        }

    def store(self, round_no: int, outcome, decision) -> None:
        # keep the realized (posted, clamped) price + the rival's price from the outcome
        rec = {"round": round_no}
        rec.update(outcome.realized if outcome else {})
        if decision is not None:
            self.plans = decision.beliefs.get("plans", self.plans) or self.plans
            ins = decision.beliefs.get("insights")
            if ins:                                  # LLM rewrites INSIGHTS.txt each round (overwrite)
                self.insights = ins
        self.history.append(rec)

    def add_insight(self, insight: str) -> None:
        # reflection-supplied insight (deterministic mode); LLM mode uses reflection="none"
        if insight:
            self.insights = (self.insights + " " + insight).strip()[-1200:]


class MemoryPool(Memory):
    """Bounded L-round pool (EconAgent style)."""

    def __init__(self, length: int = 12):
        self.length = length
        self.pool: list[dict] = []
        self.insights: str = ""

    def recall(self, round_no: int) -> dict:
        return {"pool": self.pool[-self.length:], "insights": self.insights}

    def store(self, round_no: int, outcome, decision) -> None:
        rec = {"round": round_no}
        rec.update(outcome.realized if outcome else {})
        self.pool.append(rec)
        if len(self.pool) > self.length * 4:
            self.pool = self.pool[-self.length * 2:]

    def add_insight(self, insight: str) -> None:
        if insight:
            self.insights = insight


class BDIMemory(Memory):
    """Belief-Desire-Intention slots (TwinMarket style)."""

    def __init__(self):
        self.belief: str = ""
        self.desire: str = ""
        self.intention: str = ""
        self.history: list[dict] = []

    def recall(self, round_no: int) -> dict:
        return {
            "belief": self.belief,
            "desire": self.desire,
            "intention": self.intention,
            "history": self.history[-6:],
        }

    def store(self, round_no: int, outcome, decision) -> None:
        rec = {"round": round_no}
        rec.update(outcome.realized if outcome else {})
        self.history.append(rec)
        if decision is not None:
            self.belief = decision.beliefs.get("belief", self.belief) or self.belief
            self.intention = decision.beliefs.get("intention", self.intention) or self.intention

    def add_insight(self, insight: str) -> None:
        if insight:
            self.belief = insight


def make_memory(kind: str) -> Memory:
    return {
        "notepad": NotepadMemory,
        "pool": MemoryPool,
        "bdi": BDIMemory,
    }.get(kind, NotepadMemory)()
