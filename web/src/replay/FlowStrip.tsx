import { useStore } from "../store";

const mono = "'Spline Sans Mono',monospace";
const ORDER = ["Agents", "Market", "Obs", "Sched", "Rec"];

export function FlowStrip() {
  const round = useStore((s) => s.round);
  const active = round % ORDER.length;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 16 }}>
      <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 4 }}>flow</span>
      {ORDER.map((l, i) => (
        <span key={l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: mono, fontSize: 11, padding: "4px 9px", borderRadius: 6, background: i === active ? "var(--green)" : "#f1f4f1", color: i === active ? "#fff" : "var(--muted)" }}>{l}</span>
          {i < ORDER.length - 1 && <span style={{ color: "#cbd3cc", fontSize: 11 }}>→</span>}
        </span>
      ))}
    </div>
  );
}
