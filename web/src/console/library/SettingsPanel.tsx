import { useState, type CSSProperties } from "react";
import { useStore } from "../../store";
import { loadDefaults, saveDefaults } from "../../lib/defaults";
import type { AppDefaults } from "../../types";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";
const input: CSSProperties = { width: "100%", boxSizing: "border-box", fontFamily: mono, fontSize: 12.5, color: "var(--green-d)", background: "#f7faf8", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" };

function Field({ label, hint, children }: { label: string; hint?: string; children: any }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</label>
        {hint && <span style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function SettingsPanel() {
  const connected = useStore((s) => s.connected);
  const [d, setD] = useState<AppDefaults>(() => loadDefaults());
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<AppDefaults>) => { setD((cur) => ({ ...cur, ...patch })); setSaved(false); };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 40, letterSpacing: "-.4px", margin: 0 }}>Settings</h1>
      <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--muted)", margin: "14px 0 0" }}>
        Defaults applied to every new <em>Start from scratch</em> world, plus the engine connection.
      </p>

      <section style={{ marginTop: 30 }}>
        <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 18, margin: "0 0 12px" }}>Engine</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", background: "#fff" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: connected ? "var(--green)" : "#c9ccc6" }} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{connected ? "Engine connected" : "Connecting…"}</span>
          <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>ws · /ws</span>
        </div>
      </section>

      <section style={{ marginTop: 26 }}>
        <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 18, margin: "0 0 12px" }}>Defaults for new worlds</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="publish nickname" hint="author handle">
            <input type="text" value={d.nickname} placeholder="e.g. alice" onChange={(e) => set({ nickname: e.target.value })} style={input} />
          </Field>
          <Field label="LLM model" hint="anthropic id">
            <input type="text" value={d.model} onChange={(e) => set({ model: e.target.value })} style={input} />
          </Field>
          <Field label="max concurrency" hint="claude calls">
            <input type="number" min={1} value={d.maxConcurrency} onChange={(e) => set({ maxConcurrency: Math.max(1, parseInt(e.target.value || "1", 10)) })} style={input} />
          </Field>
          <Field label="default seed" hint="determinism">
            <input type="number" value={d.seed} onChange={(e) => set({ seed: parseInt(e.target.value || "0", 10) || 0 })} style={input} />
          </Field>
          <Field label="response cache" hint="reuse claude calls">
            <div style={{ display: "flex", background: "#f3f5f2", borderRadius: 9, padding: 3, gap: 3 }}>
              {[true, false].map((v) => {
                const on = d.useCache === v;
                return (
                  <span key={String(v)} onClick={() => set({ useCache: v })} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: on ? 600 : 500, padding: 7, borderRadius: 7, cursor: "pointer", background: on ? "#fff" : "transparent", color: on ? "var(--green-d)" : "var(--muted)", boxShadow: on ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>{v ? "On" : "Off"}</span>
                );
              })}
            </div>
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <button
              onClick={() => { saveDefaults(d); setSaved(true); }}
              style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--green)", border: "none", padding: "9px 18px", borderRadius: 9, cursor: "pointer" }}
            >
              Save defaults
            </button>
            {saved && <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: mono }}>saved ✓</span>}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 26 }}>
        <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 18, margin: "0 0 10px" }}>Determinism & keys</h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>
          Deterministic agents need no API key and reproduce byte-exact. An agent set to <span style={{ fontFamily: mono }}>Claude</span> calls Anthropic on the engine; if <span style={{ fontFamily: mono }}>ANTHROPIC_API_KEY</span> is unset there, it falls back to deterministic so every run still produces a curve.
        </p>
      </section>
    </div>
  );
}
