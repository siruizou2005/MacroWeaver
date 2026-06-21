import { useEffect, useState } from "react";
import { useStore } from "../../store";
import { marketMeta } from "./WorldArena";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

// render an agent's trait bag (EDSL-style) as compact key·value chips
function TraitChips({ traits }: { traits: Record<string, any> }) {
  const entries = Object.entries(traits || {}).filter(([k]) => k !== "name");
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {entries.map(([k, v]) => (
        <span key={k} style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", background: "#f4f6f3", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 7px" }}>
          <span style={{ color: "#9aa79e" }}>{k}</span> {String(v)}
        </span>
      ))}
    </div>
  );
}

// The roster is ONE flat list of individual agents — no cohorts / generators / factions. Each
// agent is directly editable (name, clones ×N, trait bag, persona, system prompt) in the
// Inspector; memory/reflection/policy are system-level (the Scheduler panel).
export function Roster() {
  const mech = useStore((s) => s.mech);
  const marketParams = useStore((s) => s.marketParams);
  const seed = useStore((s) => s.seed);
  const node = useStore((s) => s.node);
  const selectNode = useStore((s) => s.selectNode);
  const roster = useStore((s) => s.roster);
  const rosterLoading = useStore((s) => s.rosterLoading);
  const fetchRoster = useStore((s) => s.fetchRoster);
  const agents = useStore((s) => s.agents);
  const cohorts = useStore((s) => s.cohorts);
  const removeAgent = useStore((s) => s.removeAgent);
  const addAgent = useStore((s) => s.addAgent);
  const resample = useStore((s) => s.revertToCohorts);
  const customType = useStore((s) => s.customType);

  const mkt = customType ? { name: customType, chips: [] as string[] } : marketMeta(mech, marketParams);
  const marketSel = node === "market";
  const individuals = agents ?? roster;
  const selectedId = node?.startsWith("agent:") ? node.slice(6) : "";

  // (re)sample the roster whenever the inputs that determine it change — until it's been
  // materialised (auto on first sample), after which the explicit list is the source of truth.
  const cohortSig = JSON.stringify(cohorts.map((c) => [c.id, c.n, c.profile, c.initial_state]));
  useEffect(() => { fetchRoster(); }, [seed, cohortSig, JSON.stringify(marketParams)]); // eslint-disable-line

  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? individuals.filter((r) => r.name.toLowerCase().includes(q) || JSON.stringify(r.traits).toLowerCase().includes(q))
    : individuals;
  const CAP = 24;
  const shown = showAll || q ? filtered : filtered.slice(0, CAP);
  const hidden = filtered.length - shown.length;

  const btn = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 12.5, fontWeight: 600, color: fg, background: bg, border: `1px solid ${bg === "#fff" ? "var(--border)" : bg}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", whiteSpace: "nowrap" });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: "74px 26px 26px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* market card */}
        <div
          onClick={() => selectNode("market")}
          style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 14, padding: "16px 18px", cursor: "pointer", border: `1.5px solid ${marketSel ? "var(--indigo)" : "var(--indigo-bd)"}`, boxShadow: "0 6px 20px -12px rgba(40,30,90,.32)" }}
        >
          <span style={{ width: 42, height: 42, borderRadius: 11, background: "var(--indigo-l)", color: "var(--indigo)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flex: "none" }}>⊞</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--indigo)" }}>Market · mechanism · swappable</div>
            <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 19, marginTop: 2 }}>{mkt.name}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 240 }}>
            {mkt.chips.map((m) => <span key={m} style={{ fontFamily: mono, fontSize: 10.5, color: "var(--indigo)", background: "var(--indigo-l)", borderRadius: 6, padding: "4px 8px" }}>{m}</span>)}
          </div>
        </div>

        {/* agents — the roster: a flat list of individuals (×N = identical clones) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "22px 2px 12px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 18 }}>
            Agents · {individuals.length}
            <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "Hanken Grotesk", fontWeight: 500 }}>
              {rosterLoading ? " · sampling…" : " · each one editable"}
            </span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {individuals.length > 0 && (
              <input
                value={query}
                placeholder="filter name / trait…"
                spellCheck={false}
                onChange={(e) => setQuery(e.target.value)}
                style={{ fontFamily: mono, fontSize: 12, color: "var(--ink)", background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", width: 160 }}
              />
            )}
            <span onClick={() => addAgent(cohorts[0]?.id)} style={btn("var(--green-l)", "var(--green-d)")}>+ Add agent</span>
            <span onClick={() => { resample(); fetchRoster(); }} title="re-sample fresh agents from the seed" style={btn("#fff", "var(--muted)")}>↻ Re-sample</span>
          </div>
        </div>

        {individuals.length === 0 && !rosterLoading && (
          <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 2px" }}>
            No agents yet — <span onClick={() => addAgent(cohorts[0]?.id)} style={{ color: "var(--green)", fontWeight: 600, cursor: "pointer" }}>+ Add</span> one.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(232px,1fr))", gap: 8 }}>
          {shown.map((a) => {
            const sel = selectedId === a.id;
            return (
              <div
                key={a.id}
                onClick={() => selectNode(`agent:${a.id}`)}
                style={{ background: "#fff", border: `1px solid ${sel ? "var(--green)" : "var(--border)"}`, borderRadius: 11, padding: "10px 12px", cursor: "pointer", boxShadow: sel ? "0 6px 18px -10px rgba(28,122,75,.45)" : "none" }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 7 }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                    <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                    {(a.n ?? 1) > 1 && <span style={{ fontFamily: mono, fontSize: 10, color: "var(--green)", fontWeight: 600, flex: "none" }}>×{a.n}</span>}
                  </span>
                  <span onClick={(e) => { e.stopPropagation(); removeAgent(a.id); }} title="remove" style={{ fontSize: 14, color: "#c2ccc4", cursor: "pointer", flex: "none", lineHeight: 1 }}>×</span>
                </div>
                <TraitChips traits={a.traits} />
              </div>
            );
          })}
        </div>

        {!q && hidden > 0 && (
          <span onClick={() => setShowAll(true)} style={{ display: "inline-block", marginTop: 11, fontSize: 12, fontWeight: 600, color: "var(--green-d)", cursor: "pointer" }}>
            show all {filtered.length} ▾
          </span>
        )}
        {!q && showAll && filtered.length > CAP && (
          <span onClick={() => setShowAll(false)} style={{ display: "inline-block", marginTop: 11, marginLeft: 14, fontSize: 12, fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}>
            collapse ▴
          </span>
        )}
      </div>
    </div>
  );
}
