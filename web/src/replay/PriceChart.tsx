import { useStore, viewTrace, viewRound } from "../store";
import { buildChart, CHART_W, CHART_H } from "../lib/chart";

const mono = "'Spline Sans Mono',monospace";

export function PriceChart() {
  const trace = useStore(viewTrace);
  const round = useStore(viewRound);
  if (!trace || trace.T < 1) return null;

  const series = trace.series;
  const byAgent = series.by_agent_price || {};
  // Plot every numeric benchmark the market emits — fish (monopoly/bertrand), econ
  // (target_cpi), clob (fair value), and any future market — not just the two fish lines.
  const BENCH_STYLE: Record<string, { label: (v: number) => string; color: string }> = {
    monopoly: { label: (v) => `monopoly p^M = ${v.toFixed(2)}`, color: "var(--amber)" },
    bertrand: { label: (v) => `Bertrand–Nash p^B = ${v.toFixed(2)}`, color: "#6b74a0" },
    target_cpi: { label: (v) => `target CPI = ${v.toFixed(2)}`, color: "var(--amber)" },
    "fair value": { label: (v) => `fair value = ${v.toFixed(2)}`, color: "#6b74a0" },
  };
  const BENCH_PALETTE = ["var(--amber)", "#6b74a0", "#2f7d6a", "#9a5a52"];
  const benchmarks: { key: string; label: string; value: number; color: string }[] = [];
  const b = trace.benchmarks || {};
  let bi = 0;
  for (const [key, v] of Object.entries(b)) {
    if (typeof v !== "number") continue;
    // this is the price-scale chart; skip profit-scale benchmarks (e.g. fish's
    // bertrand_profit/monopoly_profit ~20–34) or they'd blow up the y-domain and
    // crush the ~1–3 price series into an unreadable band.
    if (key.endsWith("_profit")) continue;
    const sty = BENCH_STYLE[key];
    benchmarks.push({
      key,
      label: sty ? sty.label(v) : `${key} = ${v.toFixed(2)}`,
      value: v,
      color: sty ? sty.color : BENCH_PALETTE[bi % BENCH_PALETTE.length],
    });
    bi++;
  }

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
