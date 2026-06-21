import type { CSSProperties } from "react";
import { useStore } from "../../store";
import type { Mech } from "../../types";
import {
  getMarket, GRANULARITIES, MEMORY_KINDS, REFLECTION_KINDS, SHOCK_KINDS,
  type FieldSpec,
} from "../marketFields";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", fontFamily: mono, fontSize: 12.5,
  color: "var(--green-d)", background: "#f7faf8", border: "1px solid var(--border)",
  borderRadius: 8, padding: "7px 9px",
};

// ---- small bound controls (match the console's inline-style idiom) ----
function Row({ label, hint, children }: { label: string; hint?: string; children: any }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</label>
        {hint && <span style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Num({ value, onChange, step, min }: { value: number; onChange: (n: number) => void; step?: number; min?: number }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      step={step ?? "any"}
      min={min}
      onChange={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) onChange(n); }}
      style={inputStyle}
    />
  );
}

function Text({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
}

function Area({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.4 }} />;
}

function Enum({ value, options, onChange }: { value: string; options: string[]; onChange: (s: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Bool({ value, onChange }: { value: boolean; onChange: (b: boolean) => void }) {
  return (
    <div style={{ display: "flex", background: "#f3f5f2", borderRadius: 9, padding: 3, gap: 3 }}>
      {[true, false].map((v) => {
        const on = value === v;
        return (
          <span
            key={String(v)}
            onClick={() => onChange(v)}
            style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: on ? 600 : 500, padding: 7, borderRadius: 7, cursor: "pointer", background: on ? "#fff" : "transparent", color: on ? "var(--green-d)" : "var(--muted)", boxShadow: on ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}
          >
            {v ? "On" : "Off"}
          </span>
        );
      })}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange, color = "var(--green-d)" }: { value: T; options: [T, string][]; onChange: (v: T) => void; color?: string }) {
  return (
    <div style={{ display: "flex", background: "#f3f5f2", borderRadius: 9, padding: 3, gap: 3 }}>
      {options.map(([v, label]) => {
        const on = value === v;
        return (
          <span
            key={v}
            onClick={() => onChange(v)}
            style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: on ? 600 : 500, padding: 8, borderRadius: 7, cursor: "pointer", background: on ? "#fff" : "transparent", color: on ? color : "var(--muted)", boxShadow: on ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: any }) {
  return <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", margin: "4px 0 8px" }}>{children}</div>;
}

// Render one registry FieldSpec bound to a plain object (params/profile/initial_state).
function SpecField({ f, bag, onSet }: { f: FieldSpec; bag: Record<string, any>; onSet: (key: string, value: any) => void }) {
  const val = bag[f.key] ?? f.default;
  return (
    <Row label={f.label} hint={f.hint}>
      {f.type === "bool" ? (
        <Bool value={val !== false} onChange={(b) => onSet(f.key, b)} />
      ) : f.type === "enum" ? (
        <Enum value={String(val)} options={f.options || []} onChange={(v) => onSet(f.key, v)} />
      ) : f.type === "text" ? (
        <Text value={String(val ?? "")} onChange={(v) => onSet(f.key, v)} />
      ) : (
        <Num value={Number(val)} step={f.step} min={f.min} onChange={(n) => onSet(f.key, f.type === "int" ? Math.round(n) : n)} />
      )}
    </Row>
  );
}

const POLICY_OPTS: ["deterministic" | "claude", string][] = [
  ["deterministic", "Deterministic"],
  ["claude", "Claude (live)"],
];

const BADGES = {
  i: { bg: "var(--indigo-l)", fg: "var(--indigo)" },
  a: { bg: "#f7efe2", fg: "var(--amber)" },
  g: { bg: "var(--green-l)", fg: "var(--green-d)" },
};

export function Inspector() {
  const node = useStore((s) => s.node);
  const mech = useStore((s) => s.mech);
  const spec = getMarket(mech);

  // header glyph/title/badge per node
  let glyph = "⊞", title = "Market · Mechanism", badge: keyof typeof BADGES = "i", sub = spec.blurb;
  if (node?.startsWith("cohort:")) { glyph = "◎"; badge = "g"; }
  else if (node === "observation") { glyph = "◇"; title = "Observation"; badge = "g"; sub = "What each agent sees, and the world-layer toggles. Only the news layer changes the run."; }
  else if (node === "scheduler") { glyph = "◷"; title = "Scheduler & run"; badge = "g"; sub = "Clock, horizon, seed and the LLM policy used when an agent runs on Claude."; }
  else if (node === "recorder") { glyph = "▤"; title = "Recorder"; badge = "g"; sub = "Logs state + metrics each round, computes benchmarks, exports the trace."; }
  else if (node === "shock") { glyph = "⚡"; title = "Shock (optional)"; badge = "a"; sub = "An optional intervention the Scheduler injects at a chosen round."; }

  const b = BADGES[badge];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: b.bg, color: b.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{glyph}</span>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>{title}</span>
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--muted)", margin: "6px 0 16px" }}>{sub}</p>

      {node === "market" && <MarketPanel />}
      {node === "observation" && <ObservationPanel />}
      {node === "scheduler" && <SchedulerPanel />}
      {node === "recorder" && <RecorderPanel />}
      {node === "shock" && <ShockPanel />}
      {node?.startsWith("cohort:") && <CohortPanel id={node.slice(7)} />}
    </div>
  );
}

function MarketPanel() {
  const mech = useStore((s) => s.mech);
  const setMech = useStore((s) => s.setMech);
  const marketParams = useStore((s) => s.marketParams);
  const setMarketParam = useStore((s) => s.setMarketParam);
  const spec = getMarket(mech);

  const mechs: [Mech, string][] = [["fish", "Fish"], ["econ", "EconAgent"], ["clob", "CLOB"]];
  return (
    <>
      <SectionLabel>Market block · swappable</SectionLabel>
      <div style={{ marginBottom: 16 }}>
        <Seg value={mech} options={mechs} onChange={(m) => setMech(m)} color="var(--indigo)" />
      </div>
      <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>type · {spec.type}</div>
      <SectionLabel>Parameters</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {spec.params.map((f) => (
          <SpecField key={f.key} f={f} bag={marketParams} onSet={setMarketParam} />
        ))}
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
        agents → market → observation
      </div>
    </>
  );
}

function ObservationPanel() {
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const items: { k: "info" | "social" | "news"; label: string; note: string }[] = [
    { k: "info", label: "Observation", note: "agents see price · macro · news" },
    { k: "social", label: "Social network", note: "peer ties (world view)" },
    { k: "news", label: "News / shock feed", note: "emits a news string each round" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((it) => (
        <Row key={it.k} label={it.label} hint={it.k === "news" ? "engine" : "view"}>
          <Bool value={layers[it.k]} onChange={() => toggleLayer(it.k)} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>{it.note}</div>
        </Row>
      ))}
      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
        market → observation → scheduler
      </div>
    </div>
  );
}

function SchedulerPanel() {
  const rounds = useStore((s) => s.rounds);
  const setRounds = useStore((s) => s.setRounds);
  const granularity = useStore((s) => s.granularity);
  const setGranularity = useStore((s) => s.setGranularity);
  const reflectEvery = useStore((s) => s.reflectEvery);
  const setReflectEvery = useStore((s) => s.setReflectEvery);
  const seed = useStore((s) => s.seed);
  const setSeed = useStore((s) => s.setSeed);
  const runName = useStore((s) => s.runName);
  const setRunName = useStore((s) => s.setRunName);
  const policyCfg = useStore((s) => s.policyCfg);
  const setPolicyCfg = useStore((s) => s.setPolicyCfg);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <Row label="rounds T" hint="int"><Num value={rounds} min={1} step={1} onChange={setRounds} /></Row>
      <Row label="granularity" hint="clock"><Enum value={granularity} options={GRANULARITIES} onChange={setGranularity} /></Row>
      <Row label="reflect every" hint="rounds"><Num value={reflectEvery} min={1} step={1} onChange={setReflectEvery} /></Row>
      <Row label="seed" hint="determinism"><Num value={seed} step={1} onChange={setSeed} /></Row>
      <Row label="run name" hint="trace id"><Text value={runName} onChange={setRunName} /></Row>

      <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
      <SectionLabel>LLM policy · claude agents only</SectionLabel>
      <Row label="model" hint="anthropic id"><Text value={policyCfg.model} onChange={(v) => setPolicyCfg({ model: v })} /></Row>
      <Row label="max concurrency" hint="int"><Num value={policyCfg.max_concurrency} min={1} step={1} onChange={(n) => setPolicyCfg({ max_concurrency: Math.round(n) })} /></Row>
      <Row label="response cache" hint="reuse"><Bool value={policyCfg.use_cache} onChange={(b) => setPolicyCfg({ use_cache: b })} /></Row>

      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
        observation → scheduler → recorder
      </div>
    </div>
  );
}

function RecorderPanel() {
  const mech = useStore((s) => s.mech);
  const spec = getMarket(mech);
  const rows = [
    { label: "headline series", value: spec.benchmarks.length ? "price + benchmarks" : "price", hint: "plot" },
    { label: "benchmarks", value: spec.benchmarks.join(", ") || "—", hint: "computed" },
    { label: "export", value: "trace.json", hint: "file" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {rows.map((r, i) => (
        <Row key={i} label={r.label} hint={r.hint}>
          <div style={{ ...inputStyle, background: "#f4f6f3" }}>{r.value}</div>
        </Row>
      ))}
      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
        recorder → ↻ next round
      </div>
    </div>
  );
}

function ShockPanel() {
  const shock = useStore((s) => s.shock);
  const setShock = useStore((s) => s.setShock);
  const enabled = !!shock;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <Row label="inject shock" hint="optional">
        <Bool value={enabled} onChange={(b) => setShock(b ? { round: 24, kind: "cost_jump", magnitude: 0.1 } : null)} />
      </Row>
      {enabled && shock && (
        <>
          <Row label="at round" hint="int"><Num value={shock.round} step={1} onChange={(n) => setShock({ round: Math.round(n) })} /></Row>
          <Row label="kind" hint="market-defined"><Enum value={shock.kind} options={Array.from(new Set([...SHOCK_KINDS, shock.kind]))} onChange={(v) => setShock({ kind: v })} /></Row>
          <Row label="magnitude" hint="fraction"><Num value={shock.magnitude} step={0.05} onChange={(n) => setShock({ magnitude: n })} /></Row>
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
            Only the Fish market reacts to <span style={{ fontFamily: mono }}>cost_jump</span> (cost ×(1+magnitude)). Other markets ignore the shock.
          </div>
        </>
      )}
      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
        scheduler → shock → market
      </div>
    </div>
  );
}

function CohortPanel({ id }: { id: string }) {
  const cohorts = useStore((s) => s.cohorts);
  const mech = useStore((s) => s.mech);
  const updateCohort = useStore((s) => s.updateCohort);
  const removeCohort = useStore((s) => s.removeCohort);
  const openExpanded = useStore((s) => s.openExpanded);
  const spec = getMarket(mech);
  const co = cohorts.find((c) => c.id === id) || cohorts[0];
  if (!co) return null;

  const patchProfile = (k: string, v: any) => updateCohort(co.id, { profile: { ...(co.profile || {}), [k]: v } });
  const patchState = (k: string, v: any) => updateCohort(co.id, { initial_state: { ...(co.initial_state || {}), [k]: v } });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <div
        onClick={() => openExpanded(co.id)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid var(--green)", background: "var(--green-l)", borderRadius: 10, padding: "10px 13px", cursor: "pointer" }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--green-d)" }}>Open internal pipeline</span>
        <span style={{ fontSize: 13, color: "var(--green-d)" }}>▸</span>
      </div>

      <Row label="name" hint="label"><Text value={co.name} onChange={(v) => updateCohort(co.id, { name: v })} /></Row>
      <Row label="count ×" hint="int"><Num value={co.n} min={1} step={1} onChange={(n) => updateCohort(co.id, { n: Math.max(1, Math.round(n)) })} /></Row>
      <Row label="persona / prompt" hint="text"><Area value={co.persona} onChange={(v) => updateCohort(co.id, { persona: v })} /></Row>

      <SectionLabel>Decision policy</SectionLabel>
      <Seg
        value={((co.policy as "deterministic" | "claude") || "deterministic")}
        options={POLICY_OPTS}
        onChange={(p) => updateCohort(co.id, { policy: p })}
      />

      <Row label="memory" hint="kind"><Enum value={co.memory || spec.defaultMemory} options={MEMORY_KINDS} onChange={(v) => updateCohort(co.id, { memory: v })} /></Row>
      <Row label="reflection" hint="kind"><Enum value={co.reflection || spec.defaultReflection} options={REFLECTION_KINDS} onChange={(v) => updateCohort(co.id, { reflection: v })} /></Row>

      {spec.profileFields.length > 0 && (
        <>
          <SectionLabel>Profile · {spec.action}</SectionLabel>
          {spec.profileFields.map((f) => (
            <SpecField key={"p_" + f.key} f={f} bag={co.profile || {}} onSet={patchProfile} />
          ))}
        </>
      )}
      {spec.stateFields.length > 0 && (
        <>
          <SectionLabel>Initial state</SectionLabel>
          {spec.stateFields.map((f) => (
            <SpecField key={"s_" + f.key} f={f} bag={co.initial_state || {}} onSet={patchState} />
          ))}
        </>
      )}

      <button
        onClick={() => removeCohort(co.id)}
        style={{ marginTop: 4, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: "#a8443c", background: "#fbf1f0", border: "1px solid #ecd5d2", borderRadius: 9, padding: "9px 12px", cursor: "pointer" }}
      >
        Delete agent
      </button>

      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
        agent → market (synchronous settlement)
      </div>
    </div>
  );
}
