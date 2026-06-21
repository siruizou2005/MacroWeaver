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
        # paper reports the mean over the last 50 rounds (e.g. rounds 251–300 of a 300-round run)
        tail = rows[-min(len(rows), 50):]
        mean_tail = sum(r.get("mean_price", 0.0) for r in tail) / len(tail)
        # Calvano collusion index Δ = (price − Nash) / (monopoly − Nash): >0 super-competitive, ≈1 monopoly
        delta = (mean_tail - pB) / (pM - pB) if pM > pB else 0.0
        return {
            "final_mean_price": round(mean_tail, 4),
            "bertrand": pB,
            "monopoly": pM,
            "monopoly_gap": round(pM - mean_tail, 4),
            "collusion_index": round(max(0.0, min(1.2, delta)), 4),
            "collusion_delta": round(delta, 4),
            "tail_rounds": len(tail),
            "bertrand_profit": benchmarks.get("bertrand_profit"),
            "monopoly_profit": benchmarks.get("monopoly_profit"),
            "inflation": None,
            "unemployment": None,
            "fat_tail_kurtosis": None,
        }
