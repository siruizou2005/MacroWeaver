import { useStore } from "../../store";
import { getMarket } from "../marketFields";
import type { Cohort, Mech } from "../../types";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

function stagesFor(co: Cohort, mech: Mech) {
  const spec = getMarket(mech);
  const profileKeys =
    Object.entries(co.profile || {}).map(([k, v]) => `${k}=${v}`).join(" · ") ||
    spec.profileFields.map((f) => f.key).join(" · ") || "—";
  const perceive = mech === "fish" ? "reads price · news" : mech === "econ" ? "reads wages · prices" : "reads book · news · sentiment";
  return [
    { t: "Profile", s: profileKeys },
    { t: "Perception", s: perceive },
    { t: "Memory + Reflection", s: `${co.memory || spec.defaultMemory} · ${co.reflection || spec.defaultReflection}` },
    { t: "Decision", s: `${co.policy || "replay"} → ${spec.action}` },
  ];
}

export function CohortDrawer() {
  const expanded = useStore((s) => s.expanded);
  const cohorts = useStore((s) => s.cohorts);
  const mech = useStore((s) => s.mech);
  const collapse = useStore((s) => s.collapse);
  const co = cohorts.find((c) => c.id === expanded);
  if (!co) return null;
  const spec = getMarket(mech);
  const stages = stagesFor(co, mech);

  return (
    <>
      <div onClick={collapse} style={{ position: "absolute", left: 0, right: 0, top: 58, bottom: 56, background: "rgba(251,251,250,.55)", backdropFilter: "blur(1px)", zIndex: 14 }} />
      <div style={{ position: "absolute", left: 18, right: 18, bottom: 64, zIndex: 15, background: "#fff", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "0 24px 60px -24px rgba(20,40,28,.5)", padding: "18px 20px", animation: "mw-fade .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--green-l)", color: "var(--green-d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>◎</span>
            <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 17 }}>{co.name} ×{co.n} · internal pipeline</span>
          </div>
          <span onClick={collapse} style={{ fontSize: 20, color: "#aab3ab", cursor: "pointer", lineHeight: 1 }}>×</span>
        </div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
          {stages.map((st, i) => (
            <div key={i} style={{ display: "contents" }}>
              <div style={{ flex: 1, minWidth: 130, background: "#f4faf6", border: "1px solid #d7ebe0", borderRadius: 12, padding: "13px 14px" }}>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 15, color: "var(--green-d)" }}>{st.t}</div>
                <div style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>{st.s}</div>
              </div>
              <span style={{ flex: "none", display: "flex", alignItems: "center", padding: "0 10px", color: "#9fb0a6", fontSize: 16 }}>→</span>
            </div>
          ))}
          <div style={{ flex: "none", width: 150, background: "var(--indigo-l)", border: "1px solid var(--indigo-bd)", borderRadius: 12, padding: "13px 14px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 15, color: "var(--indigo)" }}>action</div>
            <div style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>schema set by market</div>
          </div>
        </div>

        {/* system prompt — the actual text a Claude agent in this cohort receives */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 15, color: "var(--indigo)" }}>System prompt</span>
            <span style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)" }}>{co.policy === "claude" ? "sent to Claude each round" : "used when policy = Claude"}</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: 11.5, lineHeight: 1.55, color: "var(--ink)", background: "#f7f8fb", border: "1px solid var(--indigo-bd)", borderRadius: 10, padding: "11px 13px", whiteSpace: "pre-wrap", maxHeight: 150, overflowY: "auto" }}>
            {spec.systemPrompt(co)}
          </div>
          {mech === "fish" && (
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 7, lineHeight: 1.45 }}>
              For this preset the prompt prefix (P0/P1/P2) <b>is</b> the entire system prompt — the persona is not sent. Cost, market history and the PLANS.txt / INSIGHTS.txt files go in the per-round user message.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
