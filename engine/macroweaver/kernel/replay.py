"""Strict replay: reconstruct the Runner from a trace/log's config, re-run with the same
seed, and byte-compare the event streams (ts masked). Deterministic runs are byte-exact."""

from __future__ import annotations

import json
from pathlib import Path

from .config import Config
from .events import compare_streams, read_events
from .runner import Runner
from .sinks import ListSink


def _config_from_trace(path: str) -> tuple[Config, list[dict] | None]:
    p = Path(path)
    if p.suffix == ".json" and "events" not in p.name:
        # a trace.json (has top-level "config")
        doc = json.loads(p.read_text(encoding="utf-8"))
        return Config(**doc["config"]), None
    # a .events.jsonl log: first "config" event carries the config
    events = read_events(path)
    cfg_event = next(e for e in events if e["type"] == "config")
    return Config(**cfg_event["payload"]["config"]), events


def rerun(path: str) -> list[dict]:
    config, _ = _config_from_trace(path)
    sink = ListSink()
    runner = Runner(config, sink)
    runner.run(config.rounds)
    runner.finalize(str(Path(path).with_suffix(".replay.json")))
    return [ev.to_dict() for ev in sink.events]


def verify_log(log_path: str) -> tuple[bool, int | None, str]:
    """Verify byte-exact replay against a recorded .events.jsonl log."""
    original = read_events(log_path)
    _, _ = _config_from_trace(log_path)
    replayed = rerun(log_path)
    return compare_streams(original, replayed)


def verify_determinism(config: Config) -> tuple[bool, int | None, str]:
    """Run the same config twice from scratch and assert identical event streams."""
    s1, s2 = ListSink(), ListSink()
    Runner(config, s1).run(config.rounds)
    Runner(config, s2).run(config.rounds)
    a = [ev.to_dict() for ev in s1.events]
    b = [ev.to_dict() for ev in s2.events]
    return compare_streams(a, b)
