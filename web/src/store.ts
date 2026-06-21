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

// Live run accumulator. `cols` holds every numeric headline series the market emits
// (mean_price, collusion_index, inflation, return_pct, …) so any market streams faithfully
// into the replay view; `by_agent_price` is the per-agent line bundle.
interface LiveSeries {
  round: number[];
  by_agent_price: Record<string, number[]>;
  cols: Record<string, number[]>;
}
function emptySeries(): LiveSeries {
  return { round: [], by_agent_price: {}, cols: {} };
}

// Build a trace-shaped object from the in-progress live run so the Replay view can render
// a run AS IT STREAMS (chart + agent thinking), then settle into the real trace on done.
function buildLiveTrace(s: MWState): Trace {
  const ls = s.liveSeries;
  const T = ls.round.length;
  const agents: any[] = Object.entries(s.liveAgents).map(([id, a]: [string, any]) => ({
    id,
    price: a?.action?.price ?? a?.realized?.price ?? a?.price,
    profit: a?.realized?.profit ?? a?.profit,
    reasoning: a?.reasoning,
    beliefs: a?.beliefs,
    realized: a?.realized,
    action: a?.action,
  }));
  // only the latest frame carries agents (live thinking); earlier frames are placeholders
  const rounds = ls.round.map((rn, i) =>
    i === T - 1 ? { round: rn, news: s.liveNews, agents } : { round: rn, news: "", agents: [] },
  );
  return {
    schema_version: 0,
    run_name: s.runName,
    config: null,
    market: MECH_TO_TYPE[s.mech],
    granularity: s.granularity,
    T,
    benchmarks: s.liveBenchmarks || {},
    agents: agents.map((a) => ({ id: a.id, cohort: "", name: a.id, persona: "" })),
    series: { round: ls.round, by_agent_price: ls.by_agent_price, ...ls.cols },
    rounds: rounds as any,
    metrics: {},
  };
}

