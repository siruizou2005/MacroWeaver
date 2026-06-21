"""EconAgent metrics: inflation, unemployment, the Phillips-curve correlation, the central
bank's Taylor rate, GDP, and the cross-sectional savings inequality (Gini)."""

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


def _gini(xs: list[float]) -> float:
    """Gini coefficient of a non-negative distribution (0 = equal, →1 = concentrated)."""
    xs = sorted(max(0.0, x) for x in xs)
    n = len(xs)
    s = sum(xs)
    if n == 0 or s <= 0:
        return 0.0
    cum = sum((i + 1) * x for i, x in enumerate(xs))
    return (2.0 * cum) / (n * s) - (n + 1.0) / n


class EconMetrics(MetricsComputer):
    def compute(self, recorder, benchmarks: dict) -> dict:
        rows = recorder.series_rows
        if not rows:
            return {}
        infl = [r.get("inflation", 0.0) for r in rows]
        unemp = [r.get("unemployment", 0.0) for r in rows]            # already in %
        rate = [r.get("interest_rate", 0.0) for r in rows]            # annual %, monthly samples
        gdp = [r.get("gdp", 0.0) for r in rows]

        # cross-sectional savings inequality from the final round's per-agent frames
        gini = 0.0
        frames = getattr(recorder, "round_frames", [])
        if frames:
            savings = [a.get("realized", {}).get("savings", a.get("savings", 0.0))
                       for a in frames[-1].get("agents", [])]
            gini = _gini(savings)

        return {
            "final_cpi": round(rows[-1].get("mean_price", 100.0), 3),
            "avg_inflation": round(sum(infl) / len(infl), 4),
            "final_inflation": round(infl[-1], 4),
            "target_inflation": 2.0,
            "avg_unemployment": round(sum(unemp) / len(unemp), 3),
            "final_unemployment": round(unemp[-1], 3),
            "natural_unemployment": 4.0,
            "phillips_corr": round(_corr(infl, unemp), 4),
            "final_interest_rate": round(rate[-1], 3) if rate else 0.0,
            "avg_interest_rate": round(sum(rate) / len(rate), 3) if rate else 0.0,
            "avg_gdp": round(sum(gdp) / len(gdp), 2),
            "gini_savings": round(gini, 4),
            "collusion_index": None,
        }
