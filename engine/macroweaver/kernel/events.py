"""Event model + canonical JSON serialization + replay comparison.

Ported from the prediction-market engine (market_sim/runner/events.py). "Byte-exact
replay" is defined precisely as: the canonical serialization of every event matches,
with the wall-clock ``ts`` masked to a constant sentinel (ts is the only
non-reproducible field). event_id, round, type, agent_id, payload and result must all
match byte-for-byte. This contract is what makes the deterministic golden trace
reproducible and the live NDJSON stream self-describing.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

TS_SENTINEL = "<ts>"

# Full event-type vocabulary for MacroWeaver (append-only).
#
# Kernel lifecycle:
#   config        — the full Config.model_dump() (first line; lets replay reconstruct the run)
#   benchmarks    — static market reference lines (fish: bertrand/monopoly; econ: target_inflation)
#   snapshot      — full world snapshot (round 0 init + optional periodic)
#   round_start   — {round}
#   news          — observation/news-layer publication {text, series?}
#   shock         — an injected shock {round, kind, magnitude}
#   institution   — fiscal/monetary application {kind, ...}
#   agent_decision— {beliefs, reasoning, action} produced by one agent's Decision step
#   settle        — one agent's per-round market outcome {realized...}
#   series        — per-round aggregate metrics for the chart {mean_price, collusion_index, ...}
#   round_end     — {round}
#   done          — terminal {trace_path, metrics}
#   error         — terminal failure {message}
#
# CLOB market re-emits the richer order-book sub-events so its canvas works for free:
#   place_order, cancel_order, fill, mint, merge, clearing_trace
EVENT_TYPES = {
    "config", "benchmarks", "snapshot", "round_start", "news", "shock", "institution",
    "agent_decision", "settle", "series", "round_end", "done", "error",
    # CLOB sub-events:
    "place_order", "cancel_order", "fill", "mint", "merge", "clearing_trace",
}


@dataclass
class Event:
    event_id: int
    round: int
    type: str
    agent_id: str | None
    payload: dict
    result: dict | None = None
    ts: str = ""

    def to_dict(self, mask_ts: bool = False) -> dict:
        return {
            "event_id": self.event_id,
            "round": self.round,
            "type": self.type,
            "agent_id": self.agent_id,
            "payload": self.payload,
            "result": self.result,
            "ts": TS_SENTINEL if mask_ts else self.ts,
        }


def canonical_json(d: dict) -> str:
    return json.dumps(d, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def event_line(event: Event) -> str:
    return canonical_json(event.to_dict(mask_ts=False))


def read_events(path: str) -> list[dict]:
    out: list[dict] = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def compare_streams(a: list[dict], b: list[dict]) -> tuple[bool, int | None, str]:
    """Compare two event streams with ts masked. Returns (matched, first_diff_index, detail)."""
    n = min(len(a), len(b))
    for i in range(n):
        da = dict(a[i]); da["ts"] = TS_SENTINEL
        db = dict(b[i]); db["ts"] = TS_SENTINEL
        sa, sb = canonical_json(da), canonical_json(db)
        if sa != sb:
            return False, i, f"event[{i}] differs:\n  original: {sa}\n  replay:   {sb}"
    if len(a) != len(b):
        return False, n, f"length differs: original={len(a)} replay={len(b)}"
    return True, None, "streams identical (ts masked)"
