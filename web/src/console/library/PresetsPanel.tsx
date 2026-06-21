import { useStore } from "../../store";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

function PresetCard({ chips, badge, badgeColor, badgeBg, title, body, svg, onClick }: any) {
  return (
    <div onClick={onClick} className="mw-card-hover" style={{ border: "1px solid var(--border)", borderRadius: 15, background: "#fff", overflow: "hidden", cursor: "pointer" }}>
      <div style={{ height: 110, background: svg.bg, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)" }}>{svg.el}</div>
      <div style={{ padding: 18 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: badgeColor, background: badgeBg, padding: "4px 9px", borderRadius: 5 }}>{badge}</span>
        <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "12px 0 6px" }}>{title}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted)", margin: "0 0 14px" }}>{body}</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
          {chips.map((c: string) => <span key={c} style={{ border: "1px solid var(--border)", borderRadius: 5, padding: "3px 7px" }}>{c}</span>)}
        </div>
      </div>
    </div>
  );
}

const fishSvg = {
  bg: "linear-gradient(180deg,#f1f7f3,#e7f1ea)",
  el: (
    <svg width="170" height="64" viewBox="0 0 180 74">
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
    <svg width="170" height="64" viewBox="0 0 180 74">
      <line x1="8" y1="56" x2="172" y2="56" stroke="#d8c6a6" strokeWidth="1" />
      <path d="M8 50 L30 46 L52 48 L74 40 L96 42 L118 34 L140 36 L172 30" fill="none" stroke="#bd7a2a" strokeWidth="2.5" />
      <path d="M8 53 L30 50 L52 51 L74 47 L96 45 L118 42 L140 40 L172 38" fill="none" stroke="#8a8f88" strokeWidth="2" strokeDasharray="4 3" />
    </svg>
  ),
};
const clobSvg = {
  bg: "linear-gradient(180deg,#eef2f6,#e3eaf1)",
  el: (
    <svg width="170" height="64" viewBox="0 0 180 74">
      <line x1="8" y1="38" x2="172" y2="38" stroke="#b9c6d4" strokeWidth="1" strokeDasharray="3 3" />
      <path d="M8 40 L24 30 L40 44 L56 26 L72 38 L88 22 L104 42 L120 28 L136 46 L152 30 L172 40" fill="none" stroke="#2f6f8f" strokeWidth="2.2" />
    </svg>
  ),
};

export function PresetsPanel() {
  const openPreset = useStore((s) => s.openPreset);
  const savedConfigs = useStore((s) => s.savedConfigs);
  const loadSavedConfig = useStore((s) => s.loadSavedConfig);

  return (
    <div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 40, letterSpacing: "-.4px", margin: 0 }}>Choose a preset</h1>
      <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--muted)", maxWidth: 660, margin: "14px 0 0" }}>
        Each preset is one <span style={{ fontFamily: mono, fontSize: 14 }}>config</span> plus a recorded golden{" "}
        <span style={{ fontFamily: mono, fontSize: 14 }}>trace</span>. Open it on the console to inspect the world, tune the rules, or swap the market.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 18, marginTop: 30 }}>
        <PresetCard chips={["μ=0.25", "T=48", "2 firms"]} badge="Quantitative" badgeColor="var(--green-d)" badgeBg="var(--green-l)" title="Fish · Calvano" body="Pricing firms collude on logit demand." svg={fishSvg} onClick={() => openPreset("fish")} />
        <PresetCard chips={["245 agents", "T=40"]} badge="Demo" badgeColor="var(--amber)" badgeBg="#f7efe2" title="EconAgent · Macro" body="Household cohorts drive wages, prices, jobs." svg={econSvg} onClick={() => openPreset("econ")} />
        <PresetCard chips={["28 traders", "T=80"]} badge="Financial" badgeColor="var(--teal)" badgeBg="#e6eef4" title="TwinMarket · CLOB" body="Limit-order book with stylized facts." svg={clobSvg} onClick={() => openPreset("clob")} />
        <div
          onClick={() => openPreset("blank")}
          style={{ border: "1.5px dashed #cfd6cf", borderRadius: 15, background: "#fcfdfc", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 240, color: "var(--muted)" }}
        >
          <span style={{ fontSize: 34, fontWeight: 300, lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>Start from scratch</span>
          <span style={{ fontSize: 12.5, maxWidth: 170, textAlign: "center" }}>Empty world — pick a market, then add cohorts</span>
        </div>
      </div>

      {savedConfigs.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "0 0 14px" }}>Saved configs</h2>
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
