"""Agent reflection — produces an 'insight' that is folded back into memory.

  insight   : Fish — update the running insight after every round
  quarterly : EconAgent — reflect once per quarter (scheduler boundary)
  bdi       : CLOB — re-derive the belief from recent outcomes

In deterministic mode these are short templated strings (so golden traces are stable);
in Claude mode the policy itself already writes richer beliefs/reasoning each round, and
reflection just summarises trend direction.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class Reflection(ABC):
    def __init__(self, every: int = 1):
        self.every = max(1, every)

    def due(self, round_no: int) -> bool:
        return round_no % self.every == 0

    @abstractmethod
    def update(self, memory, private_state: dict) -> str: ...


def _trend(values: list[float]) -> str:
    if len(values) < 2:
        return "flat"
    d = values[-1] - values[0]
    if d > 1e-6:
        return "rising"
    if d < -1e-6:
        return "falling"
    return "flat"


class InsightUpdate(Reflection):
    def update(self, memory, private_state: dict) -> str:
        prices = [h.get("price") for h in getattr(memory, "history", []) if h.get("price") is not None]
        if not prices:
            return ""
        return f"prices {_trend(prices)}; margins {'improving' if _trend(prices)=='rising' else 'thin'}"


class QuarterlyReflection(Reflection):
    def __init__(self, every: int = 4):
        super().__init__(every)

    def update(self, memory, private_state: dict) -> str:
        pool = getattr(memory, "pool", [])
        inc = [p.get("income", 0.0) for p in pool]
        if not inc:
            return ""
        return f"income {_trend(inc)} this quarter; adjusting work/consumption"


class BDIUpdate(Reflection):
    def update(self, memory, private_state: dict) -> str:
        hist = getattr(memory, "history", [])
        pnl = [h.get("pnl", h.get("profit", 0.0)) for h in hist]
        return f"recent P&L {_trend(pnl)}; {'holding conviction' if _trend(pnl)!='falling' else 'cutting risk'}"


def make_reflection(kind: str, every: int) -> Reflection:
    if kind == "quarterly":
        return QuarterlyReflection(every)
    if kind == "bdi":
        return BDIUpdate(every)
    return InsightUpdate(every)
