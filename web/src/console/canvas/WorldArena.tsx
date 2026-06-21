import { useStore } from "../../store";
import { CohortDrawer } from "./CohortDrawer";
import { getMarket, marketChips } from "../marketFields";
import type { Mech } from "../../types";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

const ACOLORS = [
  { bg: "#e7f1ea", fg: "#1c7a4b" },
  { bg: "#e6eef4", fg: "#2f6f8f" },
  { bg: "#f2efe6", fg: "#9a7a37" },
  { bg: "#ece9f2", fg: "#6a5d99" },
  { bg: "#e6f1ee", fg: "#2f7d6a" },
  { bg: "#f1eae9", fg: "#9a5a52" },
];

// Headline market card name + chips, derived from the registry + live params.
export function marketMeta(mech: Mech, params: Record<string, any> = {}) {
  return { name: getMarket(mech).name, chips: marketChips(mech, params) };
}

export function WorldArena() {
  const cohorts = useStore((s) => s.cohorts);
  const layers = useStore((s) => s.layers);
  const mech = useStore((s) => s.mech);
  const node = useStore((s) => s.node);
  const expanded = useStore((s) => s.expanded);
  const selectNode = useStore((s) => s.selectNode);
  const openExpanded = useStore((s) => s.openExpanded);
  const addCohort = useStore((s) => s.addCohort);
  const rounds = useStore((s) => s.rounds);
  const granularity = useStore((s) => s.granularity);
  const marketParams = useStore((s) => s.marketParams);
  const running = useStore((s) => s.running);
  const liveRound = useStore((s) => s.liveRound);
  const liveAgents = useStore((s) => s.liveAgents);
  const liveSeries = useStore((s) => s.liveSeries);
  const armRun = useStore((s) => s.armRun);

  const k = cohorts.length;
  const cx = 318, cy = 262;
  const R = k <= 3 ? 196 : k <= 5 ? 202 : 210;
  const mkt = marketMeta(mech, marketParams);

  const infoOp = layers.info ? 0.95 : 0.22;
  const newsOp = layers.news ? 0.95 : 0.16;

  const placed = cohorts.map((co, i) => {
    const ang = ((-90 + (i * 360) / k) * Math.PI) / 180;
    return { co, i, x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), col: ACOLORS[i % ACOLORS.length] };
  });

  const trackFill = `${((Math.min(liveRound, rounds) / Math.max(1, rounds)) * 100).toFixed(1)}%`;
  const marketSel = node === "market";
  const recSel = node === "recorder";

  // Recorder node content — the ACTUAL per-round record, read live from the stream.
  // Each round logs: agent output (price/reasoning) → mechanism's objective result
  // (price·qty·profit) → the headline series written back to the world & trace.
  const last = (arr?: number[]) => (arr && arr.length ? arr[arr.length - 1] : undefined);
  const fmt = (v: number | undefined, d = 2) => (v == null ? "—" : v.toFixed(d));
  const cohortName = (id: string) => {
    const cid = id.replace(/_\d+$/, "");
    return cohorts.find((c) => c.id === cid)?.name || id;
  };
  const recRows = Object.entries(liveAgents).map(([id, a]: [string, any]) => ({
    name: cohortName(id),
    price: a?.realized?.price ?? a?.action?.price,
    profit: a?.realized?.profit,
  }));
  const recMean = last(liveSeries.cols.mean_price);
  const recIdx = last(liveSeries.cols.collusion_index);
  const recHasData = liveRound > 0 && recRows.some((r) => r.price != null);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", paddingTop: 58 }}>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <div style={{ minWidth: "100%", minHeight: "100%", width: "max-content", display: "flex", alignItems: "center", justifyContent: "center", padding: "18px 28px", boxSizing: "border-box" }}>
          <div style={{ position: "relative", width: 760, height: 520, flex: "none" }}>
            <svg viewBox="0 0 760 520" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              <defs>
                <marker id="mw-ar" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#7a8290" /></marker>
                <marker id="mw-arn" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#bd7a2a" /></marker>
                <marker id="mw-arg" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#1c7a4b" /></marker>
              </defs>
              <circle cx="318" cy="262" r="150" fill="none" stroke="#8aa6c4" strokeWidth="1.2" strokeDasharray="3 6" opacity={infoOp} />
              {placed.map((p, i) => (
                <line key={"c" + i} x1="318" y1="262" x2={p.x} y2={p.y} stroke="#9aa79e" strokeWidth="1.6" />
              ))}
              {/* drawn after the radial lines, with a bg halo so the line doesn't cut through the text */}
              <text x="318" y="411" textAnchor="middle" fontFamily="Hanken Grotesk" fontSize="11.5" fill="#5f7794" opacity={infoOp} stroke="#fbfbfa" strokeWidth={4} paintOrder="stroke">Observation layer · price · macro · news</text>
              <text x="296" y="150" textAnchor="end" fontFamily="Hanken Grotesk" fontSize="11.5" fill="#5d655e">act ↓</text>
              <text x="340" y="150" fontFamily="Hanken Grotesk" fontSize="11.5" fill="#5d655e">observe ↑</text>
              <path d="M600 70 L432 188" stroke="#bd7a2a" strokeWidth="1.4" strokeDasharray="4 5" fill="none" markerEnd="url(#mw-arn)" opacity={newsOp} />
              <text x="606" y="60" textAnchor="end" fontFamily="Hanken Grotesk" fontSize="11.5" fill="#bd7a2a" opacity={newsOp}>News / shock</text>
              {/* lower lane: record → out to the recorder */}
              <line x1="420" y1="262" x2="556" y2="262" stroke="#7a8290" strokeWidth="1.6" markerEnd="url(#mw-ar)" />
              <text x="488" y="254" textAnchor="middle" fontFamily="Hanken Grotesk" fontSize="11.5" fill="#5d655e">record →</text>
              {/* upper lane: write-back arc looping the recorded state back into the world */}
              <path d="M556 246 C522 202 446 202 414 244" fill="none" stroke="#1c7a4b" strokeWidth="1.4" strokeDasharray="4 5" markerEnd="url(#mw-arg)" opacity={0.85} />
              <text x="485" y="192" textAnchor="middle" fontFamily="Hanken Grotesk" fontSize="11" fill="#1c7a4b">↻ write-back · next round</text>
            </svg>

            {/* market core */}
            <div
              onClick={() => selectNode("market")}
              style={{
                position: "absolute", left: cx, top: cy, transform: "translate(-50%,-50%)", width: 198, textAlign: "center",
                background: "#fff", borderRadius: 15, padding: "16px 14px", cursor: "pointer",
                border: `1.5px solid ${marketSel ? "var(--indigo)" : "var(--indigo-bd)"}`,
                boxShadow: `0 16px 44px -18px rgba(40,30,90,.4)${marketSel ? ",0 0 0 4px rgba(79,71,168,.12)" : ""}`,
              }}
            >
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--indigo)" }}>Market · mechanism</div>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, color: "var(--indigo)", margin: "5px 0 3px" }}>{mkt.name}</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)" }}>central settlement</div>
              <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
                {mkt.chips.map((c) => (
                  <span key={c} style={{ fontFamily: mono, fontSize: 10, color: "var(--indigo)", background: "var(--indigo-l)", borderRadius: 6, padding: "3px 7px" }}>{c}</span>
                ))}
              </div>
            </div>

            {/* recorder · write-back node — sits at the end of the record→ arrow.
                Shows the ACTUAL per-round record live; falls back to the field schema when idle. */}
            <div
              onClick={() => selectNode("recorder")}
              style={{
                position: "absolute", left: 642, top: cy, transform: "translate(-50%,-50%)", width: 162, textAlign: "left",
                background: "#fff", borderRadius: 14, padding: "13px 13px", cursor: "pointer",
                border: `1.5px solid ${recSel ? "var(--green)" : "#cfe0d4"}`,
                boxShadow: recSel ? "0 12px 30px -12px rgba(28,122,75,.5)" : "0 10px 30px -16px rgba(20,30,24,.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--green-d)" }}>▤ Record</span>
                <span style={{ fontFamily: mono, fontSize: 9.5, color: "var(--muted)" }}>{recHasData ? `t=${liveRound}` : "write-back"}</span>
              </div>

              {recHasData ? (
                <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 6, fontFamily: mono, fontSize: 10, color: "var(--ink)" }}>
                  {recRows.map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ color: "var(--green-d)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <span style={{ flex: "none", color: "var(--muted)" }}>${fmt(r.price)} · π {fmt(r.profit, 1)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px dashed #d4e3d9", paddingTop: 5, display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                    <span>mean ${fmt(recMean)}</span>
                    <span>idx {fmt(recIdx)}</span>
                  </div>
                  <div style={{ color: "var(--green-d)", fontSize: 9, marginTop: 1 }}>↻ written back → next round</div>
                </div>
              ) : (
                <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 5, fontFamily: mono, fontSize: 9, color: "var(--muted)", lineHeight: 1.35 }}>
                  <span style={{ color: "var(--ink)" }}>agent output</span>
                  <span>price · reasoning</span>
                  <span style={{ color: "#9fc0ad" }}>↓ mechanism aggregates</span>
                  <span style={{ color: "var(--ink)" }}>objective result</span>
                  <span>price · qty · profit</span>
                  <span style={{ color: "#9fc0ad" }}>↓ write back</span>
                  <span style={{ color: "var(--ink)" }}>series → next round</span>
                  <span>mean_price · collusion</span>
                </div>
              )}
            </div>

            {/* empty from-0 state — prompt to add cohorts */}
            {k === 0 && (
              <div style={{ position: "absolute", left: cx, top: cy + 92, transform: "translate(-50%,0)", width: 250, textAlign: "center" }}>
                <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 600, color: "var(--green-d)" }}>No agents yet</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.45 }}>
                  Pick the market above, then add agents around it from the Roster or the sidebar.
                </div>
                <div onClick={addCohort} style={{ display: "inline-flex", marginTop: 10, fontSize: 12.5, fontWeight: 600, color: "var(--green)", border: "1px solid var(--green-l)", background: "var(--green-l)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>+ Add agent</div>
              </div>
            )}

            {/* cohort badges */}
            {placed.map(({ co, x, y }) => {
              const sel = node === `cohort:${co.id}` || expanded === co.id;
              return (
                <div
                  key={co.id}
                  onClick={() => openExpanded(co.id)}
                  style={{
                    position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", width: 150,
                    background: "#fff", borderRadius: 12, padding: "12px 13px", cursor: "pointer",
                    border: `1.5px solid ${sel ? "var(--green)" : "#cfe0d4"}`,
                    boxShadow: sel ? "0 10px 26px -10px rgba(28,122,75,.5)" : "0 3px 12px -6px rgba(20,30,24,.22)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 15, color: "var(--green-d)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{co.name}</span>
                    <span style={{ fontFamily: mono, fontSize: 13, color: "var(--green)", fontWeight: 500, flex: "none" }}>×{co.n}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{co.persona}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
                    <span style={{ display: "flex", gap: 5 }}>
                      {[0, 1, 2].map((d) => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", border: "1.4px solid #9fc0ad" }} />)}
                    </span>
                    <span style={{ fontSize: 9.5, color: "#a7b0a8" }}>open ▸</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {expanded && <CohortDrawer />}

      {/* scheduler timeline dock */}
      <div style={{ borderTop: "1px solid var(--border)", background: "#fff", padding: "11px 20px", display: "flex", alignItems: "center", gap: 16, zIndex: 13 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", color: "var(--muted)", whiteSpace: "nowrap" }}>Scheduler · {rounds} {granularity}s · sync</span>
        <div style={{ flex: 1, position: "relative", height: 16 }}>
          <div style={{ position: "absolute", top: 6, left: 0, right: 0, height: 4, borderRadius: 4, background: "#e6e9e5" }} />
          <div style={{ position: "absolute", top: 6, left: 0, width: trackFill, height: 4, borderRadius: 4, background: "var(--green)" }} />
          <div style={{ position: "absolute", top: 0, left: trackFill, width: 2, height: 16, background: "var(--ink)", transform: "translateX(-1px)" }} />
        </div>
        <span style={{ fontFamily: mono, fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>t={liveRound}</span>
        <button
          onClick={armRun}
          disabled={running || k === 0}
          style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--green-d)", background: "var(--green-l)", border: "1px solid #d3e7db", padding: "7px 14px", borderRadius: 8, cursor: running || k === 0 ? "default" : "pointer", whiteSpace: "nowrap", opacity: running || k === 0 ? 0.6 : 1 }}
        >
          {running ? "running…" : k === 0 ? "add an agent to run" : "▶ Run"}
        </button>
      </div>
    </div>
  );
}
