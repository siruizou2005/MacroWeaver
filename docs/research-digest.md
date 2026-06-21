# Hackathon source material — digest

Saved so future sessions don't need to re-read the original PDFs/repos. Originals: three
PDFs on `~/Desktop` (`Hackberkeley.pdf`, `黑客松项目方案.pdf`, `AI Hackathon 2026 Hacker Guide.pdf`)
and three GitHub repos researched at project start.

## 1. `Hackberkeley.pdf` — internal engineering blueprint

- One-liner: general-purpose generative socio-economic simulation engine — LLM agents act
  simultaneously inside an objective mechanism; rules settle outcomes and drive the next
  round; system-level phenomena (collusion, inflation) emerge bottom-up. Reproduce two
  mechanistically-different papers (Fish 2024, EconAgent) on one engine to prove generality.
- Five primitives: **Agent** (profile/state/memory, `decide(obs)->action`) · **Mechanism**
  (only swappable part, `aggregate(actions,state)->(outcomes,new_state)`) · **Observation**
  (`build(state,agent_id)->obs`, the lever for whether collusion can emerge) · **Scheduler**
  (synchronous action collection, T rounds, shocks) · **Recorder** (per-round state/metrics,
  benchmarks, `trace.json` export).
- Hard distinction from chat-style multi-agent frameworks (Smallville/EDSL conversation):
  agents never talk to each other directly — they only affect each other through the
  Mechanism's objective settlement (rival price, market price). Do not turn this into an
  agent-chat loop.
- Two data contracts decouple the team: **config schema** (editor → engine, one graph =
  one config) and **trace schema** (engine → canvas, one golden run = one `trace.json`).
  Lock these on hour 1.
