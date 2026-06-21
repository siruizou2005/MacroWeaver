import { useEffect } from "react";
import { useStore } from "../../store";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

export function TracesPanel() {
  const traces = useStore((s) => s.traces);
  const loadTrace = useStore((s) => s.loadTrace);
  const refreshTraces = useStore((s) => s.refreshTraces);

  // the trace list is otherwise only seeded by the WS `hello`; fetch on open so a cold
  // load (before `hello` arrives) or an out-of-band change doesn't show a false "empty".
  useEffect(() => { refreshTraces(); }, [refreshTraces]);

  return (
    <div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 40, letterSpacing: "-.4px", margin: 0 }}>Traces</h1>
      <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--muted)", maxWidth: 660, margin: "14px 0 0" }}>
        Every finished run writes a self-contained <span style={{ fontFamily: mono, fontSize: 14 }}>trace.json</span>. Open one to scrub it round by round in the replay.
      </p>

      {traces.length === 0 ? (
        <div style={{ marginTop: 34, border: "1.5px dashed #cfd6cf", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: "var(--green-d)" }}>No traces yet</div>
          <div style={{ fontSize: 13.5, marginTop: 6 }}>Open a preset and hit Run — the finished run shows up here.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12, marginTop: 30 }}>
          {traces.map((t) => (
            <div
              key={t.id}
              onClick={() => loadTrace(t.id)}
              className="mw-card-hover"
              style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "#fff", cursor: "pointer" }}
            >
              <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{t.market || "trace"}</div>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 16, margin: "4px 0" }}>{t.run_name || t.id}</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{t.T ? `T=${t.T} · ` : ""}scrub ▸</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
