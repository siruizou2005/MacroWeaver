"""MacroWeaver engine CLI.

  golden  — run with the deterministic policy → byte-exact reproducible trace.json (no API key)
  stream  — spawned by the Node BFF: read config from stdin/file, emit NDJSON events to stdout,
            write trace.json at the end (the live-stream→replay backbone)
  run     — run to completion, write trace.json (no streaming)
  verify  — assert byte-exact determinism (run the config twice and compare)
  schema  — export Config JSON Schema to shared/config.schema.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import typer

from ..kernel.config import Config, load_config, load_config_data
from ..kernel.replay import verify_determinism
from ..kernel.runner import Runner
from ..kernel.sinks import FanoutSink, JsonlEventSink, ListSink, StdoutSink

app = typer.Typer(add_completion=False, help="MacroWeaver simulation engine")

_TRACES = Path(__file__).resolve().parents[3] / "traces"


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _read_config(config: str) -> Config:
    if config == "-":
        return load_config_data(__import__("yaml").safe_load(sys.stdin.read()))
    return load_config(config)


def _policy_factory(config, policy_cfg=None):
    """Returns a factory (cohort, market) -> DecisionPolicy. A cohort asking for "claude" gets a
    live LLM when a key is present; otherwise (and for every non-claude cohort) it falls back to
    the offline path — replay a recorded trace if replay_trace_path is set, else error on decide."""
    from ..policy.factory import offline_factory
    base = offline_factory(config)

    def factory(cohort, market):
        if cohort.policy == "claude":
            try:
                from ..policy.claude_policy import ClaudePolicy
                return ClaudePolicy(market, policy_cfg)
            except Exception as e:  # noqa: BLE001
                _log(f"[macroweaver] ClaudePolicy unavailable ({e}); falling back to offline replay")
        return base(cohort, market)
    return factory


def _default_trace_path(cfg: Config) -> Path:
    return _TRACES / f"{cfg.run_name}.trace.json"


@app.command()
def golden(config: str = typer.Option(..., "--config", "-c"),
           out: str = typer.Option(None, "--out", "-o")):
    """(Re)write a golden trace OFFLINE by replaying the config's replay_trace_path (no LLM,
    byte-exact). A config without replay_trace_path has no offline decisions and will error —
    record one first with a live (claude) run."""
    cfg = _read_config(config)
    out_path = Path(out) if out else _default_trace_path(cfg)
    sink = ListSink()
    runner = Runner(cfg, sink)  # default factory = offline_factory (replay the recorded trace)
    runner.run(cfg.rounds)
    metrics = runner.finalize(str(out_path))
    _log(f"[golden] {cfg.run_name}: T={cfg.rounds} → {out_path}")
    _log(f"[golden] metrics: {json.dumps(metrics)}")


@app.command()
def stream(config: str = typer.Option("-", "--config", "-c"),
           out: str = typer.Option(None, "--out", "-o"),
           jsonl: str = typer.Option(None, "--jsonl"),
           record_qa: bool = typer.Option(True, "--record-qa/--no-record-qa")):
    """Stream NDJSON events to stdout (spawned by the Node BFF). The live console path records the
    generic per-agent Q&A (--record-qa, on by default); golden/verify use their own off path."""
    cfg = _read_config(config)
    out_path = Path(out) if out else _default_trace_path(cfg)
    children: list = [StdoutSink()]
    if jsonl:
        children.append(JsonlEventSink(jsonl))
    sink = FanoutSink(children)
    runner = None
    try:
        runner = Runner(cfg, sink, policy_factory=_policy_factory(cfg, cfg.policy),
                        record_qa=record_qa)
        runner.run(cfg.rounds)
        runner.finalize(str(out_path))
    except Exception as e:  # noqa: BLE001
        from ..kernel.events import Event, event_line
        rnd = runner.round_no if runner is not None else 0
        sys.stdout.write(event_line(Event(10**9, rnd, "error", None, {"message": str(e)})) + "\n")
        sys.stdout.flush()
        _log(f"[stream] ERROR: {e}")
        raise typer.Exit(1)


@app.command()
def run(config: str = typer.Option(..., "--config", "-c"),
        out: str = typer.Option(None, "--out", "-o")):
    """Run to completion (no streaming)."""
    cfg = _read_config(config)
    out_path = Path(out) if out else _default_trace_path(cfg)
    runner = Runner(cfg, ListSink(), policy_factory=_policy_factory(cfg, cfg.policy))
    runner.run(cfg.rounds)
    metrics = runner.finalize(str(out_path))
    _log(f"[run] {cfg.run_name} → {out_path}  metrics={json.dumps(metrics)}")


@app.command()
def roster(config: str = typer.Option("-", "--config", "-c")):
    """Sample the per-agent roster (cohorts expanded into individuals + their traits) WITHOUT
    running. Builds only the initial world, then prints {agents:[{id,cohort,name,traits}]} as JSON
    to stdout (diagnostics go to stderr). Deterministic — no LLM/API key needed."""
    cfg = _read_config(config)
    runner = Runner(cfg, ListSink())   # default factory = deterministic; init_world runs in __init__
    sys.stdout.write(json.dumps({"agents": runner.roster()}, ensure_ascii=False))
    sys.stdout.flush()


@app.command(name="validate-mechanism")
def validate_mechanism(name: str = typer.Option(..., "--name")):
    """Validate a user-authored mechanism (from MW_MECHANISMS_DIR): AST gate + ABC instantiation
    + a tiny 2-agent smoke of the read hooks. Prints {ok:true} or {ok:false,error,line} JSON."""
    import numpy as np

    try:
        from ..market.base import AgentSpec, get_market
        market = get_market(name)   # loader + AST gate + ABC instantiation all happen here
        rng = np.random.default_rng(0)
        specs = [AgentSpec(f"{name}_0", name), AgentSpec(f"{name}_1", name)]
        state = market.init_world({}, specs, rng)
        for s in specs:
            market.build_observation(state, s.agent_id, 1)
        market.public_series(state, [], 1)
        market.benchmarks({})
        market.decision_schema()
        result = {"ok": True, "market": name}
    except Exception as e:  # noqa: BLE001
        msg = e.args[0] if e.args and isinstance(e.args[0], str) else str(e)
        result = {"ok": False, "error": msg, "line": getattr(e, "lineno", None)}
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    sys.stdout.flush()


@app.command()
def verify(config: str = typer.Option(..., "--config", "-c")):
    """Assert byte-exact determinism (run the config twice, compare streams)."""
    cfg = _read_config(config)
    ok, idx, detail = verify_determinism(cfg)
    _log(f"[verify] {'OK' if ok else 'MISMATCH'} — {detail}")
    raise typer.Exit(0 if ok else 1)


@app.command()
def schema(out: str = typer.Option(None, "--out", "-o")):
    """Export the Config JSON Schema."""
    js = Config.model_json_schema()
    text = json.dumps(js, indent=2, ensure_ascii=False)
    if out:
        Path(out).write_text(text, encoding="utf-8")
        _log(f"[schema] wrote {out}")
    else:
        print(text)


if __name__ == "__main__":
    app()
