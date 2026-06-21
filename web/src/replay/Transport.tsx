import { useStore } from "../store";

const mono = "'Spline Sans Mono',monospace";

export function Transport() {
  const trace = useStore((s) => s.trace);
  const round = useStore((s) => s.round);
  const playing = useStore((s) => s.playing);
  const play = useStore((s) => s.play);
  const pause = useStore((s) => s.pause);
  const stepFwd = useStore((s) => s.stepFwd);
  const stepBack = useStore((s) => s.stepBack);
  const scrub = useStore((s) => s.scrub);
  if (!trace) return null;
  const tMax = trace.T - 1;

  const btn = (onClick: any, child: any, primary = false) => (
    <button
      onClick={onClick}
      style={{
        width: primary ? 46 : 38, height: primary ? 46 : 38,
        border: primary ? "none" : "1px solid var(--border)",
        background: primary ? "var(--green)" : "#fff",
        color: primary ? "#fff" : "var(--ink)",
        borderRadius: primary ? 11 : 9, cursor: "pointer", fontSize: primary ? 16 : 14,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {child}
    </button>
  );

  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "16px 30px 20px", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {btn(stepBack, "⏮")}
        {btn(playing ? pause : play, playing ? "❚❚" : "▶", true)}
        {btn(stepFwd, "⏭")}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14 }}>
          <input type="range" min={0} max={tMax} value={round} onChange={(e) => scrub(parseInt(e.target.value, 10))} style={{ flex: 1, height: 16 }} />
          <span style={{ fontFamily: mono, fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>
            t = <span style={{ color: "var(--green-d)", fontWeight: 500 }}>{round}</span> / {tMax}
          </span>
        </div>
      </div>
    </div>
  );
}
