"""Every registered Market must satisfy the ABC contract and settle() must be pure."""

import numpy as np
import pytest

from macroweaver.market import MARKET_REGISTRY, get_market
from macroweaver.market.base import AgentSpec


def test_fish_registered():
    assert "fish_calvano" in MARKET_REGISTRY


@pytest.mark.parametrize("market_id", ["fish_calvano"])
def test_settle_is_pure(market_id):
    specs = [AgentSpec("f_0", "f", {"cost": 1.0}, {"price": 1.5}),
             AgentSpec("f_1", "f", {"cost": 1.0}, {"price": 1.45})]

    def fresh():
        m = get_market(market_id)
        st = m.init_world({}, specs, np.random.default_rng(0))
        return m, st

    m1, s1 = fresh()
    m2, s2 = fresh()
    acts1 = [m1.parse_decision({"price": 1.6}, "f_0"), m1.parse_decision({"price": 1.55}, "f_1")]
    acts2 = [m2.parse_decision({"price": 1.6}, "f_0"), m2.parse_decision({"price": 1.55}, "f_1")]
    o1, n1 = m1.settle(acts1, s1, 1, np.random.default_rng(99))
    o2, n2 = m2.settle(acts2, s2, 1, np.random.default_rng(99))
    assert [o.realized for o in o1] == [o.realized for o in o2]


@pytest.mark.parametrize("market_id", ["fish_calvano"])
def test_decision_schema_roundtrip(market_id):
    m = get_market(market_id)
    schema = m.decision_schema()
    inst = schema(price=1.7)
    action = m.parse_decision(inst.model_dump(), "f_0")
    assert action.agent_id == "f_0"
    assert "price" in action.payload
