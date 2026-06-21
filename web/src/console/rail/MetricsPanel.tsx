import { useStore } from "../../store";
import { buildChart, CHART_W, CHART_H } from "../../lib/chart";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

function benchList(b: Record<string, any>) {
  const out: { key: string; label: string; value: number; color: string }[] = [];
  if (typeof b.monopoly === "number") out.push({ key: "monopoly", label: `monopoly ${b.monopoly.toFixed(2)}`, value: b.monopoly, color: "var(--amber)" });
  if (typeof b.bertrand === "number") out.push({ key: "bertrand", label: `bertrand ${b.bertrand.toFixed(2)}`, value: b.bertrand, color: "#8a93b8" });
  return out;
}

export function MetricsPanel() {
  const ls = useStore((s) => s.liveSeries);
  const bench = useStore((s) => s.liveBenchmarks);
  const running = useStore((s) => s.running);
  const startRun = useStore((s) => s.startRun);

  const benchmarks = benchList(bench);
  const T = Math.max(ls.round.length, 2);
  const chart = buildChart({
    byAgent: ls.by_agent_price,
    mean: ls.mean_price,
    benchmarks,
    round: ls.round.length - 1,
    T,
  });
  const lastMean = ls.mean_price.length ? ls.mean_price[ls.mean_price.length - 1] : null;
  const lastIdx = ls.collusion_index.length ? ls.collusion_index[ls.collusion_index.length - 1] : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--green-l)", color: "var(--green-d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▤</span>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>Metrics · Recorder</span>
      </div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 12px 6px", background: "#fcfdfc" }}>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: "100%", height: 128, fontFamily: mono }}>
          {chart.benchLines.map((b) => (
            <line key={b.key} x1="52" x2="752" y1={b.y} y2={b.y} stroke={b.color} strokeWidth="2" strokeDasharray="6 5" />
          ))}
          {(chart.agentPaths as any).map((p: any) => (
            <path key={p.id} d={p.full} fill="none" stroke={p.color} strokeWidth="3" />
          ))}
          {ls.round.length === 0 && (
            <text x="392" y="200" textAnchor="middle" fill="#aab3ab" fontSize="22">press Run to stream a trace</text>
          )}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10, color: "var(--muted)", padding: "6px 4px 2px", borderTop: "1px solid var(--border)", marginTop: 6 }}>
          {benchmarks.map((b) => <span key={b.key} style={{ color: b.color }}>— {b.label}</span>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>mean price</div>
          <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 600 }}>{lastMean != null ? lastMean.toFixed(2) : "—"}</div>
        </div>
        <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>collusion</div>
          <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, color: "var(--green)" }}>{lastIdx != null ? Math.round(lastIdx * 100) + "%" : "—"}</div>
        </div>
      </div>
      <div
        onClick={startRun}
        style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)", marginTop: 10, cursor: running ? "default" : "pointer" }}
      >
        → exports <span style={{ color: "var(--green-d)" }}>trace.json</span> {running ? "· streaming…" : ""}
      </div>
    </div>
  );
}
