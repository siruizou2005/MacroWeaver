import { useStore } from "../store";

const mono = "'Spline Sans Mono',monospace";
const ORDER = ["Agents", "Market", "Obs", "Sched", "Rec"];

// The fixed kernel pipeline. Every round runs all five stages in order, so there is no
// single "active" stage at a given round — while a run streams (or a replay plays) a green
// highlight sweeps left→right to show the cycle; otherwise it sits static.
export function FlowStrip() {
  const running = useStore((s) => s.running);
  const playing = useStore((s) => s.playing);
  const animate = running || playing;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 16 }}>
      <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 4 }}>flow</span>
      {ORDER.map((l, i) => (
        <span key={l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              fontFamily: mono, fontSize: 11, padding: "4px 9px", borderRadius: 6,
              background: "#f1f4f1", color: "var(--muted)",
              animation: animate ? `mw-flow-chip 2.2s ease-in-out ${i * 0.18}s infinite` : undefined,
            }}
          >
            {l}
          </span>
          {i < ORDER.length - 1 && <span style={{ color: "#cbd3cc", fontSize: 11 }}>→</span>}
        </span>
      ))}
    </div>
  );
}
