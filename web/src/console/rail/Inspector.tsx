import { useEffect, useState, type CSSProperties } from "react";
import { useStore } from "../../store";
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
  // Hold the raw text locally so the field can be cleared or hold a partial number
  // ("", "2.", "-") while typing; the store only sees finite values, and we re-sync the
  // text from the canonical value whenever it changes from outside (preset load, clamp).
  const [raw, setRaw] = useState(Number.isFinite(value) ? String(value) : "");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setRaw(Number.isFinite(value) ? String(value) : "");
  }, [value, focused]);
  return (
    <input
      type="number"
      value={raw}
      step={step ?? "any"}
      min={min}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setRaw(Number.isFinite(value) ? String(value) : ""); }}
      onChange={(e) => {
        setRaw(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      style={inputStyle}
    />
  );
}

function Text({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
}

function Area({ value, onChange, rows = 2, placeholder }: { value: string; onChange: (s: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={rows} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.4 }} />;
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

const POLICY_OPTS: ["claude" | "replay", string][] = [
  ["claude", "Claude (live)"],
  ["replay", "Replay (recorded)"],
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
  if (node?.startsWith("agent:")) { glyph = "◎"; title = "Agent"; badge = "g"; sub = "One individual agent — edit its name, clone count, trait bag, persona and system prompt. Memory, reflection and decision policy are system-level (the Scheduler panel)."; }
  else if (node?.startsWith("cohort:")) { glyph = "⌗"; title = "Generator (archetype)"; badge = "g"; sub = "An archetype that samples N agents into the roster. Edit its defaults + how many it generates."; }
  else if (node === "observation") { glyph = "◇"; title = "Observation"; badge = "g"; sub = "What each agent sees, and the world-layer toggles. Only the news layer changes the run."; }
  else if (node === "scheduler") { glyph = "◷"; title = "Scheduler & run"; badge = "g"; sub = "Clock, horizon, seed and the LLM policy used when an agent runs on Claude."; }
  else if (node === "recorder") { glyph = "▤"; title = "Question"; badge = "g"; sub = "The prompt posed to each agent every round — its tool answer is its action."; }
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
      {node?.startsWith("agent:") && <AgentPanel id={node.slice(6)} />}
    </div>
  );
}

// one editable trait row: key (renamed on blur), value (number/text), remove. Local key state
// so typing doesn't remount the row on every keystroke.
function TraitRow({ agentId, k0, v }: { agentId: string; k0: string; v: any }) {
  const renameAgentTrait = useStore((s) => s.renameAgentTrait);
  const updateAgentTrait = useStore((s) => s.updateAgentTrait);
  const removeAgentTrait = useStore((s) => s.removeAgentTrait);
  const [k, setK] = useState(k0);
  useEffect(() => setK(k0), [k0]);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        value={k}
        spellCheck={false}
        onChange={(e) => setK(e.target.value)}
        onBlur={() => { if (k && k !== k0) renameAgentTrait(agentId, k0, k); else setK(k0); }}
        style={{ ...inputStyle, width: 92, flex: "none", padding: "7px 8px", color: "var(--muted)" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {typeof v === "number"
          ? <Num value={v} onChange={(n) => updateAgentTrait(agentId, k0, n)} />
          : <Text value={String(v)} onChange={(t) => updateAgentTrait(agentId, k0, t)} />}
      </div>
      <span onClick={() => removeAgentTrait(agentId, k0)} title="remove trait" style={{ fontSize: 16, color: "#c2ccc4", cursor: "pointer", flex: "none", lineHeight: 1 }}>×</span>
    </div>
  );
}

// One individual agent — the only unit in the merged model. Edit its name, clone count, its
// trait bag (add/rename/remove entries), persona and system prompt. Memory/reflection/policy
// are system-level (the Scheduler · System panel), not per-agent.
function AgentPanel({ id }: { id: string }) {
  const agents = useStore((s) => s.agents);
  const roster = useStore((s) => s.roster);
  const cohorts = useStore((s) => s.cohorts);
  const mech = useStore((s) => s.mech);
  const updateAgent = useStore((s) => s.updateAgent);
  const updateAgentTrait = useStore((s) => s.updateAgentTrait);
  const addAgentTrait = useStore((s) => s.addAgentTrait);
  const removeAgent = useStore((s) => s.removeAgent);
  const spec = getMarket(mech);

  const a = (agents ?? roster).find((x) => x.id === id);
  if (!a) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Agent not found — it may have been removed.</div>;
  const traitEntries = Object.entries(a.traits || {}).filter(([k]) => k !== "name");
  // show the EFFECTIVE persona / system prompt: the agent's own override if set, otherwise the
  // value it actually runs with — the cohort persona and the market's default system prompt
  // (e.g. econ's taxation explainer). Editing stores a per-agent override; leaving it inherits.
  const co = cohorts.find((c) => c.id === a.cohort) || cohorts[0];
  const personaVal = a.persona ?? co?.persona ?? "";
  const sysVal = a.system_prompt ?? co?.system_prompt ?? spec.systemPrompt((co || { profile: {} }) as any);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <div style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)" }}>{a.id}</div>
      <Row label="name"><Text value={String(a.traits?.name ?? a.name ?? "")} onChange={(v) => updateAgentTrait(id, "name", v)} /></Row>
      <Row label="clones ×N" hint="identical copies"><Num value={a.n ?? 1} min={1} step={1} onChange={(v) => updateAgent(id, { n: Math.max(1, Math.round(v)) })} /></Row>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 -3px" }}>
        <SectionLabel>Traits</SectionLabel>
        <span onClick={() => addAgentTrait(id)} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--green)", cursor: "pointer" }}>+ add</span>
      </div>
      {traitEntries.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>No traits yet — add one.</div>}
      {traitEntries.map(([k, v]) => <TraitRow key={k} agentId={id} k0={k} v={v} />)}

      <SectionLabel>Persona</SectionLabel>
      <Area value={personaVal} rows={3} onChange={(v) => updateAgent(id, { persona: v })} />
      <SectionLabel>System prompt</SectionLabel>
      <Area value={sysVal} rows={6} onChange={(v) => updateAgent(id, { system_prompt: v })} />

      <button
        onClick={() => removeAgent(id)}
        style={{ marginTop: 4, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: "#a8443c", background: "#fbf1f0", border: "1px solid #ecd5d2", borderRadius: 9, padding: "9px 12px", cursor: "pointer" }}
      >
        Remove agent
      </button>
    </div>
  );
}

