import { create } from "zustand";
import type {
  Benchmarks, Cohort, CanvasView, Mech, PresetMeta, Screen, Trace, TraceMeta,
} from "./types";

// ---- market <-> mech mapping ----
const MECH_TO_TYPE: Record<Mech, string> = {
  fish: "fish_calvano",
  econ: "econagent",
  clob: "clob",
};
const TYPE_TO_MECH: Record<string, Mech> = {
  fish_calvano: "fish",
  econagent: "econ",
  clob: "clob",
};
const DEFAULT_PARAMS: Record<Mech, Record<string, any>> = {
  fish: { a: 2.0, mu: 0.25, a0: 0.0, cost: 1.0 },
  econ: { tax: "progressive", production: true },
  clob: { depth_k: 8 },
};
const DEFAULT_ROUNDS: Record<Mech, number> = { fish: 48, econ: 40, clob: 60 };
const GRANULARITY: Record<Mech, string> = { fish: "round", econ: "quarter", clob: "session" };

// ---- default cohort sets (used for "start from scratch" / fallback) ----
export function cohortsFor(mech: Mech): Cohort[] {
  if (mech === "econ")
    return [
      { id: "workers", name: "Workers", n: 40, persona: "wage-earning · consume monthly", memory: "pool", reflection: "quarterly" },
      { id: "savers", name: "Savers", n: 30, persona: "precautionary · low spend", memory: "pool", reflection: "quarterly" },
      { id: "spenders", name: "Spenders", n: 120, persona: "high marginal propensity", memory: "pool", reflection: "quarterly" },
      { id: "gig", name: "Gig labor", n: 25, persona: "volatile income", memory: "pool", reflection: "quarterly" },
      { id: "retirees", name: "Retirees", n: 18, persona: "fixed income · price-sensitive", memory: "pool", reflection: "quarterly" },
      { id: "students", name: "Students", n: 12, persona: "credit-constrained", memory: "pool", reflection: "quarterly" },
    ];
  if (mech === "clob")
    return [
      { id: "fundamental", name: "Fundamentalists", n: 8, persona: "trade toward fair value", memory: "bdi", reflection: "bdi" },
      { id: "momentum", name: "Momentum", n: 8, persona: "chase trends · herding bias", memory: "bdi", reflection: "bdi" },
      { id: "noise", name: "Noise traders", n: 6, persona: "random liquidity", memory: "bdi", reflection: "bdi" },
    ];
  return [
    { id: "incumbent", name: "Incumbent", n: 1, persona: "cautious · high margin", profile: { cost: 1.0 }, initial_state: { price: 1.5 } },
    { id: "challenger", name: "Challenger", n: 1, persona: "aggressive · low cost", profile: { cost: 1.0 }, initial_state: { price: 1.45 } },
  ];
}

interface LiveSeries {
  round: number[];
  mean_price: number[];
  collusion_index: number[];
  by_agent_price: Record<string, number[]>;
  total_profit: number[];
}
function emptySeries(): LiveSeries {
  return { round: [], mean_price: [], collusion_index: [], by_agent_price: {}, total_profit: [] };
}

// ---- URL routing: one real path per screen (server has SPA fallback) ----
const SCREEN_PATH: Record<Screen, string> = {
  landing: "/",
  docs: "/docs",
  console: "/console",
  replay: "/replay",
};
function pathToScreen(path: string): Screen {
  if (path.startsWith("/console") || path.startsWith("/presets")) return "console";
  if (path.startsWith("/replay")) return "replay";
  if (path.startsWith("/docs")) return "docs";
  return "landing";
}
function pushPath(s: Screen) {
  const p = SCREEN_PATH[s];
  if (location.pathname !== p) history.pushState({}, "", p);
}

interface MWState {
  // navigation / selection
  screen: Screen;
  node: string | null; // "market" | "observation" | "scheduler" | "recorder" | "shock" | "cohort:<id>"
  view: CanvasView;
  mech: Mech;
  preset: string | null;

  // world config
  cohorts: Cohort[];
  marketParams: Record<string, any>;
  rounds: number;
  expanded: string | null; // cohort id whose pipeline drawer is open
  layers: { info: boolean; institution: boolean; social: boolean; news: boolean };

  // connection + library
  connected: boolean;
  presets: PresetMeta[];
  traces: TraceMeta[];

  // live run
  running: boolean;
  runId: string | null;
  liveBenchmarks: Benchmarks;
  liveSeries: LiveSeries;
  liveRound: number;
  liveAgents: Record<string, any>; // agent_id -> last {beliefs, reasoning, action}
  liveNews: string;
  metrics: Record<string, any>;

  // replay
  trace: Trace | null;
  round: number;
  playing: boolean;

