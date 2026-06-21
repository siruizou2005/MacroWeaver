import { useStore, viewTrace, viewRound } from "../store";
import { buildChart, CHART_W, CHART_H } from "../lib/chart";

const mono = "'Spline Sans Mono',monospace";

export function PriceChart() {
  const trace = useStore(viewTrace);
  const round = useStore(viewRound);
  if (!trace || trace.T < 1) return null;

  const series = trace.series;
  const byAgent = series.by_agent_price || {};
  const benchmarks: { key: string; label: string; value: number; color: string }[] = [];
  const b = trace.benchmarks || {};
  if (typeof b.monopoly === "number") benchmarks.push({ key: "monopoly", label: `monopoly p^M = ${b.monopoly.toFixed(2)}`, value: b.monopoly, color: "var(--amber)" });
  if (typeof b.bertrand === "number") benchmarks.push({ key: "bertrand", label: `Bertrand–Nash p^B = ${b.bertrand.toFixed(2)}`, value: b.bertrand, color: "#6b74a0" });

  const chart = buildChart({ byAgent, mean: series.mean_price || [], benchmarks, round, T: trace.T });

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: "100%", height: "100%", maxHeight: 420, fontFamily: mono }}>
      <line x1="52" y1="28" x2="52" y2="340" stroke="#e5e8e4" strokeWidth="1" />
      <line x1="52" y1="340" x2="752" y2="340" stroke="#e5e8e4" strokeWidth="1" />
      {chart.benchLines.map((bl) => (
        <g key={bl.key}>
          <line x1="52" x2="752" y1={bl.y} y2={bl.y} stroke={bl.color} strokeWidth="1.5" strokeDasharray="5 4" />
          <text x="58" y={bl.y - 6} fill={bl.color} fontSize="11">{bl.label}</text>
        </g>
      ))}
      {(chart.agentPaths as any).map((p: any) => (
        <g key={p.id}>
          <path d={p.full} fill="none" stroke={p.color} strokeWidth="1.5" opacity="0.18" />
          <path d={p.sub} fill="none" stroke={p.color} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      ))}
      <line x1={chart.playX} x2={chart.playX} y1="28" y2="340" stroke="#1a1c19" strokeWidth="1" opacity="0.25" />
      {chart.agentDots.map((d, i) => (
        <circle key={i} cx={chart.playX} cy={d.y} r="5" fill={(chart.agentPaths as any)[i]?.color || "#1c7a4b"} stroke="#fff" strokeWidth="2" />
      ))}
      <text x="392" y="368" textAnchor="middle" fill="#9aa29b" fontSize="10.5">round t →</text>
    </svg>
  );
}
