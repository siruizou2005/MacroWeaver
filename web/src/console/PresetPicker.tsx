import { useEffect } from "react";
import { useStore } from "../store";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

function Sidebar() {
  const Item = ({ glyph, label, active }: any) => (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9,
        background: active ? "var(--green-l)" : "transparent",
        color: active ? "var(--green-d)" : "var(--ink)",
        fontWeight: active ? 600 : 400, fontSize: 14.5, cursor: "pointer",
      }}
    >
      <span style={{ color: active ? "var(--green-d)" : "var(--muted)" }}>{glyph}</span>
      {label}
    </div>
  );
  return (
    <aside style={{ borderRight: "1px solid var(--border)", padding: "38px 24px 38px 0" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 14px 6px" }}>
        Library
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Item glyph="◫" label="Presets" active />
        <Item glyph="◴" label="Traces" />
        <Item glyph="⊞" label="Markets" />
      </div>
      <div style={{ height: 1, background: "var(--border)", margin: "22px 6px" }} />
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 14px 6px" }}>
        Reference
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Item glyph="{ }" label="config schema" />
        <Item glyph="⚙" label="Settings" />
      </div>
    </aside>
  );
}

function PresetCard({ chips, badge, badgeColor, badgeBg, title, body, svg, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className="mw-card-hover"
      style={{ border: "1px solid var(--border)", borderRadius: 15, background: "#fff", overflow: "hidden", cursor: "pointer" }}
    >
      <div style={{ height: 120, background: svg.bg, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)" }}>
        {svg.el}
      </div>
      <div style={{ padding: 20 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: badgeColor, background: badgeBg, padding: "4px 9px", borderRadius: 5 }}>
          {badge}
        </span>
        <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 21, margin: "14px 0 6px" }}>{title}</h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--muted)", margin: "0 0 16px" }}>{body}</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", fontFamily: mono, fontSize: 11.5, color: "var(--muted)" }}>
          {chips.map((c: string) => (
            <span key={c} style={{ border: "1px solid var(--border)", borderRadius: 5, padding: "3px 7px" }}>{c}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PresetPicker() {
  const openPreset = useStore((s) => s.openPreset);
  const traces = useStore((s) => s.traces);
  const loadTrace = useStore((s) => s.loadTrace);
  const savedConfigs = useStore((s) => s.savedConfigs);
  const refreshConfigs = useStore((s) => s.refreshConfigs);
  const loadSavedConfig = useStore((s) => s.loadSavedConfig);

  useEffect(() => { refreshConfigs(); }, [refreshConfigs]);

  const fishSvg = {
    bg: "linear-gradient(180deg,#f1f7f3,#e7f1ea)",
    el: (
      <svg width="180" height="74" viewBox="0 0 180 74">
        <line x1="8" y1="56" x2="172" y2="56" stroke="#c5d3ca" strokeWidth="1" />
        <line x1="8" y1="20" x2="172" y2="20" stroke="#cdb89a" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M8 52 L30 50 L52 44 L74 36 L96 30 L118 26 L140 24 L172 23" fill="none" stroke="#1c7a4b" strokeWidth="2.5" />
        <path d="M8 54 L30 53 L52 49 L74 41 L96 33 L118 28 L140 26 L172 25" fill="none" stroke="#2f6f8f" strokeWidth="2" />
      </svg>
    ),
  };
  const econSvg = {
    bg: "linear-gradient(180deg,#f8f3ea,#f2e9da)",
    el: (
      <svg width="180" height="74" viewBox="0 0 180 74">
        <line x1="8" y1="56" x2="172" y2="56" stroke="#d8c6a6" strokeWidth="1" />
        <path d="M8 50 L30 46 L52 48 L74 40 L96 42 L118 34 L140 36 L172 30" fill="none" stroke="#bd7a2a" strokeWidth="2.5" />
        <path d="M8 53 L30 50 L52 51 L74 47 L96 45 L118 42 L140 40 L172 38" fill="none" stroke="#8a8f88" strokeWidth="2" strokeDasharray="4 3" />
      </svg>
    ),
  };

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "230px 1fr", minHeight: "calc(100vh - 68px)" }}>
      <Sidebar />
      <section style={{ padding: "44px 0 44px 40px" }}>
        <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 40, letterSpacing: "-.4px", margin: 0 }}>Choose a preset</h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--muted)", maxWidth: 660, margin: "14px 0 0" }}>
          Each preset is one <span style={{ fontFamily: mono, fontSize: 14 }}>config</span> plus a recorded golden{" "}
          <span style={{ fontFamily: mono, fontSize: 14 }}>trace</span>. Open it on the console to inspect the world, tune the rules, or swap the market.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginTop: 34 }}>
          <PresetCard chips={["μ=0.25", "T=48", "2 firms"]} badge="Quantitative" badgeColor="var(--green-d)" badgeBg="var(--green-l)" title="Fish · Calvano" body="Pricing firms collude on logit demand." svg={fishSvg} onClick={() => openPreset("fish")} />
          <PresetCard chips={["245 agents", "T=40"]} badge="Demo" badgeColor="var(--amber)" badgeBg="#f7efe2" title="EconAgent · Macro" body="Household cohorts drive wages, prices, jobs." svg={econSvg} onClick={() => openPreset("econ")} />
          <div
            onClick={() => openPreset("blank")}
            style={{ border: "1.5px dashed #cfd6cf", borderRadius: 15, background: "#fcfdfc", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 262, color: "var(--muted)" }}
          >
            <span style={{ fontSize: 34, fontWeight: 300, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Start from scratch</span>
            <span style={{ fontSize: 12.5, maxWidth: 160, textAlign: "center" }}>Two cohorts, an empty market</span>
          </div>
        </div>

        {savedConfigs.length > 0 && (
          <div style={{ marginTop: 44 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "0 0 14px" }}>Saved configs</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
              {savedConfigs.map((c) => (
                <div
                  key={c.id}
                  onClick={() => loadSavedConfig(c.id)}
                  className="mw-card-hover"
                  style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "#fff", cursor: "pointer" }}
                >
                  <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{c.market || "config"}</div>
                  <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 16, margin: "4px 0" }}>{c.run_name || c.id}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{c.rounds ? `T=${c.rounds} · ` : ""}edit ▸</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {traces.length > 0 && (
          <div style={{ marginTop: 44 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "0 0 14px" }}>Recorded traces</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
              {traces.map((t) => (
                <div
                  key={t.id}
                  onClick={() => loadTrace(t.id)}
                  className="mw-card-hover"
                  style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "#fff", cursor: "pointer" }}
                >
                  <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{t.market}</div>
                  <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 16, margin: "4px 0" }}>{t.run_name || t.id}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>T={t.T} · scrub ▸</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
