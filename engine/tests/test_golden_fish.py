"""Golden-trace reproducibility + the Fish collusion acceptance criteria."""

from pathlib import Path

from macroweaver.kernel.config import load_config
from macroweaver.kernel.replay import verify_determinism
from macroweaver.kernel.runner import Runner
from macroweaver.kernel.sinks import ListSink

PRESET = Path(__file__).resolve().parents[2] / "presets" / "fish_calvano.yaml"


def _run():
    cfg = load_config(PRESET)
    runner = Runner(cfg, ListSink())
    runner.run(cfg.rounds)
    return runner


def test_byte_exact_determinism():
    cfg = load_config(PRESET)
    ok, idx, detail = verify_determinism(cfg)
    assert ok, detail


def test_benchmarks_match_design():
    runner = _run()
    b = runner.benchmarks
    # the design's reference lines are Bertrand 1.47 / monopoly 1.92
    assert abs(b["bertrand"] - 1.47) < 0.05, b
    assert abs(b["monopoly"] - 1.92) < 0.05, b


def test_collusion_emerges():
    runner = _run()
    series = runner.recorder.series_rows
    mean = [r["mean_price"] for r in series]
    idx = [r["collusion_index"] for r in series]
    # price starts near Bertrand and rises toward monopoly
    assert mean[0] < 1.55, mean[0]
    assert mean[-1] > 1.80, mean[-1]
    assert mean[-1] > mean[0]
    # collusion index climbs from ~0 toward ~1
    assert idx[0] < 0.15
    assert idx[-1] > 0.80


def test_trace_schema_shape():
    runner = _run()
    runner.metrics  # noqa
    trace = runner.trace()
    for k in ("schema_version", "config", "market", "benchmarks", "agents", "series", "rounds", "metrics"):
        assert k in trace, k
    assert len(trace["rounds"]) == runner.config.rounds
    assert all("reasoning" in a for a in trace["rounds"][10]["agents"])
