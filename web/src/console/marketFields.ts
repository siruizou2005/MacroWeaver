// Single source of truth for the console's from-scratch configurator.
//
// Every field here is a config key the ENGINE actually reads (verified against
// engine/macroweaver/market/*.py + kernel/{config,runner,scheduler}.py). The
// editor, the live chips, buildConfig and applyConfig are all driven from this
// table so the console can never again drift from the engine contract.
//
// Notes baked in from the audit:
//  • fish reads a/mu/a0/cost/p_min/p_max (n_firms is dead — firm count = total agents).
//  • econ's real switches are market.params.fiscal/monetary (+ interest_rate/price_k/
//    wage_k/productivity). The old {tax,production} keys were never read.
//  • clob reads fair_value/tick/sigma/init_cash/init_shares/max_age (depth_k is dead).
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
  benchmarks: string[];
  params: FieldSpec[]; // market.params
  profileFields: FieldSpec[]; // cohort.profile
  stateFields: FieldSpec[]; // cohort.initial_state
  newCohort: (idx: number) => Cohort; // a fresh cohort for "+ Add"
  starterCohorts: () => Cohort[]; // blank/scratch + on market-switch defaults
  chips: (params: Record<string, any>) => string[]; // headline chips from live params
}

export const MEMORY_KINDS = ["notepad", "pool", "bdi"];
export const REFLECTION_KINDS = ["insight", "quarterly", "bdi"];
export const GRANULARITIES = ["round", "month", "quarter", "session"];
export const SHOCK_KINDS = ["cost_jump"]; // only fish_calvano reacts; free text allowed

const num = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const FISH: MarketSpec = {
  mech: "fish",
  type: "fish_calvano",
  name: "Fish · Calvano",
  blurb:
    "Calvano logit demand turns the posted-price vector into sales, profit and the next state. With no communication, price drifts from Bertrand toward monopoly.",
  action: "set price",
  defaultRounds: 48,
  granularity: "round",
  reflectEvery: 4,
  defaultMemory: "notepad",
  defaultReflection: "insight",
  benchmarks: ["bertrand", "monopoly"],
  params: [
    { key: "a", label: "Quality / intercept a", type: "number", default: 2.0, step: 0.1, hint: "utils" },
    { key: "mu", label: "Substitution μ", type: "number", default: 0.25, step: 0.05, min: 0.01, hint: "lower = price-sensitive" },
    { key: "a0", label: "Outside option a₀", type: "number", default: 0.0, step: 0.1 },
    { key: "cost", label: "Marginal cost c", type: "number", default: 1.0, step: 0.1, hint: "market default" },
    { key: "p_min", label: "Min price", type: "number", default: 1.0, step: 0.1, hint: "clamp" },
    { key: "p_max", label: "Max price", type: "number", default: 2.6, step: 0.1, hint: "clamp" },
  ],
  profileFields: [
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
    policy: "deterministic",
    profile: { cost: 1.0 },
    initial_state: { price: 1.5 },
    memory: "notepad",
    reflection: "insight",
  }),
  starterCohorts: () => [
    { id: "incumbent", name: "Incumbent", n: 1, persona: "cautious · high margin", policy: "deterministic", profile: { cost: 1.0 }, initial_state: { price: 1.5 }, memory: "notepad", reflection: "insight" },
    { id: "challenger", name: "Challenger", n: 1, persona: "aggressive · willing to undercut", policy: "deterministic", profile: { cost: 1.0 }, initial_state: { price: 1.45 }, memory: "notepad", reflection: "insight" },
  ],
  chips: (p) => [`μ=${num(p.mu, 0.25)}`, `a=${num(p.a, 2)}`, `a₀=${num(p.a0, 0)}`],
};

