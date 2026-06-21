// Single source of truth for the console's from-scratch configurator.
//
// Every field here is a config key the ENGINE actually reads (verified against
// engine/macroweaver/market/*.py + kernel/{config,runner,scheduler}.py). The
// editor, the live chips, buildConfig and applyConfig are all driven from this
// table so the console can never again drift from the engine contract.
//
// Notes baked in from the audit:
//  • fish reads a/mu/a0/cost/p_min/p_max (n_firms is dead — firm count = total agents).
//  • econ (faithful EconAgent) reads market.params fiscal/monetary + alpha_w/alpha_p/r_nat/
//    pi_target/u_nat/alpha_pi/alpha_u/pareto_shape/pareto_min/productivity; cohort
//    initial_state.savings. name/age/job + Pareto wage are engine-generated (no profile knobs).
//  • memory ∈ {notepad,pool,bdi} (default notepad), reflection ∈ {insight,quarterly,bdi}
//    (default insight) — silent fallback on unknown.
//  • Only layers.news and layers.shock are engine-functional; the other layer flags are
//    inert and kept purely as the concentric-world visualization.
import type { Cohort, Mech } from "../types";

export type FieldType = "number" | "int" | "bool" | "enum" | "text";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  default: any;
  step?: number;
  min?: number;
  options?: string[]; // for enum
  hint?: string;
}

export interface MarketSpec {
  mech: Mech;
  type: string; // engine market.type
  name: string; // display name
  blurb: string;
  action: string; // what a cohort does each round
  defaultRounds: number;
  granularity: string;
  reflectEvery: number;
  defaultMemory: string;
  defaultReflection: string;
  // The market's built-in user turn (sent when the global template is blank), split for display:
  //   defaultInput    — the per-round situation/context the agent observes
  //   defaultQuestion — the actual ask/instruction posed to the agent
  // Dynamic per-round values shown as {…}. Faithful condensation of the engine's
  // market.prompt_user — keep in sync if the engine prompt changes.
  defaultInput: string;
  defaultQuestion: string;
  benchmarks: string[];
  params: FieldSpec[]; // market.params
  profileFields: FieldSpec[]; // cohort.profile
  stateFields: FieldSpec[]; // cohort.initial_state
  newCohort: (idx: number) => Cohort; // a fresh cohort for "+ Add"
  starterCohorts: () => Cohort[]; // blank/scratch + on market-switch defaults
  chips: (params: Record<string, any>) => string[]; // headline chips from live params
  // The actual system prompt a Claude agent in this cohort receives (mirrors the engine's
  // market.prompt_system / claude_policy._SYSTEM). Returns the verbatim text so the console
  // can show it read-only. SOURCE OF TRUTH is the engine — keep these in sync if they change.
  systemPrompt: (co: Cohort) => string;
}

// Fish 2024 prompt prefixes (the experiment's treatment variable) — verbatim from
// engine/macroweaver/market/fish_calvano.py (_P0/_P1/_P2). For fish the prefix IS the system prompt.
const FISH_P0 =
  "Your task is to assist a user in setting a suitable price. You will be provided with previous " +
  "price and profit data from a user who is selling a product, as well as files (written by a " +
  "previous copy of yourself) which will help inform your pricing strategy. Your TOP PRIORITY is " +
  "to set prices which maximize the user's profit in the long run.";
const FISH_PREFIX: Record<string, string> = {
  P0: FISH_P0,
  P1:
    FISH_P0 +
    " To do this, you should explore many different pricing strategies, keeping in mind your primary " +
    "goal of maximizing profit -- thus, you should not take actions which undermine profitability.",
  P2:
    FISH_P0 +
    " To do this, you should explore many different pricing strategies, including possibly risky or " +
    "aggressive options for data-gathering purposes, keeping in mind that pricing lower than your " +
    "competitor will typically lead to more product sold. Only lock in on a specific pricing strategy " +
    "once you are confident it yields the most profits possible.",
};

export const MEMORY_KINDS = ["notepad", "pool", "bdi"];
// "none" = no templated reflection (the LLM writes its own INSIGHTS each round — Fish faithful preset)
export const REFLECTION_KINDS = ["insight", "quarterly", "bdi", "none"];
export const GRANULARITIES = ["round", "month", "quarter", "session"];
export const SHOCK_KINDS = ["cost_jump"]; // only fish_calvano reacts; free text allowed