- Fish (Calvano logit demand) is the primary, quantitatively-reproduced target — Bertrand
  price ≈1.47, monopoly ≈1.92, success = price stays above Bertrand and drifts toward
  monopoly. EconAgent is a second config, demo-grade only ("same primitives, different
  Mechanism plugin runs" — not a full reproduction, don't over-invest).
- Editor: constrained drag-and-drop only (fixed node types, small connection whitelist) —
  explicitly NOT a general node editor / compiler / runtime codegen. Out-of-scope lines:
  user-defined node types, arbitrary-topology compiler, runtime codegen, calibration to
  real data, EDSL compat layer, productization.
- Original timeline target: ~16–17h, 2 people, submission track **Ddoski's Lab**, Sunday
  11:00 hard deadline (12:00 edit-lock). Degradation ladder if behind: drop live engine run
  in editor → drop EconAgent live → freeze editor to preset+swap-block+tune-params only →
  read-only 5-node canvas + Recharts as the floor.
- Original 2-person split (since superseded by the actual repo structure — see "Current
  state" in `CLAUDE.md`): **A** = engine core + both Mechanisms + Recorder/trace + config
  schema + correctness/benchmarks + integration. **B** (the user) = Agent modeling + memory
  + prompt scaffolding + LLM orchestration + golden runs. Editor: Claude-Code-driven,
  shared, built against mock config/trace from hour 1 so it never blocks on the engine.

## 2. `黑客松项目方案.pdf` — positioning / pitch / business framing

- Pitch: "Homo Silicus" tools (EDSL/Expected Parrot) let agents share a conversation but
  have no mechanism that turns actions into objective outcomes. This project adds that
  Mechanism layer, with paper-reproduction as the credibility anchor — same engine, swap
  config, run a mechanistically different published paper.
- Competitive differentiation (space is crowded — AgentSociety/GenSim/OASIS/AgentScope/
  OpenCity/LLM-Economist/Concordia/Smallville all do "bigger city, more agents"): the
  differentiator here is *market-design rigor* (CLOB/matching, price discovery) + treating
  *reproduction/calibration as a first-class citizen*, not agent count.
- Business framing (background only, not dev scope): primary commercial angle = "algorithmic
  pricing collusion compliance/risk red-teaming" — put a company's pricing agent in the
  simulated market, watch whether it drifts to the collusive price (literally the Fish
  paper's finding, reframed as a compliance sandbox). Secondary: competitive pricing
  wargaming, market/auction mechanism pre-launch testing, game-economy balancing.
- Closest comp: Expected Parrot (YC-stage) — sells AI-agent customer simulation for
  pricing/product/marketing, already markets "pricing scenarios" + "validate against real
  respondents" but can't deliver actual pricing *dynamics* (collusion/war/equilibrium) since
  it's static-questionnaire based. This project's Mechanism layer fills that gap.
- Track fit: **Ddoski's Lab** (science/engineering, data-driven research tool) is the best
  fit and the one to commit to. Toolbox is fallback only if editor UX is unusually polished.
  World/Playground are weak fits / floor-only fallbacks.

## 3. `AI Hackathon 2026 Hacker Guide.pdf` — UC Berkeley AI Hackathon 2026 logistics

- Venue: ASUC Student Union (MLK Jr. Building), Berkeley. Check-in 9:00 AM Sat (first-timers
  8:30 AM), Opening Ceremony 10:00 AM Wheeler Auditorium, team-formation mixer right after in
  Lower Sproul Tent.
- **Submission: Devpost by 11:00 AM Sunday, edits allowed until 12:00 PM.** Draft Devpost
  recommended by midnight Saturday (team + project name) — only way judging is guaranteed.
  Must be started during the event; must be present in person for judging (judges visit
  1:00–3:00 PM Sunday, whole team must be at the table).
  ⚠️ Note: the guide's "Judging: Final Round" section separately says the on-stage-finalist
  call happens "Sunday, 6/22" — inconsistent with the 6/20–6/21 event dates stated elsewhere
  in this same guide and in the project-proposal PDF. Treat 6/21 (the day after the 6/20
  Saturday start) as the operative submission day; don't act on the "6/22" figure without
  double-checking the live schedule site.
- Track = **Ddoski's Lab** (chosen) — science/engineering, data-driven research tools,
  technical depth + real application. $5K cash grand prize per track; also auto-considered
  for Best UI/UX, Most Technical Hack, Best Beginner Hack, Hacker's Choice, etc.
- **Anthropic sponsor prize** is directly relevant: $5000 API credits + Applied AI office
  hour + SF office visit, for projects built with Claude Code tackling a meaningful problem.
  Anthropic workshop Saturday 13:00 — go for credits/support given how LLM-call-heavy this
  project is.
- Also notable given the stack: Redis workshop/prize (agent memory / vector search / context
  retrieval — could be relevant if memory scaffolding needs a real store instead of in-
  process), Sentry (observability prize, "bonus points if you leveraged observability"),
  Arize (agent eval/observability prize).
- Rules: project must be started during the hacking period; old/prior repos may only be
  reused for ideas, not code, merged into the submission; no preferred stack.

## 4. Reference repos researched (for design inspiration — not vendored as dependencies)

### `tsinghua-fib-lab/ACL24-EconAgent` (official EconAgent paper code)
- **Use as a recipe, not a library.** ~3 paper-specific files bolted onto Salesforce's old
  "AI Economist" (Foundation) framework — heavy, old-Python-era deps, RL/TF scaffolding
  that's dead weight for an LLM-only run. **No LICENSE file** on the new code (treat as
  all-rights-reserved) — reimplement the ideas, don't copy the source.
- What's worth porting (already reflected in this repo's `market/econagent.py` /
  `agent/memory.py` / `agent/reflection.py` — verify alignment, don't re-derive from
  scratch):
  - Labor/goods market update math: supply = labor × productivity; price/wage move as a
    random walk nudged by the supply-demand gap (`max_change_rate`); rationing when demand
    exceeds stock; annual inflation/GDP/unemployment bookkeeping. (`simple_labor.py`,
    `simple_consumption.py` in the original repo.)
  - Agent memory pattern: short-term deque (last ~3 rounds) + long-term deque (last ~7) +
    periodic (quarterly) reflection compressing history back into the prompt. This is the
    actual lever for whether interesting macro behavior emerges — treat as load-bearing.
  - Natural-language observation template structure: persona + job/employment delta +
    consumption/shortage + tax + price/inflation-direction, closed with an explicit decision
    request. Worth mining for the EconAgent cohort prompts even though phrasing should be
    rewritten.
  - Known anti-patterns to avoid (the original repo has both): parsing LLM output via
    `eval()` with a silent `[1, 0.5]` fallback on failure — use structured/tool-call output
    and fail loudly instead; hardcoded API key in source; `multiprocessing.Pool`-per-agent
    instead of async/structured concurrency.

### `freedomintelligence/TwinMarket` (canonical — MIT license, NeurIPS'25)
- This is the **real** repo. `TobyYang7/TwinMarket` is a deprecated stub (readme + one image,
  explicitly says "moved to freedomintelligence/TwinMarket") — ignore it, don't reference it
  again.
- Most reusable piece: `trader/matching_engine.py:calculate_closing_price` — a clean,
  self-contained **uniform-price call auction** (price-then-time priority, ±10% daily limit
  bands, picks the price that maximizes matched volume). This repo's own `market/clob.py` is
  described in the README as "a compact self-contained equity book (price-time priority,
  persistent book)... not the binary-outcome prediction-market engine" — i.e. it already
  exists and was inspired by this idea rather than being a literal port. If CLOB behavior
  ever needs revisiting, `calculate_closing_price`'s call-auction logic is the reference
  shape to compare against (this repo currently does continuous persistent-book matching,
  not a daily call auction — a deliberate design choice, not an oversight).
- Also reusable as a pattern (not code): the BDI (Belief-Desire-Intention) per-agent loop —
  persona system prompt + a persistent textual `belief` string carried across rounds +
  retrieval over an external news/info stream + structured decision output. Simpler/more
  composable than it sounds; this repo's `agent/memory.py` + `agent/reflection.py` with
  `memory: bdi, reflection: bdi` (used in the `clob_twinmarket` preset's cohorts) already
  reflects this — confirm any future CLOB cohort tuning stays consistent with that pattern
  rather than drifting toward the Fish-style notepad pattern.
- Caveat noted during research: the original TwinMarket code is research-grade (SQLite-
  coupled, large/coupled modules, Chinese-language prompts/comments) — nothing there should
  be vendored wholesale; only the matching-engine algorithm and the BDI conceptual pattern
  are worth carrying forward, and both are already reflected in this codebase.

### `TobyYang7/TwinMarket`
- Deprecated stub, no code, no license. Not used for anything. Don't re-fetch.