const ECON: MarketSpec = {
  mech: "econ",
  type: "econagent",
  name: "EconAgent · Macro",
  blurb:
    "A labor + goods market. Work/consume decisions aggregate into CPI, wages, inflation and unemployment. Prices and wages adjust by tâtonnement.",
  action: "work / consume",
  defaultRounds: 40,
  granularity: "quarter",
  reflectEvery: 3,
  defaultMemory: "pool",
  defaultReflection: "quarterly",
  benchmarks: ["target_inflation"],
  params: [
    { key: "fiscal", label: "Fiscal (tax + transfer)", type: "bool", default: true },
    { key: "monetary", label: "Monetary (savings interest)", type: "bool", default: true },
    { key: "interest_rate", label: "Interest rate", type: "number", default: 0.01, step: 0.005, hint: "per quarter" },
    { key: "price_k", label: "Price adjust gain", type: "number", default: 0.05, step: 0.01 },
    { key: "wage_k", label: "Wage adjust gain", type: "number", default: 0.04, step: 0.01 },
    { key: "productivity", label: "Labor productivity", type: "number", default: 1.0, step: 0.1 },
  ],
  profileFields: [
    { key: "skill", label: "Skill (income mult)", type: "number", default: 1.0, step: 0.1, hint: "optional" },
  ],
  stateFields: [
    { key: "wealth", label: "Starting wealth", type: "number", default: 20.0, step: 1 },
  ],
  newCohort: (idx) => ({
    id: `group${idx}`,
    name: "New agent",
    n: 20,
    persona: "households",
    policy: "deterministic",
    profile: {},
    initial_state: {},
    memory: "pool",
    reflection: "quarterly",
  }),
  starterCohorts: () => [
    { id: "workers", name: "Workers", n: 40, persona: "wage-earning · consume monthly", policy: "deterministic", profile: {}, initial_state: {}, memory: "pool", reflection: "quarterly" },
    { id: "savers", name: "Savers", n: 30, persona: "precautionary · low spend", policy: "deterministic", profile: {}, initial_state: {}, memory: "pool", reflection: "quarterly" },
    { id: "spenders", name: "Spenders", n: 60, persona: "high marginal propensity", policy: "deterministic", profile: {}, initial_state: {}, memory: "pool", reflection: "quarterly" },
  ],
  chips: (p) => [`fiscal ${p.fiscal === false ? "off" : "on"}`, `r=${num(p.interest_rate, 0.01)}`, "CPI"],
};

const CLOB: MarketSpec = {
  mech: "clob",
  type: "clob",
  name: "TwinMarket · CLOB",
  blurb:
    "A continuous limit-order book. Fundamentalists, momentum and noise traders submit limit orders; price-time priority matches them and the tape shows stylized facts.",
  action: "place / hold orders",
  defaultRounds: 80,
  granularity: "session",
  reflectEvery: 5,
  defaultMemory: "bdi",
  defaultReflection: "bdi",
  benchmarks: ["fair value"],
  params: [
    { key: "fair_value", label: "Fair value", type: "number", default: 100.0, step: 1 },
    { key: "tick", label: "Tick size", type: "number", default: 0.05, step: 0.01 },
    { key: "sigma", label: "FV volatility σ", type: "number", default: 0.012, step: 0.001, hint: "log-return / round" },
    { key: "init_cash", label: "Initial cash", type: "number", default: 100000, step: 1000 },
    { key: "init_shares", label: "Initial shares", type: "int", default: 200, step: 10 },
    { key: "max_age", label: "Order lifetime", type: "int", default: 3, step: 1, min: 1, hint: "rounds" },
  ],
  profileFields: [
    { key: "strategy", label: "Strategy", type: "enum", default: "noise", options: ["fundamental", "momentum", "noise"] },
  ],
  stateFields: [
    { key: "cash", label: "Cash override", type: "number", default: 100000, step: 1000, hint: "optional" },
    { key: "shares", label: "Shares override", type: "int", default: 200, step: 10, hint: "optional" },
  ],
  newCohort: (idx) => ({
    id: `traders${idx}`,
    name: "New traders",
    n: 8,
    persona: "liquidity",
    policy: "deterministic",
    profile: { strategy: "noise" },
    initial_state: {},
    memory: "bdi",
    reflection: "bdi",
  }),
  starterCohorts: () => [
    { id: "fundamental", name: "Fundamentalists", n: 10, persona: "trade toward fair value", policy: "deterministic", profile: { strategy: "fundamental" }, initial_state: {}, memory: "bdi", reflection: "bdi" },
    { id: "momentum", name: "Momentum", n: 10, persona: "chase trends · herding bias", policy: "deterministic", profile: { strategy: "momentum" }, initial_state: {}, memory: "bdi", reflection: "bdi" },
    { id: "noise", name: "Noise traders", n: 8, persona: "random liquidity", policy: "deterministic", profile: { strategy: "noise" }, initial_state: {}, memory: "bdi", reflection: "bdi" },
  ],
  chips: (p) => [`FV=${num(p.fair_value, 100)}`, `σ=${num(p.sigma, 0.012)}`, `tick=${num(p.tick, 0.05)}`],
};

const BY_MECH: Record<Mech, MarketSpec> = { fish: FISH, econ: ECON, clob: CLOB };
const BY_TYPE: Record<string, MarketSpec> = { fish_calvano: FISH, econagent: ECON, clob: CLOB };

export const MARKETS: MarketSpec[] = [FISH, ECON, CLOB];

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
