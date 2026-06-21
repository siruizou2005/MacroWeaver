import { useStore } from "../../store";
import type { Mech } from "../../types";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

interface Cfg {
  glyph: string;
  badge: "i" | "g" | "a";
  title: string;
  sub: string;
  rows: { label: string; value: string; hint: string }[];
  conn: string;
  mechSel?: boolean;
  cohortId?: string;
}

function cfgFor(node: string | null, mech: Mech, cohorts: any[]): Cfg {
  if (node && node.startsWith("cohort:")) {
    const id = node.slice(7);
    const co = cohorts.find((c) => c.id === id) || cohorts[0];
    const firm = mech === "fish";
    return {
      glyph: "◎", badge: "g", title: `${co.name} · ×${co.n}`, cohortId: id,
      sub: "A cohort of LLM agents — collapsed on the canvas. Open it to reveal the internal pipeline.",
      rows: [
        { label: "count", value: "×" + co.n, hint: "int" },
        { label: "persona / prompt", value: co.persona, hint: "text" },
        { label: firm ? "cost c" : "income", value: firm ? "1.0" : "monthly", hint: "float" },
        { label: "action", value: firm ? "set price" : mech === "econ" ? "work / consume" : "place order", hint: "output" },
      ],
      conn: "cohort → market (synchronous settlement)",
    };
  }
  if (node === "market") {
    if (mech === "econ")
      return { glyph: "⊞", badge: "i", title: "Market · Mechanism", mechSel: true, sub: "The only swappable block. Aggregates every agent action into objective outcomes and the next world state.", rows: [
        { label: "type", value: "econagent", hint: "demo" },
        { label: "markets", value: "labor + goods", hint: "enum" },
        { label: "wage rule", value: "market_clearing", hint: "fn" },
        { label: "price index", value: "cpi", hint: "metric" },
      ], conn: "agents → market → observation" };
    if (mech === "clob")
      return { glyph: "⊞", badge: "i", title: "Market · Mechanism", mechSel: true, sub: "The only swappable block. A continuous order book matches bids and asks by price-time priority.", rows: [
        { label: "type", value: "clob", hint: "enum" },
        { label: "matching", value: "price-time", hint: "fn" },
        { label: "depth_k", value: "8", hint: "int" },
        { label: "tape", value: "per-trade", hint: "log" },
      ], conn: "agents → market → observation" };
    return { glyph: "⊞", badge: "i", title: "Market · Mechanism", mechSel: true, sub: "The only swappable block. Calvano logit demand turns the price vector into sales, profit and the next state.", rows: [
      { label: "type", value: "fish_calvano", hint: "enum" },
      { label: "μ (substitution)", value: "0.25", hint: "float" },
      { label: "a (quality)", value: "[2.0, 2.0]", hint: "array" },
      { label: "a₀ (outside)", value: "0.0", hint: "float" },
    ], conn: "agents → market → observation" };
  }
  if (node === "observation")
    return { glyph: "◇", badge: "g", title: "Observation", sub: "Builds each agent's next input. A key switch for whether collusion can emerge at all.", rows: [
      { label: "sees", value: "own_history", hint: "flag" },
      { label: "sees", value: "rival_prices", hint: "flag" },
      { label: "horizon", value: "last 5 rounds", hint: "int" },
    ], conn: "market → observation → scheduler" };
  if (node === "scheduler")
    return { glyph: "◷", badge: "g", title: "Scheduler", sub: "Collects all actions, settles synchronously, runs T rounds, injects optional shocks.", rows: [
      { label: "rounds T", value: "48", hint: "int" },
      { label: "settlement", value: "synchronous", hint: "enum" },
      { label: "warmup", value: "0", hint: "int" },
      { label: "shock", value: "optional", hint: "event" },
    ], conn: "observation → scheduler → recorder" };
  if (node === "recorder")
    return { glyph: "▤", badge: "g", title: "Recorder", sub: "Logs state and metrics each round, computes benchmarks, exports the trace.", rows: [
      { label: "metrics", value: "price, profit", hint: "array" },
      { label: "benchmarks", value: "bertrand, monopoly", hint: "computed" },
      { label: "export", value: "trace.json", hint: "file" },
    ], conn: "recorder → ↻ next round" };
  if (node === "shock")
    return { glyph: "⚡", badge: "a", title: "Shock (optional)", sub: "An optional intervention injected by the Scheduler at a chosen round.", rows: [
      { label: "at round", value: "t = 24", hint: "int" },
      { label: "type", value: "cost_jump", hint: "enum" },
    ], conn: "scheduler → shock → market" };
  return { glyph: "⊞", badge: "i", title: "Market", sub: "", rows: [], conn: "" };
}

