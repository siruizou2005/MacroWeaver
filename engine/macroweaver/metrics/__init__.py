from .base import MetricsComputer, NullMetrics
from .fish import FishMetrics


def get_metrics(market_id: str) -> MetricsComputer:
    if market_id == "fish_calvano":
        return FishMetrics()
    try:
        if market_id == "econagent":
            from .econ import EconMetrics
            return EconMetrics()
        if market_id == "clob":
            from .clob import ClobMetrics
            return ClobMetrics()
    except Exception:
        pass
    return NullMetrics()
