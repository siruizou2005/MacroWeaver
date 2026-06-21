"""Golden-trace reproducibility + the EconAgent macro acceptance criteria.

EconAgent has no single crisp emergence metric like Fish's collusion curve, so the golden
test asserts byte-exact determinism, the trace shape, and qualitative macro BOUNDS: the
deterministic 20-year run must stay sane (no blow-up), keep unemployment in a plausible band,
and show the central bank's Taylor rate actually responding over the years.
"""

from pathlib import Path

from macroweaver.kernel.config import load_config
from macroweaver.kernel.replay import verify_determinism
from macroweaver.kernel.runner import Runner
from macroweaver.kernel.sinks import ListSink

PRESET = Path(__file__).resolve().parents[2] / "presets" / "econagent_macro.yaml"


def _run():
    cfg = load_config(PRESET)
    runner = Runner(cfg, ListSink())
    runner.run(cfg.rounds)
    return runner


def test_byte_exact_determinism():
    cfg = load_config(PRESET)
    ok, idx, detail = verify_determinism(cfg)
    assert ok, detail


def test_benchmarks_present():
    runner = _run()
    assert runner.benchmarks.get("baseline") == 100.0, runner.benchmarks


def test_macro_dynamics_bounded():
    runner = _run()
    s = runner.recorder.series_rows
    cpi = [r["mean_price"] for r in s]
    infl = [r["inflation"] for r in s]
    unemp = [r["unemployment"] for r in s]            # percent
    rate = [r["interest_rate"] for r in s]            # annual percent
    gdp = [r["gdp"] for r in s]

    # CPI index stays finite and bounded (mean-reverting around the 100 baseline, no blow-up)
    assert all(c > 0 for c in cpi)
    assert 5.0 < min(cpi) and max(cpi) < 1000.0, (min(cpi), max(cpi))
    # inflation is the monthly price change; finite and not exploding
    assert all(-50.0 < x < 50.0 for x in infl)
    # unemployment sits in a plausible band over 20 years
    assert all(0.0 <= u <= 60.0 for u in unemp)
    assert 1.0 < (sum(unemp) / len(unemp)) < 25.0
    # the Taylor rate never goes negative and actually MOVES (the rule responds year to year)
    assert all(x >= 0.0 for x in rate)
    assert len({round(x, 2) for x in rate}) > 1, "interest rate never changed — Taylor rule inert"
    # nominal output is positive throughout
    assert all(g > 0 for g in gdp)


def test_metrics_shape():
    runner = _run()
    m = runner.trace()["metrics"]
    for k in ("final_cpi", "avg_inflation", "avg_unemployment", "phillips_corr",
              "final_interest_rate", "gini_savings"):
        assert k in m, (k, m)
    assert 0.0 <= m["gini_savings"] <= 1.0


def test_trace_schema_shape():
    runner = _run()
    runner.metrics  # noqa
    trace = runner.trace()
    for k in ("schema_version", "config", "market", "benchmarks", "agents", "series", "rounds", "metrics"):
        assert k in trace, k
    assert len(trace["rounds"]) == runner.config.rounds
    assert all("reasoning" in a for a in trace["rounds"][10]["agents"])
