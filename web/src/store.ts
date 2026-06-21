import { create } from "zustand";
import type {
  Benchmarks, Cohort, CanvasView, LibTab, Mech, PolicyCfg, PresetMeta, SavedConfigMeta,
  Screen, ShockConfig, TemplateMeta, Trace, TraceMeta,
} from "./types";
import { defaultParams, getMarket } from "./console/marketFields";
import { loadDefaults } from "./lib/defaults";

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
// shipped preset file id per market (differs from the engine market.type)
const PRESET_FILE: Record<Mech, string> = {
  fish: "fish_calvano",
  econ: "econagent_macro",
  clob: "clob_twinmarket",
};

const DEFAULT_POLICY: PolicyCfg = { model: "claude-opus-4-8", use_cache: true, max_concurrency: 5 };

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
  blog: "/blog",
  console: "/console",
  replay: "/replay",
};
function pathToScreen(path: string): Screen {
  if (path.startsWith("/console") || path.startsWith("/presets")) return "console";
  if (path.startsWith("/replay")) return "replay";
  if (path.startsWith("/docs")) return "docs";
  if (path.startsWith("/blog")) return "blog";
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

  // world config — every field maps 1:1 onto the engine Config
  cohorts: Cohort[];
  marketParams: Record<string, any>;
  rounds: number;
  seed: number;
  runName: string;
  granularity: string;
  reflectEvery: number;
  shock: ShockConfig | null;
  policyCfg: PolicyCfg;
  expanded: string | null; // cohort id whose pipeline drawer is open
  layers: { info: boolean; institution: boolean; social: boolean; news: boolean };

  // connection + library
  connected: boolean;
  presets: PresetMeta[];
  traces: TraceMeta[];
  savedConfigs: SavedConfigMeta[];
  publishedTemplates: TemplateMeta[]; // configs published to Markets
  showConfig: boolean; // raw config (JSON) viewer open?
  libTab: LibTab; // active console tab — persisted so "Back" returns to its origin

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
  setLibTab: (t: LibTab) => void;
  setMech: (m: Mech) => void;
  addCohort: () => void;
  removeCohort: (id: string) => void;
  updateCohort: (id: string, patch: Partial<Cohort>) => void;
  toggleLayer: (k: "info" | "institution" | "social" | "news") => void;
  setMarketParam: (key: string, value: any) => void;
  setRounds: (n: number) => void;
  setSeed: (n: number) => void;
  setRunName: (s: string) => void;
  setGranularity: (g: string) => void;
  setReflectEvery: (n: number) => void;
  setShock: (patch: Partial<ShockConfig> | null) => void;
  setPolicyCfg: (patch: Partial<PolicyCfg>) => void;
  applyConfig: (cfg: any, preset?: string | null) => void;
  toggleConfigView: () => void;
  refreshConfigs: () => void;
  saveCurrentConfig: (name?: string) => Promise<string | null>;
  loadSavedConfig: (id: string) => Promise<void>;
  refreshTemplates: () => void;
  publishConfig: (author: string) => Promise<string | null>;
  loadTemplate: (id: string) => Promise<void>;
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

export function buildConfig(s: MWState) {
  const mech = s.mech;
  const spec = getMarket(mech);
  return {
    seed: s.seed,
    rounds: s.rounds,
    run_name: s.runName || `${mech}_console`,
    market: { type: MECH_TO_TYPE[mech], params: { ...s.marketParams } },
    cohorts: s.cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      n: c.n,
      persona: c.persona,
      policy: c.policy || "deterministic",
      profile: c.profile || {},
      initial_state: c.initial_state || {},
      memory: c.memory || spec.defaultMemory,
      reflection: c.reflection || spec.defaultReflection,
    })),
    // Only `news` and `shock` are engine-functional; the rest are the visual
    // world layers and are carried through faithfully but ignored by the engine.
    layers: {
      observation: s.layers.info,
      institution_fiscal: false,
      institution_monetary: false,
      production: false,
      social: s.layers.social,
      news: s.layers.news,
      shock: s.shock,
    },
    scheduler: { granularity: s.granularity, reflect_every: Math.max(1, s.reflectEvery) },
    policy: { ...s.policyCfg },
  };
}