  // ws internals
  _ws: WebSocket | null;
  _timer: any;

  // actions
  connect: () => void;
  send: (m: any) => void;
  nav: (s: Screen) => void;
  syncFromPath: () => void;
  backToPicker: () => void;
  openPreset: (id: Mech | "blank") => void;
  selectNode: (n: string) => void;
  setView: (v: CanvasView) => void;
  setMech: (m: Mech) => void;
  addCohort: () => void;
  removeCohort: (id: string) => void;
  updateCohort: (id: string, patch: Partial<Cohort>) => void;
  toggleLayer: (k: "info" | "institution" | "social" | "news") => void;
  openExpanded: (id: string) => void;
  collapse: () => void;
  startRun: () => void;
  cancelRun: () => void;
  loadTrace: (id: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  stepFwd: () => void;
  stepBack: () => void;
  scrub: (r: number) => void;
}

function buildConfig(s: MWState) {
  const mech = s.mech;
  return {
    seed: 7,
    rounds: s.rounds,
    run_name: `${mech}_console`,
    market: { type: MECH_TO_TYPE[mech], params: s.marketParams },
    cohorts: s.cohorts.map((c, i) => ({
      id: c.id,
      name: c.name,
      n: c.n,
      persona: c.persona,
      policy: c.policy || "deterministic",
      profile: c.profile || (mech === "fish" ? { cost: 1.0 } : {}),
      initial_state:
        c.initial_state || (mech === "fish" ? { price: 1.5 - 0.05 * (i % 2) } : {}),
      memory: c.memory || (mech === "fish" ? "notepad" : mech === "econ" ? "pool" : "bdi"),
      reflection:
        c.reflection || (mech === "fish" ? "insight" : mech === "econ" ? "quarterly" : "bdi"),
    })),
    layers: {
      observation: true,
      institution_fiscal: s.layers.institution && mech === "econ",
      institution_monetary: s.layers.institution && mech === "econ",
      production: mech === "econ",
      social: s.layers.social,
      news: s.layers.news,
      shock: null,
    },
    scheduler: { granularity: GRANULARITY[mech], reflect_every: 4 },
    policy: { model: "claude-opus-4-8", use_cache: true, max_concurrency: 4 },
  };
}

export const useStore = create<MWState>((set, get) => ({
  screen: pathToScreen(location.pathname),
  node: "market",
  view: "arena",
  mech: "fish",
  preset: null,

  cohorts: cohortsFor("fish"),
  marketParams: { ...DEFAULT_PARAMS.fish },
  rounds: 48,
  expanded: null,
  layers: { info: true, institution: false, social: false, news: false },

  connected: false,
  presets: [],
  traces: [],

  running: false,
  runId: null,
  liveBenchmarks: {},
  liveSeries: emptySeries(),
  liveRound: 0,
  liveAgents: {},
  liveNews: "",
  metrics: {},

  trace: null,
  round: 0,
  playing: false,

  _ws: null,
  _timer: null,

  connect: () => {
    if (get()._ws) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => set({ connected: true });
    ws.onclose = () => {
      set({ connected: false, _ws: null });
      setTimeout(() => get().connect(), 1500);
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      handleMessage(m, set, get);
    };
    set({ _ws: ws });
  },

  send: (m) => {
    const ws = get()._ws;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  },

  nav: (s) => {
    if (s !== "replay") get().pause();
    pushPath(s);
    set({ screen: s });
  },

  // browser back/forward → reflect the URL into the screen state
  syncFromPath: () => set({ screen: pathToScreen(location.pathname) }),

  // return the console to its preset-picker start state
  backToPicker: () => {
    get().pause();
    set({ preset: null, running: false });
  },

  openPreset: (id) => {
    const mech: Mech = id === "blank" ? "fish" : (id as Mech);
    // try to load the shipped preset config so the console matches the golden trace
    const presetFile = id === "blank" ? null : MECH_TO_TYPE[mech];
    pushPath("console");
    set({
      screen: "console",
      preset: id,
      mech,
      node: "market",
      view: "arena",
      expanded: null,
      rounds: DEFAULT_ROUNDS[mech],
      marketParams: { ...DEFAULT_PARAMS[mech] },
      cohorts: cohortsFor(mech),
      liveSeries: emptySeries(),
      liveRound: 0,
      metrics: {},
    });
    if (presetFile) {
      fetch(`/api/presets/${presetFile}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((cfg) => {
          if (!cfg) return;
          set({
            cohorts: (cfg.cohorts || cohortsFor(mech)) as Cohort[],
            marketParams: cfg.market?.params || { ...DEFAULT_PARAMS[mech] },
            rounds: cfg.rounds || DEFAULT_ROUNDS[mech],
          });
        })
        .catch(() => {});
    }
  },

  selectNode: (n) => set({ node: n }),
  setView: (v) => set({ view: v }),

  setMech: (m) =>
    set({
      mech: m,
      marketParams: { ...DEFAULT_PARAMS[m] },
      rounds: DEFAULT_ROUNDS[m],
      cohorts: cohortsFor(m),
      node: "market",
      expanded: null,
    }),

  addCohort: () =>
    set((s) => {
      const idx = s.cohorts.length + 1;
      return {
        cohorts: [
          ...s.cohorts,
          { id: `cohort${idx}`, name: "New cohort", n: 10, persona: "custom persona" },
        ],
      };
    }),

  removeCohort: (id) =>
    set((s) =>
      s.cohorts.length <= 2
        ? {}
        : {
            cohorts: s.cohorts.filter((c) => c.id !== id),
            node: "market",
            expanded: null,
          },
    ),

  updateCohort: (id, patch) =>
    set((s) => ({ cohorts: s.cohorts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),

  openExpanded: (id) => set({ expanded: id, node: `cohort:${id}` }),
  collapse: () => set({ expanded: null }),

  startRun: () => {
    const s = get();
    set({
      running: true,
      liveSeries: emptySeries(),
      liveRound: 0,
      liveAgents: {},
      liveBenchmarks: {},
      metrics: {},
    });
    s.send({ type: "run.start", config: buildConfig(s) });
  },

  cancelRun: () => {
    get().send({ type: "run.cancel", runId: get().runId });
    set({ running: false });
  },

  loadTrace: async (id) => {
    const r = await fetch(`/api/traces/${id}`);
    if (!r.ok) return;
    const trace = (await r.json()) as Trace;
    pushPath("replay");
    set({ trace, round: 0, screen: "replay", mech: TYPE_TO_MECH[trace.market] || "fish" });
  },

  play: () => {
    const s = get();
    if (s.playing || !s.trace) return;
    if (s.round >= s.trace.T - 1) set({ round: 0 });
    set({ playing: true });
    const timer = setInterval(() => {
      const st = get();
      if (!st.trace || st.round >= st.trace.T - 1) {
        clearInterval(get()._timer);
        set({ playing: false, _timer: null });
        return;
      }
      set({ round: st.round + 1 });
    }, 620);
    set({ _timer: timer });
  },
  pause: () => {
    const t = get()._timer;
    if (t) clearInterval(t);
    set({ playing: false, _timer: null });
  },
  stepFwd: () => {
    get().pause();
    set((s) => ({ round: Math.min((s.trace?.T || 1) - 1, s.round + 1) }));
  },
  stepBack: () => {
    get().pause();
    set((s) => ({ round: Math.max(0, s.round - 1) }));
  },
  scrub: (r) => {
    get().pause();
    set({ round: r });
  },
}));

function handleMessage(m: any, set: any, get: () => MWState) {
  switch (m.type) {
    case "hello":
      set({ presets: m.presets || [], traces: m.traces || [] });
      break;
    case "run.started":
      set({ runId: m.runId, running: true });
      break;
    case "round":
      applyEvent(m.event, set, get);
      break;
    case "run.done":
      set({ running: false, metrics: m.metrics || {} });
      // refresh trace library then auto-open replay on the finished trace
      fetch("/api/traces")
        .then((r) => r.json())
        .then((traces) => set({ traces }))
        .catch(() => {});
      get().loadTrace(m.traceId);
      break;
    case "run.error":
      set({ running: false });
      console.error("[run.error]", m.message);
      break;
    default:
      break;
  }
}

function applyEvent(ev: any, set: any, get: () => MWState) {
  const s = get();
  if (ev.type === "benchmarks") {
    set({ liveBenchmarks: ev.payload });
  } else if (ev.type === "round_start") {
    set({ liveRound: ev.payload.round });
  } else if (ev.type === "news") {
    set({ liveNews: ev.payload.text || "" });
  } else if (ev.type === "agent_decision" && ev.agent_id) {
    set({ liveAgents: { ...s.liveAgents, [ev.agent_id]: ev.payload } });
  } else if (ev.type === "series") {
    const ls = s.liveSeries;
    const p = ev.payload;
    const by = { ...ls.by_agent_price };
    for (const [aid, val] of Object.entries(p.by_agent_price || {})) {
      by[aid] = [...(by[aid] || []), val as number];
    }
    set({
      liveSeries: {
        round: [...ls.round, ev.round],
        mean_price: [...ls.mean_price, p.mean_price],
        collusion_index: [...ls.collusion_index, p.collusion_index],
        total_profit: [...ls.total_profit, p.total_profit ?? 0],
        by_agent_price: by,
      },
    });
  }
}
