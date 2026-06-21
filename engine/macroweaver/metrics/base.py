"""Metrics / benchmark primitive — per-market, computed from the recorder's series."""

from __future__ import annotations

from abc import ABC, abstractmethod


class MetricsComputer(ABC):
    @abstractmethod
    def compute(self, recorder, benchmarks: dict) -> dict: ...


class NullMetrics(MetricsComputer):
    def compute(self, recorder, benchmarks: dict) -> dict:
        return {}
