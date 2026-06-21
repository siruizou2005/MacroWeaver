import type { CSSProperties } from "react";
import { useStore } from "../../store";
import { MARKETS } from "../marketFields";
import type { Mech } from "../../types";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

const ACCENT: Record<Mech, { fg: string; bg: string }> = {
  fish: { fg: "var(--green-d)", bg: "var(--green-l)" },
  econ: { fg: "var(--amber)", bg: "#f7efe2" },
  clob: { fg: "var(--teal)", bg: "#e6eef4" },
};

export function MarketsPanel() {
  const openPreset = useStore((s) => s.openPreset);
  const setMech = useStore((s) => s.setMech);
  const savedConfigs = useStore((s) => s.savedConfigs);
  const loadSavedConfig = useStore((s) => s.loadSavedConfig);

  const blankWith = (m: Mech) => { openPreset("blank"); setMech(m); };

  return (
    <div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 40, letterSpacing: "-.4px", margin: 0 }}>Markets</h1>
      <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--muted)", maxWidth: 680, margin: "14px 0 0" }}>
        The market is the <strong style={{ color: "var(--ink)", fontWeight: 600 }}>only swappable block</strong> — every mechanism is a shared template that reuses the same agent pipeline. Open its golden preset, or start a blank world on top of it.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 18, marginTop: 32 }}>
        {MARKETS.map((spec) => {
          const a = ACCENT[spec.mech];
          return (
            <div key={spec.type} className="mw-card-hover" style={{ border: "1px solid var(--border)", borderRadius: 15, background: "#fff", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 19 }}>{spec.name}</span>
                <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, color: a.fg, background: a.bg, padding: "4px 9px", borderRadius: 6 }}>{spec.type}</span>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--muted)", margin: "10px 18px 14px", flex: 1 }}>{spec.blurb}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 18px 14px", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
                <span style={chip}>{spec.params.length} params</span>
                <span style={chip}>{spec.granularity}</span>
                <span style={chip}>T={spec.defaultRounds}</span>
                {spec.benchmarks.map((b) => <span key={b} style={chip}>{b}</span>)}
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)", padding: "0 18px 14px", lineHeight: 1.6 }}>
                {spec.params.map((p) => p.key).join(" · ")}
              </div>
              <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "#fcfdfc" }}>
                <button onClick={() => openPreset(spec.mech)} style={{ ...btn, color: "#fff", background: "var(--green)", border: "none" }}>Open preset →</button>
                <button onClick={() => blankWith(spec.mech)} style={{ ...btn, color: "var(--green-d)", background: "#fff", border: "1px solid var(--border)" }}>Blank world</button>
              </div>
            </div>
          );
        })}
      </div>

      {savedConfigs.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "0 0 4px" }}>Community templates</h2>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 14px" }}>Saved configs shared in your library — open any as an editable starting point.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
            {savedConfigs.map((c) => (
              <div key={c.id} onClick={() => loadSavedConfig(c.id)} className="mw-card-hover" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "#fff", cursor: "pointer" }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{c.market || "config"}</div>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 16, margin: "4px 0" }}>{c.run_name || c.id}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{c.rounds ? `T=${c.rounds} · ` : ""}edit ▸</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const chip: CSSProperties = { border: "1px solid var(--border)", borderRadius: 5, padding: "3px 7px" };
const btn: CSSProperties = { flex: 1, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "8px 10px", borderRadius: 8, cursor: "pointer" };
