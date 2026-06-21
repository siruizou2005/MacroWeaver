// Mirrors the engine's trace.json + streamed event shapes (shared/*.schema.json).

export type Screen = "landing" | "docs" | "blog" | "console" | "replay";
export type CanvasView = "arena" | "roster" | "engine";
export type Mech = "fish" | "econ" | "clob";

// console library (left rail of the preset picker)
export type LibTab = "presets" | "traces" | "markets" | "schema" | "settings";

// app-level defaults, persisted to localStorage and applied to new scratch worlds
export interface AppDefaults {
  model: string;
  maxConcurrency: number;
  useCache: boolean;
  seed: number;
}

export interface Cohort {
  id: string;
  name: string;
  n: number;
  persona: string;
  policy?: string;
  profile?: Record<string, any>;
  initial_state?: Record<string, any>;
  memory?: string;
  reflection?: string;
}

// Engine layers.shock: {round, kind, magnitude} | null
export interface ShockConfig {
  round: number;
  kind: string;
  magnitude: number;
}

export interface PolicyCfg {
  model: string;
  use_cache: boolean;
  max_concurrency: number;
}

export interface SavedConfigMeta {
  id: string;
  run_name?: string;
  market?: string;
  rounds?: number;
}

export interface Benchmarks {
  bertrand?: number;
  monopoly?: number;
  [k: string]: number | undefined;
}

export interface AgentFrame {
  id: string;
  cost?: number;
  price?: number;
  profit?: number;
  beliefs?: Record<string, any>;
  reasoning?: string;
  action?: Record<string, any>;
  realized?: Record<string, any>;
}

export interface RoundFrame {
  round: number;
  news: string;
  agents: AgentFrame[];
}

export interface TraceSeries {
  round: number[];
  mean_price?: number[];
  collusion_index?: number[];
  total_profit?: number[];
  by_agent_price?: Record<string, number[]>;
  [k: string]: any;
}

export interface Trace {
  schema_version: number;
  run_name: string;
  config: any;
  market: string;
  granularity: string;
  T: number;
  benchmarks: Benchmarks;
  agents: { id: string; cohort: string; name: string; persona: string; cost?: number }[];
  series: TraceSeries;
  rounds: RoundFrame[];
  metrics: Record<string, any>;
}

export interface EngineEvent {
  event_id: number;
  round: number;
  type: string;
  agent_id: string | null;
  payload: any;
  result: any;
  ts: string;
}

export interface PresetMeta {
  id: string;
  name: string;
  market: string;
  rounds: number;
  cohorts: number;
  agents: number;
  description: string;
}

export interface TraceMeta {
  id: string;
  run_name?: string;
  market?: string;
  T?: number;
  benchmarks?: Benchmarks;
  mtime: number;
}
