from .base import MetricsComputer, NullMetrics
from .fish import FishMetrics

# User mechanisms may register a metrics computer for their market id (parallel to MARKET_REGISTRY).
METRICS_REGISTRY: dict[str, type] = {}


def register_metrics(market_id: str):
    def deco(cls):
        METRICS_REGISTRY[market_id] = cls
        return cls
    return deco


def get_metrics(market_id: str) -> MetricsComputer:
    if market_id == "fish_calvano":
        return FishMetrics()
    try:
        if market_id == "econagent":
            from .econ import EconMetrics
            return EconMetrics()
    except Exception:
        pass
    cls = METRICS_REGISTRY.get(market_id)
    if cls is not None:
        try:
            return cls()
        except Exception:
            pass
    return NullMetrics()   # user mechanisms without metrics still run; just no headline numbers
