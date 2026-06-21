"""Scheduler — the clock primitive. Owns round granularity + reflection cadence."""

from __future__ import annotations


class Scheduler:
    def __init__(self, granularity: str = "round", reflect_every: int = 4, total: int = 48):
        self.granularity = granularity
        self.reflect_every = max(1, reflect_every)
        self.total = total

    def label(self, round_no: int) -> str:
        if self.granularity == "month":
            return f"m{round_no}"
        if self.granularity == "quarter":
            return f"Q{(round_no - 1) // 3 + 1}" if round_no else "Q0"
        if self.granularity == "session":
            return f"s{round_no}"
        return str(round_no)

    def reflect_now(self, round_no: int) -> bool:
        return round_no > 0 and round_no % self.reflect_every == 0