function MarketPanel() {
  const mech = useStore((s) => s.mech);
  const customType = useStore((s) => s.customType);
  const marketParams = useStore((s) => s.marketParams);
  const setMarketParam = useStore((s) => s.setMarketParam);
  const spec = getMarket(mech);
  // the market is the swappable block, but it's chosen once when the world is created
  // (a preset's market, or the Start-from-scratch chooser) and then fixed.
  return (
    <>
      <SectionLabel>Market · mechanism</SectionLabel>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--indigo-l)", border: "1px solid var(--indigo-bd)", borderRadius: 9, padding: "10px 13px" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--indigo)" }}>{customType || spec.name}</span>
        <span style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)" }} title="The market is chosen when the world is created — start a new world to change it">🔒 fixed</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>type · {customType || spec.type}</div>
      {customType ? (
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
          Custom Python mechanism — its parameters come from the <span style={{ fontFamily: mono }}>.py</span> <span style={{ fontFamily: mono }}>init_world</span> defaults.
          No golden trace exists yet, so run it live (Claude) once to record one.
        </div>
      ) : (
      <>
      <SectionLabel>Parameters</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {spec.params.map((f) => (
          <SpecField key={f.key} f={f} bag={marketParams} onSet={setMarketParam} />
        ))}
      </div>
      </>
      )}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
        agents → market → observation
      </div>
    </>
  );
}