export const useStore = create<MWState>((set, get) => ({
  screen: pathToScreen(location.pathname),
  node: "market",
  view: "arena",
  mech: "fish",
  preset: null,

  cohorts: getMarket("fish").starterCohorts(),
  marketParams: defaultParams("fish"),
  rounds: getMarket("fish").defaultRounds,
  seed: 7,
  runName: "fish_console",
  granularity: getMarket("fish").granularity,
  reflectEvery: getMarket("fish").reflectEvery,
  shock: null,
  policyCfg: { ...DEFAULT_POLICY },
  expanded: null,
  layers: { info: true, institution: false, social: false, news: false },

  connected: false,
  presets: [],
  traces: [],
  savedConfigs: [],
  publishedTemplates: [],
  showConfig: false,
  libTab: "presets",

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
    const blank = id === "blank";
    const mech: Mech = blank ? "fish" : (id as Mech);
    const spec = getMarket(mech);
    const d = loadDefaults(); // Settings-page defaults for new from-scratch worlds
    pushPath("console");
    // scaffold a complete, engine-valid config from the registry; for a shipped
    // preset, the fetch below overrides it with the exact golden config.
    set({
      screen: "console",
      preset: id,
      mech,
      node: "market",
      view: "arena",
      expanded: null,
      showConfig: false,
      rounds: spec.defaultRounds,
      marketParams: defaultParams(mech),
      // blank = a true from-0 start: no cohorts, the user picks a market and adds them
      cohorts: blank ? [] : spec.starterCohorts(),
      seed: blank ? d.seed : 7,
      runName: blank ? "untitled" : spec.type,
      granularity: spec.granularity,
      reflectEvery: spec.reflectEvery,
      shock: null,
      policyCfg: { model: d.model, use_cache: d.useCache, max_concurrency: d.maxConcurrency },
      layers: { info: true, institution: mech === "econ", social: mech === "clob", news: true },
      liveSeries: emptySeries(),
      liveRound: 0,
      metrics: {},
    });
    get().refreshConfigs();
    get().refreshTemplates();
    if (!blank) {
      fetch(`/api/presets/${PRESET_FILE[mech]}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((cfg) => {
          if (cfg) get().applyConfig(cfg, id);
        })
        .catch(() => {});
    }
  },

  selectNode: (n) => set({ node: n }),
  setView: (v) => set({ view: v }),
  setLibTab: (t) => set({ libTab: t }),

  setMech: (m) => {
    const spec = getMarket(m);
    // in a from-0 (blank) session, switching the market keeps the roster empty so
    // the user builds it for the new market; presets/saved configs reset to starters.
    const blank = get().preset === "blank";
    set({
      mech: m,
      marketParams: defaultParams(m),
      rounds: spec.defaultRounds,
      granularity: spec.granularity,
      reflectEvery: spec.reflectEvery,
      cohorts: blank ? [] : spec.starterCohorts(),
      shock: null,
      node: "market",
      expanded: null,
    });
  },

  addCohort: () =>
    set((s) => {
      const co = getMarket(s.mech).newCohort(s.cohorts.length + 1);
      // keep ids unique even if the user has removed/re-added cohorts
      let id = co.id;
      let k = 1;
      while (s.cohorts.some((c) => c.id === id)) id = `${co.id}_${k++}`;
      return { cohorts: [...s.cohorts, { ...co, id }] };
    }),

  removeCohort: (id) =>
    set((s) => ({
      cohorts: s.cohorts.filter((c) => c.id !== id),
      node: s.node === `cohort:${id}` ? "market" : s.node,
      expanded: s.expanded === id ? null : s.expanded,
    })),

  updateCohort: (id, patch) =>
    set((s) => ({ cohorts: s.cohorts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),

  setMarketParam: (key, value) =>
    set((s) => ({ marketParams: { ...s.marketParams, [key]: value } })),
  setRounds: (n) => set({ rounds: Math.max(1, Math.floor(n) || 1) }),
  setSeed: (n) => set({ seed: Math.floor(n) || 0 }),
  setRunName: (str) => set({ runName: str }),
  setGranularity: (g) => set({ granularity: g }),
  setReflectEvery: (n) => set({ reflectEvery: Math.max(1, Math.floor(n) || 1) }),
  setShock: (patch) =>
    set((s) =>
      patch === null
        ? { shock: null }
        : { shock: { round: 24, kind: "cost_jump", magnitude: 0.1, ...(s.shock || {}), ...patch } },
    ),
  setPolicyCfg: (patch) => set((s) => ({ policyCfg: { ...s.policyCfg, ...patch } })),
  toggleConfigView: () => set((s) => ({ showConfig: !s.showConfig })),

  // Map an engine Config object into the editable store (preset fetch + saved-config load).
  applyConfig: (cfg, preset) => {
    if (!cfg || !cfg.market) return;
    const mech: Mech = TYPE_TO_MECH[cfg.market.type] || "fish";
    const spec = getMarket(mech);
    const sh = cfg.layers?.shock;
    const lay = cfg.layers || {};
    set((s) => ({
      mech,
      preset: preset !== undefined ? preset : s.preset,
      marketParams: { ...defaultParams(mech), ...(cfg.market.params || {}) },
      cohorts: (cfg.cohorts && cfg.cohorts.length ? cfg.cohorts : spec.starterCohorts()) as Cohort[],
      rounds: cfg.rounds ?? spec.defaultRounds,
      seed: cfg.seed ?? 0,
      runName: cfg.run_name || spec.type,
      granularity: cfg.scheduler?.granularity || spec.granularity,
      reflectEvery: cfg.scheduler?.reflect_every ?? spec.reflectEvery,
      shock: sh
        ? { round: Number(sh.round ?? -1), kind: sh.kind || "cost_jump", magnitude: Number(sh.magnitude ?? 0.1) }
        : null,
      policyCfg: {
        model: cfg.policy?.model || DEFAULT_POLICY.model,
        use_cache: cfg.policy?.use_cache !== false,
        max_concurrency: Number(cfg.policy?.max_concurrency ?? DEFAULT_POLICY.max_concurrency),
      },
      layers: {
        info: lay.observation !== false,
        institution: mech === "econ",
        social: !!lay.social || mech === "clob",
        news: lay.news !== false,
      },
      node: "market",
      expanded: null,
    }));
  },

  refreshConfigs: () => {
    fetch("/api/configs")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        // server may return plain string ids or {id,...} metadata objects
        const metas: SavedConfigMeta[] = (list || []).map((c) =>
          typeof c === "string" ? { id: c } : (c as SavedConfigMeta),
        );
        set({ savedConfigs: metas });
      })
      .catch(() => {});
  },

  saveCurrentConfig: async (name) => {
    const s = get();
    const config = buildConfig(s);
    try {
      const r = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || s.runName || config.run_name, config }),
      });
      if (!r.ok) return null;
      const { id } = await r.json();
      get().refreshConfigs();
      return id as string;
    } catch {
      return null;
    }
  },

  loadSavedConfig: async (id) => {
    try {
      const r = await fetch(`/api/configs/${id}`);
      if (!r.ok) return;
      const cfg = await r.json();
      pushPath("console");
      set({
        screen: "console",
        view: "arena",
        node: "market",
        expanded: null,
        showConfig: false,
        liveSeries: emptySeries(),
        liveRound: 0,
        metrics: {},
      });
      get().applyConfig(cfg, id);
    } catch {
      /* ignore */
    }
  },

  refreshTemplates: () => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: TemplateMeta[]) => set({ publishedTemplates: list || [] }))
      .catch(() => {});
  },

  // publish the current world to Markets under an author nickname
  publishConfig: async (author) => {
    const s = get();
    const config = buildConfig(s);
    try {
      const r = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: s.runName || config.run_name, author, config }),
      });
      if (!r.ok) return null;
      const { id } = await r.json();
      get().refreshTemplates();
      return id as string;
    } catch {
      return null;
    }
  },

  loadTemplate: async (id) => {
    try {
      const r = await fetch(`/api/templates/${id}`);
      if (!r.ok) return;
      const cfg = await r.json();
      pushPath("console");
      set({
        screen: "console",
        view: "arena",
        node: "market",
        expanded: null,
        showConfig: false,
        liveSeries: emptySeries(),
        liveRound: 0,
        metrics: {},
      });
      get().applyConfig(cfg, id);
    } catch {
      /* ignore */
    }
  },

  openExpanded: (id) => set({ expanded: id, node: `cohort:${id}` }),
  collapse: () => set({ expanded: null }),

  startRun: () => {
    const s = get();
    if (s.cohorts.length === 0) return; // nothing to settle yet — add a cohort first
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