// the trace currently on screen: the live run while running, else the loaded/finished trace
export function viewTrace(s: MWState): Trace | null {
  return s.running && s.liveTrace ? s.liveTrace : s.trace;
}
// the round currently shown: pinned to the live edge while running, else the scrub position
export function viewRound(s: MWState): number {
  return s.running && s.liveTrace ? Math.max(0, s.liveTrace.T - 1) : s.round;
}
// the canonical "demo" trace for a market — the default the replay page shows when nothing
// is explicitly opened (mirrors the reference auto-loading its demo at startup)
export function goldenIdForMech(mech: Mech): string {
  return `golden/${PRESET_FILE[mech]}`;
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
const MECH_TO_SLUG: Record<string, string> = { fish: "oligopoly-pricing", econ: "econagent-macro", clob: "twinmarket-clob", blank: "new" };
const SLUG_TO_MECH: Record<string, Mech | "blank"> = { "oligopoly-pricing": "fish", "econagent-macro": "econ", "twinmarket-clob": "clob", "new": "blank" };
const LIB_TABS = new Set<string>(["traces", "markets", "schema", "settings"]);
type ConsoleSub =
  | { kind: "builtin"; id: Mech | "blank" }
  | { kind: "config" | "template"; id: string }
  | { kind: "tab"; tab: LibTab }
  | null;
function consoleSubFromPath(path: string): ConsoleSub {
  const cfgMatch = path.match(/^\/console\/config\/(.+)/);
  if (cfgMatch) return { kind: "config", id: decodeURIComponent(cfgMatch[1]) };
  const tplMatch = path.match(/^\/console\/template\/(.+)/);
  if (tplMatch) return { kind: "template", id: decodeURIComponent(tplMatch[1]) };
  const m = path.match(/^\/console\/([\w-]+)/);
  if (!m) return null;
  const seg = m[1];
  if (seg in SLUG_TO_MECH) return { kind: "builtin", id: SLUG_TO_MECH[seg] };
  if (LIB_TABS.has(seg)) return { kind: "tab", tab: seg as LibTab };
  return null;
}
function presetSlug(kind: "builtin" | "config" | "template" | null, id: string | null): string | null {
  if (!id || !kind) return null;
  if (kind === "builtin") return MECH_TO_SLUG[id] || id;
  if (kind === "config") return `config/${encodeURIComponent(id)}`;
  if (kind === "template") return `template/${encodeURIComponent(id)}`;
  return null;
}
function pushPath(s: Screen, sub?: string | null) {
  const base = SCREEN_PATH[s];
  const p = sub ? `${base}/${sub}` : base;
  if (location.pathname !== p) history.pushState({}, "", p);
}

export interface MWState {
  // navigation / selection
  screen: Screen;
  node: string | null; // "market" | "observation" | "scheduler" | "recorder" | "shock" | "cohort:<id>"
  view: CanvasView;
  mech: Mech;
  preset: string | null;
  presetKind: "builtin" | "config" | "template" | null;

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
  layers: { info: boolean; news: boolean };

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
  liveAgents: Record<string, any>; // agent_id -> last {beliefs, reasoning, action, realized}
  liveNews: string;
  liveTrace: Trace | null; // trace-shaped view of the in-progress run (drives Replay while running)
  metrics: Record<string, any>;

  // replay
  traceId: string | null;
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
  enterConsole: () => void;
  openPreset: (id: Mech | "blank") => void;
  selectNode: (n: string) => void;
  setView: (v: CanvasView) => void;
  setLibTab: (t: LibTab) => void;
  setMech: (m: Mech) => void;
  addCohort: () => void;
  removeCohort: (id: string) => void;
  updateCohort: (id: string, patch: Partial<Cohort>) => void;
  toggleLayer: (k: "info" | "news") => void;
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
  deleteSavedConfig: (id: string) => Promise<void>;
  refreshTemplates: () => void;
  publishConfig: (author: string) => Promise<string | null>;
  loadTemplate: (id: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  openExpanded: (id: string) => void;
  collapse: () => void;
  armRun: () => void;
  viewReplay: () => void;
  watchReplay: () => void;
  startRun: () => void;
  rerun: () => void;
  cancelRun: () => void;
  refreshTraces: () => void;
  saveTrace: (name?: string) => Promise<string | null>;
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
      social: false,
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
  presetKind: null,

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
  layers: { info: true, news: false },

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
  liveTrace: null,
  metrics: {},

  traceId: null,
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
  syncFromPath: () => {
    const screen = pathToScreen(location.pathname);
    if (screen !== "replay") get().pause(); // leaving replay via Back must stop playback
    if (screen === "console") {
      const sub = consoleSubFromPath(location.pathname);
      if (sub?.kind === "builtin" && sub.id !== get().preset) {
        get().openPreset(sub.id);
        return;
      }
      if (sub?.kind === "config" && sub.id !== get().preset) {
        get().loadSavedConfig(sub.id);
        return;
      }
      if (sub?.kind === "template" && sub.id !== get().preset) {
        get().loadTemplate(sub.id);
        return;
      }
      if (sub?.kind === "tab") {
        set({ screen, preset: null, presetKind: null, libTab: sub.tab });
        return;
      }
      if (!sub && get().preset) {
        set({ screen, preset: null, presetKind: null });
        return;
      }
    }
    if (screen === "replay") {
      const m = location.pathname.match(/^\/replay\/(.+)/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        if (id !== get().traceId) get().loadTrace(id);
        else set({ screen });
        return;
      }
      // bare /replay = new-run mode; clear the finished trace so the URL and the screen
      // agree (a loaded trace lives at /replay/<id>). Don't disturb a live run's view.
      if (!get().running) set({ screen, trace: null, traceId: null, liveTrace: null });
      else set({ screen });
      return;
    }
    set({ screen });
  },

  // return the console to its preset-picker start state
  backToPicker: () => {
    get().pause();
    const tab = get().libTab;
    pushPath("console", tab === "presets" ? null : tab);
    set({ preset: null, presetKind: null, running: false });
  },

  // enter the console from outside (landing / header). One history entry, and the URL
  // (/console = Presets) is kept consistent with the active tab — unlike backToPicker(),
  // which preserves whatever library tab you were last on.
  enterConsole: () => {
    get().pause();
    pushPath("console");
    set({ screen: "console", preset: null, presetKind: null, running: false, libTab: "presets" });
  },

  openPreset: (id) => {
    const blank = id === "blank";
    const mech: Mech = blank ? "fish" : (id as Mech);
    const spec = getMarket(mech);
    const d = loadDefaults(); // Settings-page defaults for new from-scratch worlds
    pushPath("console", MECH_TO_SLUG[id] || id);
    // scaffold a complete, engine-valid config from the registry; for a shipped
    // preset, the fetch below overrides it with the exact golden config.
    set({
      screen: "console",
      preset: id,
      presetKind: "builtin",
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
      layers: { info: true, news: true },
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
  setLibTab: (t) => {
    pushPath("console", t === "presets" ? null : t);
    set({ libTab: t });
  },

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
      pushPath("console", `config/${encodeURIComponent(id)}`);
      set({ preset: id, presetKind: "config" });
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
      pushPath("console", `config/${encodeURIComponent(id)}`);
      set({
        screen: "console",
        presetKind: "config",
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

  // delete a private saved config (configs/) — independent of any published template
  deleteSavedConfig: async (id) => {
    try {
      await fetch(`/api/configs/${id}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    get().refreshConfigs();
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
      pushPath("console", `template/${encodeURIComponent(id)}`);
      set({
        screen: "console",
        presetKind: "template",
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

  // un-publish a Markets template (templates/) — independent of the private saved config
  deleteTemplate: async (id) => {
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    get().refreshTemplates();
  },

  // the pipeline drawer lives in the World/arena canvas, so opening it must also switch
  // there — otherwise the Roster/Engine views and the right-rail Inspector trigger it
  // while it's unmounted and nothing visibly happens.
  openExpanded: (id) => set({ expanded: id, node: `cohort:${id}`, view: "arena" }),
  collapse: () => set({ expanded: null }),

  // console "Run" → the replay page in NEW-RUN mode: an empty scaffold of the configured
  // world (no values yet) that you launch with Run, or switch to Replay to watch a past
  // run. Clears any loaded trace so nothing reads as already-computed.
  armRun: () => {
    get().pause();
    pushPath("replay");
    set({ screen: "replay", running: false, trace: null, traceId: null, liveTrace: null, round: 0 });
  },

  // top-bar "Replay" toggle: leave new-run mode by loading a real trace (the current
  // market's golden as a default); a no-op when one is already open.
  viewReplay: () => {
    const s = get();
    if (!s.trace) get().loadTrace(goldenIdForMech(s.mech));
  },

  // landing / docs "Watch a replay" CTA: go to the replay screen showing a REAL trace
  // (not the empty new-run scaffold). loadTrace navigates + pushes /replay/<id> itself,
  // so this is a single history entry that lands on actual data.
  watchReplay: () => {
    const s = get();
    get().pause();
    if (s.trace) get().nav("replay");
    else get().loadTrace(goldenIdForMech(s.mech));
  },

  startRun: () => {
    const s = get();
    if (s.cohorts.length === 0) return; // nothing to settle yet — add a cohort first
    get().pause(); // stop any replay playback before taking over the view
    const fresh = { ...s, liveSeries: emptySeries(), liveAgents: {}, liveNews: "", liveBenchmarks: {} };
    pushPath("replay");
    set({
      screen: "replay",
      running: true,
      liveSeries: emptySeries(),
      liveRound: 0,
      liveAgents: {},
      liveNews: "",
      liveBenchmarks: {},
      liveTrace: buildLiveTrace(fresh as MWState), // empty (T=0) stub → Replay shows "starting…", not the golden
      round: 0,
      metrics: {},
    });
    s.send({ type: "run.start", config: buildConfig(s) });
  },

  // Replay-page Run: re-run the loaded trace's own config when one is open (faithful
  // re-run of what you're watching), else just run the current editor config.
  rerun: () => {
    const s = get();
    if (s.running) return;
    const cfg = s.trace?.config;
    // tag the replayed world as an unsaved/derived config (preset=null) instead of
    // leaving it under whatever preset the editor happened to be on.
    if (cfg && cfg.market) get().applyConfig(cfg, null);
    get().startRun();
  },

  cancelRun: () => {
    get().send({ type: "run.cancel", runId: get().runId });
    set({ running: false, runId: null });
  },

  refreshTraces: () => {
    fetch("/api/traces")
      .then((r) => (r.ok ? r.json() : []))
      .then((traces: TraceMeta[]) => set({ traces: traces || [] }))
      .catch(() => {});
  },

  // persist a kept, named copy of the currently loaded trace (won't be clobbered by re-runs)
  saveTrace: async (name) => {
    const s = get();
    const id = s.traceId;
    if (!id) return null;
    try {
      const r = await fetch("/api/traces/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: name || s.trace?.run_name || id }),
      });
      if (!r.ok) return null;
      const { id: newId } = await r.json();
      get().refreshTraces();
      return newId as string;
    } catch {
      return null;
    }
  },

  loadTrace: async (id) => {
    get().pause(); // never leave a playback timer running on the previous trace
    try {
      const r = await fetch(`/api/traces/${id}`);
      if (!r.ok) return;
      const trace = (await r.json()) as Trace;
      pushPath("replay", encodeURIComponent(id));
      set({ traceId: id, trace, round: 0, screen: "replay", mech: TYPE_TO_MECH[trace.market] || "fish" });
    } catch {
      /* network/parse failure — keep the current view rather than crashing on an unhandled rejection */
    }
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
  // The WebSocket is reused across runs. Drop stragglers from a previous/cancelled run so
  // their buffered events can't splice onto — or prematurely end — the current run.
  if (m.runId && m.type !== "run.started" && m.runId !== get().runId) return;
  switch (m.type) {
    case "hello":
      set({ presets: m.presets || [], traces: m.traces || [] });
      break;
    case "run.started":
      set({ runId: m.runId, running: true });
      break;
    case "round":
      applyEvent(m.event, set, get);
      if (get().running) set({ liveTrace: buildLiveTrace(get()) });
      break;
    case "run.done":
      set({ running: false, runId: null, liveTrace: null, metrics: m.metrics || {} });
      // refresh trace library then auto-open replay on the finished trace
      fetch("/api/traces")
        .then((r) => r.json())
        .then((traces) => set({ traces }))
        .catch(() => {});
      get().loadTrace(m.traceId);
      break;
    case "run.error":
      set({ running: false, runId: null });
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
    set({ liveAgents: { ...s.liveAgents, [ev.agent_id]: { ...(s.liveAgents[ev.agent_id] || {}), ...ev.payload } } });
  } else if (ev.type === "settle" && ev.agent_id) {
    // fold the per-agent realized outcome (price/profit) onto its decision for the thinking cards
    const prev = s.liveAgents[ev.agent_id] || {};
    set({ liveAgents: { ...s.liveAgents, [ev.agent_id]: { ...prev, realized: ev.payload } } });
  } else if (ev.type === "series") {
    const ls = s.liveSeries;
    const p = ev.payload || {};
    const by = { ...ls.by_agent_price };
    for (const [aid, val] of Object.entries(p.by_agent_price || {})) {
      by[aid] = [...(by[aid] || []), val as number];
    }
    // accumulate every numeric headline series the market emits (mean_price, inflation, …)
    const cols = { ...ls.cols };
    for (const [k, val] of Object.entries(p)) {
      if (k === "by_agent_price") continue;
      if (typeof val === "number") cols[k] = [...(cols[k] || []), val];
    }
    set({ liveSeries: { round: [...ls.round, ev.round], by_agent_price: by, cols } });
  }
}
