import { useStore } from "../../store";
import { marketMeta } from "./WorldArena";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";
const ACOLORS = [
  { bg: "#e7f1ea", fg: "#1c7a4b" }, { bg: "#e6eef4", fg: "#2f6f8f" },
  { bg: "#f2efe6", fg: "#9a7a37" }, { bg: "#ece9f2", fg: "#6a5d99" },
  { bg: "#e6f1ee", fg: "#2f7d6a" }, { bg: "#f1eae9", fg: "#9a5a52" },
];

export function Roster() {
  const cohorts = useStore((s) => s.cohorts);
  const mech = useStore((s) => s.mech);
  const marketParams = useStore((s) => s.marketParams);
  const node = useStore((s) => s.node);
  const selectNode = useStore((s) => s.selectNode);
  const openExpanded = useStore((s) => s.openExpanded);
  const addCohort = useStore((s) => s.addCohort);
  const removeCohort = useStore((s) => s.removeCohort);
  const mkt = marketMeta(mech, marketParams);
  const total = cohorts.reduce((m, c) => m + c.n, 0);
  const action = mech === "fish" ? "sets price" : mech === "econ" ? "work / consume" : "place / hold orders";
  const marketSel = node === "market";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: "74px 26px 26px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
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

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 2px 12px" }}>
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 18 }}>
            Agents · {cohorts.length} <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "Hanken Grotesk", fontWeight: 500 }}>({total} total)</span>
          </span>
          <span onClick={addCohort} style={{ fontSize: 13, fontWeight: 600, color: "var(--green)", cursor: "pointer", border: "1px solid var(--green-l)", background: "var(--green-l)", borderRadius: 8, padding: "6px 12px" }}>+ Add agent</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(208px,1fr))", gap: 12 }}>
          {cohorts.map((co, i) => {
            const sel = node === `cohort:${co.id}`;
            const col = ACOLORS[i % ACOLORS.length];
            return (
              <div
                key={co.id}
                onClick={() => selectNode(`cohort:${co.id}`)}
                style={{ background: "#fff", borderRadius: 13, padding: 14, cursor: "pointer", border: `1.5px solid ${sel ? "var(--green)" : "var(--border)"}`, boxShadow: sel ? "0 8px 22px -12px rgba(28,122,75,.4)" : "0 2px 8px -4px rgba(20,30,24,.1)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: col.bg, color: col.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flex: "none" }}>◎</span>
                  <span style={{ flex: 1, fontFamily: serif, fontWeight: 600, fontSize: 15 }}>{co.name}</span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: "var(--green)", fontWeight: 500 }}>×{co.n}</span>
                  <span onClick={(e) => { e.stopPropagation(); removeCohort(co.id); }} style={{ fontSize: 15, color: "#c2ccc4", cursor: "pointer", lineHeight: 1 }}>×</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.4 }}>{co.persona}</div>
                <div onClick={(e) => { e.stopPropagation(); openExpanded(co.id); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mono, fontSize: 11, color: "var(--green-d)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <span>{action}</span>
                  <span style={{ color: "#a7b0a8", cursor: "pointer" }}>open ▸</span>
                </div>
              </div>
            );
          })}
          <div onClick={addCohort} style={{ border: "1.5px dashed #cfd6cf", borderRadius: 13, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 128, color: "var(--muted)", cursor: "pointer" }}>
            <span style={{ fontSize: 24, fontWeight: 300 }}>+</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Add agent</span>
          </div>
        </div>
      </div>
    </div>
  );
}
