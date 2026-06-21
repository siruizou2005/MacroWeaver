"""CLOB metrics: stylized facts — fat-tailed returns (excess kurtosis) and volatility
clustering (autocorrelation of absolute returns)."""

from __future__ import annotations

from .base import MetricsComputer


def _kurtosis(xs: list[float]) -> float:
    n = len(xs)
    if n < 4:
        return 0.0
    m = sum(xs) / n
    var = sum((x - m) ** 2 for x in xs) / n
    if var <= 1e-12:
        return 0.0
    m4 = sum((x - m) ** 4 for x in xs) / n
    return m4 / (var ** 2) - 3.0  # excess kurtosis (0 = Gaussian)


def _abs_autocorr(xs: list[float], lag: int = 1) -> float:
    a = [abs(x) for x in xs]
    n = len(a)
    if n < lag + 3:
        return 0.0
    m = sum(a) / n
    num = sum((a[i] - m) * (a[i - lag] - m) for i in range(lag, n))
    den = sum((x - m) ** 2 for x in a)
    return num / den if den > 0 else 0.0


class ClobMetrics(MetricsComputer):
    def compute(self, recorder, benchmarks: dict) -> dict:
        rows = recorder.series_rows
        if not rows:
            return {}
        rets = [r.get("return_pct", 0.0) for r in rows]
        vols = [r.get("volume", 0) for r in rows]
        prices = [r.get("mean_price", 0.0) for r in rows]
        return {
            "final_price": round(prices[-1], 3),
            "fat_tail_kurtosis": round(_kurtosis(rets), 4),
            "vol_clustering_acf1": round(_abs_autocorr(rets, 1), 4),
            "avg_volume": round(sum(vols) / len(vols), 2),
            "return_vol_pct": round((sum((x - sum(rets) / len(rets)) ** 2 for x in rets) / len(rets)) ** 0.5, 4),
            "collusion_index": None,
        }
