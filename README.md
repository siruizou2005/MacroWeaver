# MacroWeaver

**A generative socio-economic simulation engine with a web console.** One fixed
five-primitive kernel — *Population·Agents → Mechanism(Market) → Observation → Scheduler →
Recorder → write-back* — where **the Market is the only swappable block**. Swap it and the
*same* agents reproduce a different paper:

| Preset | Market | Result |
|---|---|---|
| **Fish · Calvano** (primary) | logit posted-price pricing | algorithmic collusion — price drifts from **Bertrand‑Nash ≈1.47** toward **monopoly ≈1.92** with no communication |
| **EconAgent · Macro** | labor + goods clearing | CPI / inflation / unemployment (Phillips) |
| **TwinMarket · CLOB** | limit order book | traded price vs. fair value with stylized facts (volatility clustering) |

Built from the component×paper generalization of four reference projects
(`collusion-Fish2024`, `EconAgent`, `TwinMarket`, and a prediction-market engine). The web
console implements the `MacroWeaver.dc.html` design (Landing → Presets → Console → Replay).

## Architecture (React + Node + Python)

```
React console (web/)  ──run──▶  Node BFF (server/)  ──spawn──▶  Python engine (engine/)
   Vite + Zustand          REST /api + WS /ws            five-primitive kernel
   4-view SPA        ◀── round-by-round NDJSON ───┘      swappable Market plugins
        ▲                                                          │ writes
        └────────── trace.json (replay scrub) ◀── /api/traces ◀────┘
```

- **Python engine** — the kernel `Runner` (deterministic `np.random.SeedSequence`
  substreams, event-sourced canonical JSON), a `Market` ABC with three plugins
  (`fish_calvano`, `econagent`, `clob`), the agent pipeline
  (Profile → Perception → Memory+Reflection → Decision), and two policies behind one
  interface: `DeterministicPolicy` (golden trace, no key) and `ClaudePolicy` (live LLM via
  Anthropic tool-use). Streams NDJSON events per round and writes a self-contained
  `trace.json`.
- **Node BFF** — Express REST (`/api/presets|configs|traces|schema`) + a WebSocket that
  spawns `python -m macroweaver stream`, relays each round event to the browser, and indexes
  the finished trace. Python is the sole writer of traces.
- **React console** — a 4-view SPA (Zustand store mirroring the design's state model):
  Landing, Presets, **Console** (concentric World view · Roster · Engine loop · cohort
  pipeline drawer · Metrics chart · Inspector with the Fish⇄EconAgent⇄CLOB market switch),
  and **Replay** (price-vs-benchmark chart + transport + per-agent reasoning cards).

### Component × paper → module map
| Component | Fish | EconAgent | CLOB | Module |
|---|---|---|---|---|
| heterogeneous profile / private state | cost/quality · price hist | demographics · wealth | biases · holdings | `agent/profile`, `CohortConfig` |
| memory / reflection | notepad+insights | L-round pool · quarterly | BDI · BDI update | `agent/memory`, `agent/reflection` |
| decision / action | set price | work/consume [0,1] | place/hold order | `policy/*`, `market.parse_decision` |
| **market mechanism** | logit demand | labor+goods clearing | order-book matching | `market/{fish_calvano,econagent,clob}` |
| institution / production | – | tax+redistribution · rate · production fn | – | `econagent` params + `LayerConfig` |
| info/news · shock | rival prices | macro indicators · COVID-style | news+sentiment | `market.news_text`, `market.apply_shock` |
| scheduler · recorder · metrics | rounds · collusion index | quarters · inflation/Phillips | sessions · stylized facts | `kernel/{scheduler,recorder}`, `metrics/*` |

## Quick start

```bash
# 1. engine (Python) — golden traces need no API key
cd engine && python3 -m venv .venv && ./.venv/bin/pip install -e '.[dev,llm]'
cd ..

# 2. server + web (Node workspaces)
npm install

# 3. run all three tiers (server :8787, vite :5173 with /api+/ws proxy)
npm run dev          # then open http://127.0.0.1:5173
```

In the console: pick **Fish · Calvano**, press **▶ Run**, watch the collusion curve form
live on the canvas, then scrub it in **Replay** with each agent's reasoning per round. Use
the Inspector's **market switch** to swap to EconAgent or CLOB, or flip a cohort to
**Claude (live)** (needs `ANTHROPIC_API_KEY`).

### Engine CLI (no Node, no key)
```bash
make golden     # deterministic Fish golden trace → traces/golden/fish_calvano.trace.json
make verify     # assert byte-exact determinism
make test       # pytest (golden reproducibility + market contracts)
make schema     # export shared/config.schema.json
# any preset:
engine/.venv/bin/python -m macroweaver golden --config presets/econagent_macro.yaml \
    --out traces/golden/econagent_macro.trace.json
```

## Claude live mode
Set `ANTHROPIC_API_KEY` in `engine/.env` (see `.env.example`). Cohorts with
`policy: claude` then call Claude (`claude-opus-4-8` by default) via forced tool-use for
schema-valid decisions, with an on-disk response cache, retry/backoff and refusal handling.
**Without a key, `claude` cohorts fall back to the deterministic heuristic**, so every demo
still runs and reproduces the curve. The deterministic golden trace is the reproducible,
zero-cost path used for the "golden trace" the design demos.

## Layout
```
engine/macroweaver/  kernel/ (runner,config,events,sinks,scheduler,recorder,replay)
                     market/ (base ABC + fish_calvano, econagent, clob)
                     agent/ (pipeline, memory, reflection)  policy/ (deterministic, claude)
                     metrics/  cli/
server/src/          index, routes, runManager (spawn+relay), files, config
web/src/             App, store; views/; console/{canvas,rail}; replay/; lib/chart
presets/             fish_calvano · econagent_macro · clob_twinmarket  (+ golden traces)
shared/              config.schema.json (generated from pydantic)
```

## Notes
- **Determinism** is the core invariant: a deterministic run is byte-exact reproducible
  (`events.py` canonical JSON, ts masked) — `make verify` and the test suite gate it.
- The CLOB is a compact self-contained equity book (price-time priority, persistent book),
  not the binary-outcome prediction-market engine, so the action space is plain equity
  buy/sell/hold — a better fit for "financial market with stylized facts".
- EconAgent's macro calibration and CLOB's stylized facts are demo-grade; the mechanisms
  are real and pluggable. Optional layers (institution/social/news/shock) are wired as
  config-driven hooks; fiscal/monetary/production and shock injection are active, social
  propagation is a lightweight stub.
