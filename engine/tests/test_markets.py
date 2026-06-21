"""The shipped market plugins register and produce deterministic golden traces."""

from pathlib import Path

import pytest

from macroweaver.kernel.config import load_config
from macroweaver.kernel.replay import verify_determinism
from macroweaver.market import MARKET_REGISTRY

PRESETS = Path(__file__).resolve().parents[2] / "presets"


def test_all_markets_registered():
    for m in ("fish_calvano", "econagent"):
        assert m in MARKET_REGISTRY, m


@pytest.mark.parametrize("preset", ["fish_calvano", "econagent_macro"])
def test_preset_runs_and_is_deterministic(preset):
    cfg = load_config(PRESETS / f"{preset}.yaml")
    ok, idx, detail = verify_determinism(cfg)
    assert ok, f"{preset}: {detail}"