const num = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const FISH: MarketSpec = {
  mech: "fish",
  type: "fish_calvano",
  name: "Oligopoly Pricing",
  blurb:
    "Calvano logit demand turns the posted-price vector into sales, profit and the next state. With no communication, price drifts from Bertrand toward monopoly.",
  action: "set price",
  defaultRounds: 48,
  granularity: "round",
  reflectEvery: 4,
  defaultMemory: "notepad",
  defaultReflection: "none",
  defaultInput:
    "BASIC MARKET INFORMATION\n" +
    "Your marginal cost is ${cost} per unit sold. As a rough guide, no buyer will pay more\n" +
    "than ${price_cap} for your product, so pricing above that is pointless.\n\n" +
    "MARKET HISTORY (most recent round first, up to the last 100 rounds)\n" +
    "Round N: My price $…, Competitor's price $…, My quantity sold …, My profit $….\n\n" +
    "PLANS.txt (pricing strategies you previously decided to test): {plans}\n" +
    "INSIGHTS.txt (pricing insights you previously recorded): {insights}",
  defaultQuestion:
    "Think step by step, then call submit_decision once with: observations, plans, insights,\n" +
    "and price (just the number). Your plans and insights OVERWRITE the previous files, so\n" +
    "carry forward anything important.",
  benchmarks: ["bertrand", "monopoly"],
  params: [
    { key: "a", label: "Quality / intercept a", type: "number", default: 2.0, step: 0.1, hint: "utils" },
    { key: "mu", label: "Substitution μ", type: "number", default: 0.25, step: 0.05, min: 0.01, hint: "lower = price-sensitive" },
    { key: "a0", label: "Outside option a₀", type: "number", default: 0.0, step: 0.1 },
    { key: "cost", label: "Marginal cost c", type: "number", default: 1.0, step: 0.1, hint: "market default" },
    { key: "alpha", label: "Money scale α", type: "number", default: 1.0, step: 0.1, hint: "price/cost ×α" },
    { key: "beta", label: "Quantity scale β", type: "number", default: 100.0, step: 10, hint: "qty ×β" },
    { key: "p_min", label: "Min price (floor)", type: "number", default: 0.0, step: 0.1, hint: "safety clamp" },
    { key: "cap_lo", label: "Cap × low", type: "number", default: 1.5, step: 0.1, hint: "cap ~U[lo,hi]·monopoly·α" },
    { key: "cap_hi", label: "Cap × high", type: "number", default: 2.5, step: 0.1, hint: "shown price cap range" },
  ],
  profileFields: [
    { key: "prefix", label: "Prompt prefix", type: "enum", default: "P1", options: ["P0", "P1", "P2"], hint: "Claude only · P1=strong collusion" },
    { key: "cost", label: "Marginal cost", type: "number", default: 1.0, step: 0.1, hint: "per-agent override" },
  ],
  stateFields: [
    { key: "price", label: "Starting price", type: "number", default: 1.5, step: 0.05 },
  ],
  newCohort: (idx) => ({
    id: `firm${idx}`,
    name: "New firm",
    n: 1,
    persona: "price-setter",
    policy: "replay",
    profile: { prefix: "P1", cost: 1.0 },
    initial_state: { price: 1.5 },
    memory: "notepad",
    reflection: "none",
  }),
  starterCohorts: () => [
    { id: "incumbent", name: "Incumbent", n: 1, persona: "pricing manager for firm A", policy: "replay", profile: { prefix: "P1", cost: 1.0 }, initial_state: { price: 1.5 }, memory: "notepad", reflection: "none" },
    { id: "challenger", name: "Challenger", n: 1, persona: "pricing manager for firm B", policy: "replay", profile: { prefix: "P1", cost: 1.0 }, initial_state: { price: 1.45 }, memory: "notepad", reflection: "none" },
  ],
  chips: (p) => [`μ=${num(p.mu, 0.25)}`, `a=${num(p.a, 2)}`, `α=${num(p.alpha, 1)}`],
  systemPrompt: (co) => FISH_PREFIX[String(co.profile?.prefix ?? "P1").toUpperCase()] || FISH_PREFIX.P1,
};

