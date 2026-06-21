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

# econagent and clob are registered in later milestones; import defensively.
try:
    from . import econagent  # noqa: F401,E402
except Exception:
    pass
try:
    from . import clob  # noqa: F401,E402
except Exception:
    pass
