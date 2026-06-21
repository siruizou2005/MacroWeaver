// Price-vs-benchmark chart math, generalized from MacroWeaver.dc.html's chart() helper.
// Given per-agent price series + benchmark lines, produce SVG paths in a fixed viewBox.

export const CHART_W = 780;
export const CHART_H = 380;
const PAD_L = 52;
const PAD_R = 28;
const PAD_T = 28;
const PAD_B = 40;

export interface ChartModel {
  W: number;
  H: number;
  xs: (i: number) => number;
  ys: (p: number) => number;
  domain: [number, number];
  T: number;
  agentPaths: { id: string; full: string; sub: string }[];
  meanFull: string;
  meanSub: string;
  benchLines: { key: string; label: string; y: number; color: string }[];
  playX: number;
  agentDots: { id: string; y: number }[];
}

const AGENT_COLORS = ["#1c7a4b", "#2f6f8f", "#bd7a2a", "#6a5d99", "#2f7d6a", "#9a5a52"];

export function buildChart(opts: {
  byAgent: Record<string, number[]>;
  mean: number[];
  benchmarks: { key: string; label: string; value: number; color: string }[];
  round: number; // current playhead index
  T: number;
}): ChartModel {
  const { byAgent, mean, benchmarks, round, T } = opts;
  const series = Object.values(byAgent);

  // y-domain from all data + benchmark lines, padded.
  let lo = Infinity;
  let hi = -Infinity;
  for (const arr of series) for (const v of arr) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  for (const b of benchmarks) {
    if (b.value < lo) lo = b.value;
    if (b.value > hi) hi = b.value;
  }
  if (!isFinite(lo) || !isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  if (hi - lo < 1e-6) {
    hi = lo + 1;
  }
  const padFrac = 0.12;
  const span = hi - lo;
  const dlo = lo - span * padFrac;
  const dhi = hi + span * padFrac;

  const denomX = Math.max(1, T - 1);
  const xs = (i: number) => PAD_L + (i / denomX) * (CHART_W - PAD_L - PAD_R);
  const ys = (p: number) =>
    PAD_T + (1 - (p - dlo) / (dhi - dlo)) * (CHART_H - PAD_T - PAD_B);

  const seg = (arr: number[]) =>
    arr.map((p, i) => (i ? "L" : "M") + xs(i).toFixed(1) + " " + ys(p).toFixed(1)).join(" ");

  const r = Math.max(0, Math.min(round, T - 1));
  const sub = (arr: number[]) => arr.slice(0, r + 1);

  const ids = Object.keys(byAgent);
  const agentPaths = ids.map((id, idx) => ({
    id,
    full: seg(byAgent[id]),
    sub: seg(sub(byAgent[id])),
    color: AGENT_COLORS[idx % AGENT_COLORS.length],
  })) as any;

  const benchLines = benchmarks.map((b) => ({
    key: b.key,
    label: b.label,
    y: ys(b.value),
    color: b.color,
  }));

  const agentDots = ids.map((id) => ({ id, y: ys(byAgent[id][r] ?? dlo) }));

  return {
    W: CHART_W,
    H: CHART_H,
    xs,
    ys,
    domain: [dlo, dhi],
    T,
    agentPaths,
    meanFull: seg(mean),
    meanSub: seg(sub(mean)),
    benchLines,
    playX: xs(r),
    agentDots,
  };
}

export function agentColor(idx: number): string {
  return AGENT_COLORS[idx % AGENT_COLORS.length];
}
