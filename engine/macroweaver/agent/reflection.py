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


def _volatility(values: list[float]) -> float:
    """Range-over-mean — cheap volatility proxy; 0 for flat/short series."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    if abs(mean) < 1e-9:
        return 0.0
    return (max(values) - min(values)) / abs(mean)


class InsightUpdate(Reflection):
    def update(self, memory, private_state: dict) -> str:
        prices = [h.get("price") for h in getattr(memory, "history", []) if h.get("price") is not None]
        if not prices:
            return ""
        return f"prices {_trend(prices)}; margins {'improving' if _trend(prices)=='rising' else 'thin'}"


class QuarterlyReflection(Reflection):
    """Income trend alone reads the same for all six EconAgent personas (workers,
    savers, spenders, gig, retirees, students) — it ignores the very things that are
    supposed to set a high-MPC "spender" apart from a "saver", or volatile "gig" income
    from a steady wage. Derive that signal from each agent's own realized pool instead of
    hardcoding cohort names, so the differentiation emerges from behavior, not labels.
    """

    def __init__(self, every: int = 4):
        super().__init__(every)

    def update(self, memory, private_state: dict) -> str:
        pool = getattr(memory, "pool", [])
        income = [p.get("income", 0.0) for p in pool]
        if not income:
            return ""
        consumption = [p.get("consumption", 0.0) for p in pool]
        employed = [p.get("employed") for p in pool if p.get("employed") is not None]

        notes = [f"income {_trend(income)} this quarter"]

        avg_income = sum(income) / len(income)
        if avg_income > 1e-6 and consumption:
            mpc = (sum(consumption) / len(consumption)) / avg_income
            if mpc > 0.85:
                notes.append("spending nearly all of each paycheck, little buffer building")
            elif mpc < 0.45:
                notes.append("banking a large share of income")

        if _volatility(income) > 0.35:
            notes.append("income swinging quarter to quarter, keep a reserve")

        if employed and not any(employed[-2:]):
            notes.append("no work the last two quarters, prioritize finding hours")

        return "; ".join(notes) + "; adjusting work/consumption"


class BDIUpdate(Reflection):
    """P&L trend is a fair universal signal across fundamental/momentum/noise traders —
    every strategy cares whether it's winning. Add position trend (shares held) so the
    belief also reflects whether this agent has actually been building or trimming
    exposure, which already diverges by strategy upstream in clob.py's heuristic.
    """

    def update(self, memory, private_state: dict) -> str:
        hist = getattr(memory, "history", [])
        pnl = [h.get("pnl", h.get("profit", 0.0)) for h in hist]
        trend = _trend(pnl)
        notes = [f"recent P&L {trend}", "holding conviction" if trend != "falling" else "cutting risk"]

        shares = [float(h["shares"]) for h in hist if h.get("shares") is not None]
        if len(shares) >= 2:
            share_trend = _trend(shares)
            if share_trend == "rising":
                notes.append("building exposure")
            elif share_trend == "falling":
                notes.append("trimming exposure")

        return "; ".join(notes)


class NoReflection(Reflection):
    """No-op: the policy (Claude) already writes its own INSIGHTS.txt each round, so the
    templated reflection must not clobber it. Used by the faithful Fish LLM preset."""

    def update(self, memory, private_state: dict) -> str:
        return ""


def make_reflection(kind: str, every: int) -> Reflection:
    if kind == "quarterly":
        return QuarterlyReflection(every)
    if kind == "bdi":
        return BDIUpdate(every)
    if kind in ("none", "off", "manual"):
        return NoReflection(every)
    return InsightUpdate(every)