export function Inspector() {
  const node = useStore((s) => s.node);
  const mech = useStore((s) => s.mech);
  const cohorts = useStore((s) => s.cohorts);
  const setMech = useStore((s) => s.setMech);
  const openExpanded = useStore((s) => s.openExpanded);

  const updateCohort = useStore((s) => s.updateCohort);
  const cfg = cfgFor(node, mech, cohorts);
  const selCohort = cfg.cohortId ? cohorts.find((c) => c.id === cfg.cohortId) : null;
  const badge =
    cfg.badge === "i" ? { bg: "var(--indigo-l)", fg: "var(--indigo)" } :
    cfg.badge === "a" ? { bg: "#f7efe2", fg: "var(--amber)" } :
    { bg: "var(--green-l)", fg: "var(--green-d)" };

  const mechBtn = (m: Mech, label: string) => {
    const on = mech === m;
    return (
      <span
        onClick={() => setMech(m)}
        style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: on ? 600 : 500, padding: 8, borderRadius: 7, cursor: "pointer", background: on ? "#fff" : "transparent", color: on ? "var(--indigo)" : "var(--muted)", boxShadow: on ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}
      >
        {label}
      </span>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: badge.bg, color: badge.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{cfg.glyph}</span>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>{cfg.title}</span>
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--muted)", margin: "6px 0 16px" }}>{cfg.sub}</p>

      {cfg.mechSel && (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Market block · swappable</div>
          <div style={{ display: "flex", background: "#f3f5f2", borderRadius: 9, padding: 3, gap: 3, marginBottom: 18 }}>
            {mechBtn("fish", "Fish")}
            {mechBtn("econ", "EconAgent")}
            {mechBtn("clob", "CLOB")}
          </div>
        </>
      )}

      {cfg.cohortId && selCohort && (
        <>
          <div
            onClick={() => openExpanded(cfg.cohortId!)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid var(--green)", background: "var(--green-l)", borderRadius: 10, padding: "10px 13px", marginBottom: 14, cursor: "pointer" }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--green-d)" }}>Open internal pipeline</span>
            <span style={{ fontSize: 13, color: "var(--green-d)" }}>▸</span>
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Decision policy</div>
          <div style={{ display: "flex", background: "#f3f5f2", borderRadius: 9, padding: 3, gap: 3, marginBottom: 14 }}>
            {(["deterministic", "claude"] as const).map((p) => {
              const on = (selCohort.policy || "deterministic") === p;
              return (
                <span
                  key={p}
                  onClick={() => updateCohort(cfg.cohortId!, { policy: p })}
                  style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: on ? 600 : 500, padding: 8, borderRadius: 7, cursor: "pointer", background: on ? "#fff" : "transparent", color: on ? "var(--green-d)" : "var(--muted)", boxShadow: on ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}
                >
                  {p === "claude" ? "Claude (live)" : "Deterministic"}
                </span>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>count ×</label>
            <input
              type="number"
              min={1}
              value={selCohort.n}
              onChange={(e) => updateCohort(cfg.cohortId!, { n: Math.max(1, parseInt(e.target.value || "1", 10)) })}
              style={{ width: 70, fontFamily: mono, fontSize: 12.5, color: "var(--green-d)", background: "#f7faf8", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px" }}
            />
          </div>
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {cfg.rows.map((r, i) => (
          <div key={i}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>{r.label}</label>
              <span style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)" }}>{r.hint}</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: 12.5, color: "var(--green-d)", background: "#f7faf8", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 11px" }}>{r.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)", fontFamily: mono, fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>{cfg.conn}</div>
    </div>
  );
}