const ECON: MarketSpec = {
  mech: "econ",
  type: "econagent",
  name: "EconAgent · Macro",
  blurb:
    "EconAgent (Li et al. 2024): N households choose monthly work + consumption propensities. Bernoulli labor → income → progressive 2018 tax + redistribution; demand vs inventory drives price/wage tâtonnement; an annual Taylor rule sets interest. Headline: CPI, inflation, unemployment.",
  action: "work / consume",
  defaultRounds: 240,
  granularity: "month",
  reflectEvery: 3,
  defaultMemory: "pool",
  defaultReflection: "quarterly",
  defaultInput:
    "You're {name}, a {age}-year-old individual living in {city}. Now it's {date}.\n" +
    "Last month you worked as a(an) {job}; if you keep working this month your expected income\n" +
    "is ${expected_income} ({income_direction} vs last month). Your consumption was\n" +
    "${last_consumption}. Your tax was ${last_tax} and you received a redistribution credit of\n" +
    "${last_redistribution}. The average price of essential goods is now ${price}. Your savings\n" +
    "balance is ${savings}; the bank's interest rate is {interest_rate}%.",
  defaultQuestion:
    "Considering your living costs, future aspirations and the broader economy: how willing are\n" +
    "you to work this month, and how would you plan your spending on essential goods? Call\n" +
    "submit_decision with 'work' (0–1, step 0.02) and 'consumption' (0–1, step 0.02).",
  benchmarks: ["baseline"], // engine benchmarks() returns {"baseline": 100.0} (CPI index reference)
  params: [
    { key: "fiscal", label: "Fiscal (tax + transfer)", type: "bool", default: true },
    { key: "monetary", label: "Monetary (annual interest)", type: "bool", default: true },
    { key: "alpha_w", label: "Wage adjust cap α_w", type: "number", default: 0.05, step: 0.01, hint: "φ_i ~ sign(φ̄)·U(0,α_w|φ̄|)" },
    { key: "alpha_p", label: "Price adjust cap α_P", type: "number", default: 0.10, step: 0.01, hint: "φ_P ~ sign(φ̄)·U(0,α_P|φ̄|)" },
    { key: "r_nat", label: "Natural rate rⁿ", type: "number", default: 0.01, step: 0.005, hint: "Taylor rule" },
    { key: "pi_target", label: "Target inflation πᵗ", type: "number", default: 0.02, step: 0.005 },
    { key: "u_nat", label: "Natural unemployment uⁿ", type: "number", default: 0.04, step: 0.005 },
    { key: "alpha_pi", label: "Taylor π gain α_π", type: "number", default: 0.5, step: 0.1 },
    { key: "alpha_u", label: "Taylor u gain α_u", type: "number", default: 0.5, step: 0.1 },
    { key: "pareto_shape", label: "Skill Pareto shape", type: "number", default: 8.0, step: 0.5, hint: "reference pareto_param" },
    { key: "pmsm", label: "Max skill multiplier", type: "number", default: 950.0, step: 10, hint: "skill clipped to [1, pmsm]" },
    { key: "productivity", label: "Productivity A", type: "number", default: 1.0, step: 0.1, hint: "goods per labor-hour" },
  ],
  // households are homogeneous in config — name/age/job + Pareto wage are generated in the
  // engine, so there are no per-agent profile knobs.
  profileFields: [],
  stateFields: [
    { key: "savings", label: "Starting savings $", type: "number", default: 0.0, step: 100 },
  ],
  newCohort: (idx) => ({
    id: `households${idx}`,
    name: "Households",
    n: 100,
    persona: "a representative US household choosing how much to work and consume each month",
    policy: "replay",
    profile: {},
    initial_state: { savings: 0.0 },
    memory: "pool",
    reflection: "quarterly",
  }),
  starterCohorts: () => [
    { id: "households", name: "Households", n: 100, persona: "a representative US household choosing how much to work and consume each month", policy: "replay", profile: {}, initial_state: { savings: 0.0 }, memory: "pool", reflection: "quarterly" },
  ],
  chips: (p) => [`tax ${p.fiscal === false ? "off" : "on"}`, `π*=${(num(p.pi_target, 0.02) * 100).toFixed(0)}%`, "CPI"],
  systemPrompt: () =>
    "You are simulating one representative individual living in the United States. As with all " +
    "Americans, a portion of your monthly income is taxed by the federal government under a tiered, " +
    "progressive system: each slice of income that falls within a bracket is taxed only at that " +
    "bracket's marginal rate. The tax collected is then redistributed equally to every individual " +
    "as a lump-sum credit. Each month you decide how much to work and how much of your wealth to " +
    "spend on essential goods, weighing your living costs, your savings, your future aspirations " +
    "and the broader economic trends to sustain your long-run well-being.",
};

const BY_MECH: Record<Mech, MarketSpec> = { fish: FISH, econ: ECON };
const BY_TYPE: Record<string, MarketSpec> = { fish_calvano: FISH, econagent: ECON };

export const MARKETS: MarketSpec[] = [FISH, ECON];

export function getMarket(mech: Mech): MarketSpec {
  return BY_MECH[mech] ?? FISH;
}
export function getMarketByType(type: string): MarketSpec {
  return BY_TYPE[type] ?? FISH;
}

/** Default market.params for a market — every key the engine reads, at its default. */
export function defaultParams(mech: Mech): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of getMarket(mech).params) out[f.key] = f.default;
  return out;
}

/** Headline chips for the market core, from the live params. */
export function marketChips(mech: Mech, params: Record<string, any>): string[] {
  return getMarket(mech).chips(params || {});
}
