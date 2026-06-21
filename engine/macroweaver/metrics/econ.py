"""EconAgent metrics: inflation, unemployment, and the Phillips-curve correlation."""

from __future__ import annotations

from .base import MetricsComputer


def _corr(xs: list[float], ys: list[float]) -> float:
    n = min(len(xs), len(ys))
    if n < 3:
        return 0.0
    xs, ys = xs[:n], ys[:n]
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    return num / (dx * dy) if dx > 0 and dy > 0 else 0.0


class EconMetrics(MetricsComputer):
    def compute(self, recorder, benchmarks: dict) -> dict:
        rows = recorder.series_rows
        if not rows:
            return {}
        infl = [r.get("inflation", 0.0) for r in rows]
        unemp = [r.get("unemployment", 0.0) for r in rows]
        tail = rows[-min(len(rows), 8):]
        return {
            "final_cpi": round(rows[-1].get("mean_price", 100.0), 3),
            "avg_inflation": round(sum(infl) / len(infl), 3),
            "final_inflation": round(infl[-1], 3),
            "avg_unemployment": round(sum(unemp) / len(unemp), 3),
            "final_unemployment": round(unemp[-1], 3),
            "phillips_corr": round(_corr(infl, unemp), 4),
            "collusion_index": None,
        }