function ObservationPanel() {
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const items: { k: "info" | "news"; label: string; note: string }[] = [
    { k: "info", label: "Observation", note: "agents see price · macro · news" },
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
  const sysPolicy = useStore((s) => s.sysPolicy);
  const setSysPolicy = useStore((s) => s.setSysPolicy);
  const sysMemory = useStore((s) => s.sysMemory);
  const setSysMemory = useStore((s) => s.setSysMemory);
  const sysReflection = useStore((s) => s.sysReflection);
  const setSysReflection = useStore((s) => s.setSysReflection);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <Row label="rounds T" hint="int"><Num value={rounds} min={1} step={1} onChange={setRounds} /></Row>
      <Row label="granularity" hint="clock"><Enum value={granularity} options={GRANULARITIES} onChange={setGranularity} /></Row>
      <Row label="reflect every" hint="rounds"><Num value={reflectEvery} min={1} step={1} onChange={setReflectEvery} /></Row>
      <Row label="seed" hint="determinism"><Num value={seed} step={1} onChange={setSeed} /></Row>
      <Row label="run name" hint="trace id"><Text value={runName} onChange={setRunName} /></Row>

      <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
      <SectionLabel>System · agent defaults</SectionLabel>
      <Seg value={((sysPolicy as "claude" | "replay") || "replay")} options={POLICY_OPTS} onChange={setSysPolicy} />
      <Row label="memory" hint="all agents"><Enum value={sysMemory} options={MEMORY_KINDS} onChange={setSysMemory} /></Row>
      <Row label="reflection" hint="all agents"><Enum value={sysReflection} options={REFLECTION_KINDS} onChange={setSysReflection} /></Row>

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
  const questionTemplate = useStore((s) => s.questionTemplate);
  const setQuestionTemplate = useStore((s) => s.setQuestionTemplate);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <SectionLabel>Question · posed each round</SectionLabel>
      <Row label="prompt template" hint="claude agents · blank = market default">
        <Area value={questionTemplate} placeholder={spec.defaultQuestion} rows={5} onChange={setQuestionTemplate} />
      </Row>
      <div style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)", lineHeight: 1.55, marginTop: -6 }}>
        The ask posed to each LLM agent; its tool answer is its action. Blank → the market's built-in
        question (shown as the placeholder above), sent alongside the input below. A custom template
        replaces the whole user turn; {"{placeholders}"} are filled per agent each round:
        <div style={{ marginTop: 4, color: "var(--green-d)" }}>{"{round} {persona} {observation} {private_state} {memory}"}</div>
        <div style={{ marginTop: 2 }}>+ any observation field (e.g. {"{price} {profit}"}).</div>
      </div>

      <SectionLabel>Input · seen each round</SectionLabel>
      <pre style={{ ...inputStyle, background: "#f4f6f3", color: "var(--muted)", margin: 0, whiteSpace: "pre-wrap", fontSize: 10.5, lineHeight: 1.5 }}>
        {spec.defaultInput}
      </pre>
      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
        input + question → ↻ next round
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
            Only the Oligopoly Pricing market reacts to <span style={{ fontFamily: mono }}>cost_jump</span> (cost ×(1+magnitude)). Other markets ignore the shock.
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
      <Row label="generates →N" hint="agents into roster"><Num value={co.n} min={1} step={1} onChange={(n) => updateCohort(co.id, { n: Math.max(1, Math.round(n)) })} /></Row>
      <Row label="persona / prompt" hint="default"><Area value={co.persona} onChange={(v) => updateCohort(co.id, { persona: v })} /></Row>
      <Row label="system prompt" hint="blank = market default"><Area value={co.system_prompt ?? ""} onChange={(v) => updateCohort(co.id, { system_prompt: v })} /></Row>

      <SectionLabel>Decision policy</SectionLabel>
      <Seg
        value={((co.policy as "claude" | "replay") || "replay")}
        options={POLICY_OPTS}
        onChange={(p) => updateCohort(co.id, { policy: p })}
      />

      <div
        onClick={() => openExpanded(co.id)}
        style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--muted)", cursor: "pointer", lineHeight: 1.4 }}
      >
        <span style={{ flex: "none", color: "var(--indigo)" }}>⌘</span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          System prompt: <span style={{ color: "var(--ink)" }}>{co.system_prompt || spec.systemPrompt(co)}</span>
        </span>
        <span style={{ flex: "none", color: "var(--indigo)", fontWeight: 600 }}>view ▸</span>
      </div>

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
        Delete generator
      </button>

      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
        generator → samples →{co.n} agents into the roster
      </div>
    </div>
  );
}
