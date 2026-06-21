import { useStore } from "../../store";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

const NODES = [
  { id: "population", label: "Population · Agents", tag: "Agents", glyph: "◎" },
  { id: "market", label: "Mechanism", tag: "Market", glyph: "⊞" },
  { id: "observation", label: "Observation", tag: "Visibility", glyph: "◇" },
  { id: "scheduler", label: "Scheduler", tag: "Clock", glyph: "◷" },
  { id: "recorder", label: "Recorder", tag: "Trace", glyph: "▤" },
];

export function EngineLoop() {
  const node = useStore((s) => s.node);
  const selectNode = useStore((s) => s.selectNode);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: "84px 26px 30px" }}>
      <div style={{ fontFamily: mono, fontSize: 11.5, color: "var(--muted)" }}>the fixed five-primitive loop · what the world configures</div>
      <div style={{ width: "100%", maxWidth: 1020, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: 0, minWidth: "max-content", margin: "0 auto", paddingBottom: 4 }}>
          {NODES.map((n, i) => {
            const on = (n.id === "market" && node === "market") || node === n.id;
            const isMkt = n.id === "market";
            return (
              <div key={n.id} style={{ display: "contents" }}>
                <div
                  onClick={() => selectNode(n.id)}
                  style={{
                    flex: "none", width: 140, minHeight: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    background: "#fff", borderRadius: 13, padding: "16px 10px", cursor: "pointer",
                    border: `1.5px solid ${on ? "var(--green)" : "var(--border)"}`,
                    boxShadow: on ? "0 8px 22px -12px rgba(28,122,75,.45)" : "0 2px 8px -4px rgba(20,30,24,.12)",
                  }}
                >
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: isMkt ? "var(--indigo-l)" : "var(--green-l)", color: isMkt ? "var(--indigo)" : "var(--green-d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginBottom: 12 }}>{n.glyph}</span>
                  <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 15, lineHeight: 1.1, textAlign: "center" }}>{n.label.split(" · ")[0]}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginTop: 5, whiteSpace: "nowrap" }}>{n.tag}</div>
                </div>
                <span style={{ flex: "none", width: 28, textAlign: "center", color: "#9fb0a6", fontSize: 17, alignSelf: "center", visibility: i === NODES.length - 1 ? "hidden" : "visible" }}>→</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: mono, fontSize: 11.5, color: "var(--green)", background: "var(--green-l)", border: "1px solid #d3e7db", borderRadius: 999, padding: "7px 16px" }}>
        ↻ Scheduler writes back the world state &amp; advances to the next round
      </div>
    </div>
  );
}
