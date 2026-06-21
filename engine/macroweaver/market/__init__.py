"""Importing this package registers every Market plugin into MARKET_REGISTRY."""

from .base import (  # noqa: F401
    MARKET_REGISTRY,
    AgentAction,
    AgentSpec,
    Decision,
    Market,
    MarketObservation,
    Outcome,
    get_market,
    register,
)

# Side-effect imports: each module calls @register on import.
from . import fish_calvano  # noqa: F401,E402

# econagent is registered defensively (kept optional from its later-milestone origin).
try:
    from . import econagent  # noqa: F401,E402
except Exception:
    pass
