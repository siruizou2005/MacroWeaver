"""Recorder — the trace primitive. Accumulates per-round series + per-round agent detail
and assembles the final, self-contained trace.json the Replay view scrubs."""

from __future__ import annotations

import json
from pathlib import Path


class Recorder:
    def __init__(self, config: dict, market_id: str, granularity: str, benchmarks: dict,
                 agents: list[dict]):
        self.config = config
        self.market_id = market_id
        self.granularity = granularity
        self.benchmarks = benchmarks
        self.agents = agents
        self.series_rows: list[dict] = []     # one dict per round (aggregate)
        self.round_frames: list[dict] = []    # one dict per round (per-agent detail)

    def record_round(self, round_no: int, series: dict, news: str,
                     agent_frames: list[dict]) -> None:
        row = {"round": round_no}
        row.update(series)
        self.series_rows.append(row)
        self.round_frames.append({"round": round_no, "news": news, "agents": agent_frames})

    def _series_columns(self) -> dict:
        cols: dict[str, list] = {"round": []}
        by_agent: dict[str, list] = {}
        for row in self.series_rows:
            cols["round"].append(row["round"])
            for k, v in row.items():
                if k in ("round", "by_agent_price"):
                    continue
                cols.setdefault(k, []).append(v)
            for aid, p in (row.get("by_agent_price") or {}).items():
                by_agent.setdefault(aid, []).append(p)
        if by_agent:
            cols["by_agent_price"] = by_agent
        return cols

    def final_metrics(self, market_metrics: dict) -> dict:
        return market_metrics

    def build_trace(self, metrics: dict) -> dict:
        return {
            "schema_version": 1,
            "run_name": self.config.get("run_name", "run"),
            "config": self.config,
            "market": self.market_id,
            "granularity": self.granularity,
            "T": len(self.series_rows),
            "benchmarks": self.benchmarks,
            "agents": self.agents,
            "series": self._series_columns(),
            "rounds": self.round_frames,
            "metrics": metrics,
        }

    def write(self, path: str | Path, metrics: dict) -> str:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.build_trace(metrics), ensure_ascii=False, indent=2),
                     encoding="utf-8")
        return str(p)
