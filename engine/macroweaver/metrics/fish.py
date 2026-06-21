"""Fish metrics: Bertrand-vs-monopoly markup + collusion index (the headline number)."""

from __future__ import annotations

from .base import MetricsComputer


class FishMetrics(MetricsComputer):
    def compute(self, recorder, benchmarks: dict) -> dict:
        rows = recorder.series_rows
        if not rows:
            return {}
        pB = benchmarks.get("bertrand", 1.47)
        pM = benchmarks.get("monopoly", 1.92)
        tail = rows[-min(len(rows), 10):]
        mean_tail = sum(r.get("mean_price", 0.0) for r in tail) / len(tail)
        idx = (mean_tail - pB) / (pM - pB) if pM > pB else 0.0
        return {
            "final_mean_price": round(mean_tail, 4),
            "bertrand": pB,
            "monopoly": pM,
            "monopoly_gap": round(pM - mean_tail, 4),
            "collusion_index": round(max(0.0, min(1.2, idx)), 4),
            "inflation": None,
            "unemployment": None,
            "fat_tail_kurtosis": None,
        }
