import { useState, type CSSProperties } from "react";
import { useStore, buildConfig } from "../store";
import { loadDefaults, saveDefaults } from "../lib/defaults";
import { PresetPicker } from "../console/PresetPicker";
import { SetupSidebar } from "../console/SetupSidebar";
import { WorldArena } from "../console/canvas/WorldArena";
import { Roster } from "../console/canvas/Roster";
import { EngineLoop } from "../console/canvas/EngineLoop";
import { MetricsPanel } from "../console/rail/MetricsPanel";
import { Inspector } from "../console/rail/Inspector";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

function Toolbar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const running = useStore((s) => s.running);
  const startRun = useStore((s) => s.startRun);
  const cancelRun = useStore((s) => s.cancelRun);
  const runName = useStore((s) => s.runName);
  const setRunName = useStore((s) => s.setRunName);
  const noCohorts = useStore((s) => s.cohorts.length === 0);
  const backToPicker = useStore((s) => s.backToPicker);
  const toggleConfigView = useStore((s) => s.toggleConfigView);
  const showConfig = useStore((s) => s.showConfig);
  const saveCurrentConfig = useStore((s) => s.saveCurrentConfig);
  const [saved, setSaved] = useState(false);

  const seg = (v: "arena" | "roster" | "engine", label: string) => {
    const on = view === v;
    return (
      <span
        onClick={() => setView(v)}
        style={{ fontSize: 13, fontWeight: on ? 600 : 500, padding: "6px 13px", borderRadius: 7, cursor: "pointer", background: on ? "var(--green-l)" : "transparent", color: on ? "var(--green-d)" : "var(--muted)" }}
      >
        {label}
      </span>
    );
  };

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 22px", background: "linear-gradient(180deg,rgba(251,251,250,.97),rgba(251,251,250,0))" }}>
      <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span onClick={backToPicker} style={{ color: "var(--muted)", fontWeight: 500, cursor: "pointer", flex: "none" }}>Presets</span>
        <span style={{ color: "var(--muted)", fontWeight: 400, flex: "none" }}>/</span>
        <input
          value={runName}
          spellCheck={false}
          aria-label="run name"
          onChange={(e) => { setRunName(e.target.value); setSaved(false); }}
          onFocus={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "var(--border)"; }}
          onBlur={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
          style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: "var(--ink)", border: "1px solid transparent", borderRadius: 7, padding: "3px 7px", background: "transparent", minWidth: 60, width: `${Math.min(34, Math.max(8, runName.length + 1))}ch`, maxWidth: 320 }}
        />
        <span style={{ fontSize: 12, color: "#aeb6ae", fontWeight: 400, flex: "none" }} title="rename">✎</span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", background: "#fff", border: "1px solid var(--border)", borderRadius: 9, padding: 3, gap: 2 }}>
          {seg("arena", "World")}
          {seg("roster", "Roster")}
          {seg("engine", "Engine")}
        </div>
        <button
          onClick={async () => { const id = await saveCurrentConfig(); setSaved(!!id); }}
          title="Save to your library"
          style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--green-d)", background: saved ? "var(--green-l)" : "#fff", border: "1px solid var(--border)", padding: "9px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
        <button
          onClick={toggleConfigView}
          style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: showConfig ? "var(--green-d)" : "var(--muted)", background: showConfig ? "var(--green-l)" : "#fff", border: "1px solid var(--border)", padding: "9px 13px", borderRadius: 9, cursor: "pointer" }}
        >
          {"{ } config"}
        </button>
        <button
          onClick={running ? cancelRun : startRun}
          disabled={!running && noCohorts}
          title={!running && noCohorts ? "Add at least one agent to run" : undefined}
          style={{ fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", background: running ? "var(--amber)" : "var(--green)", border: "none", padding: "10px 20px", borderRadius: 9, cursor: !running && noCohorts ? "not-allowed" : "pointer", opacity: !running && noCohorts ? 0.5 : 1, display: "flex", alignItems: "center", gap: 8 }}
        >
          {running ? "■ Stop" : "▶ Run"}
        </button>
      </div>
    </div>
  );
}

function ConfigPanel() {
  const s = useStore();
  const toggleConfigView = useStore((st) => st.toggleConfigView);
  const saveCurrentConfig = useStore((st) => st.saveCurrentConfig);
  const publishConfig = useStore((st) => st.publishConfig);
  const [status, setStatus] = useState<string | null>(null);
  const [nick, setNick] = useState(() => loadDefaults().nickname || "");
  const [pub, setPub] = useState<string | null>(null);
  const cfg = buildConfig(s);
  const json = JSON.stringify(cfg, null, 2);

  const btn = (primary: boolean): CSSProperties => ({
    fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "9px 16px", borderRadius: 9,
    color: primary ? "#fff" : "var(--green-d)", background: primary ? "var(--green)" : "#fff",
    border: primary ? "none" : "1px solid var(--border)",
  });

  const publish = async () => {
    const author = nick.trim();
    if (!author) return;
    saveDefaults({ ...loadDefaults(), nickname: author }); // remember the nickname
    setPub("publishing…");
    const id = await publishConfig(author);
    setPub(id ? `published to Markets as “${id}” · by ${author}` : "publish failed");
  };

  return (
    <div
      onClick={toggleConfigView}
      style={{ position: "fixed", inset: 0, background: "rgba(20,30,24,.35)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(680px,92vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: "#fff", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "0 24px 60px -24px rgba(20,40,28,.5)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 17 }}>{cfg.run_name} · config</span>
          <span onClick={toggleConfigView} style={{ fontSize: 20, color: "#aab3ab", cursor: "pointer", lineHeight: 1 }}>×</span>
        </div>
        <pre style={{ margin: 0, padding: "16px 20px", overflow: "auto", fontFamily: mono, fontSize: 12, lineHeight: 1.5, color: "var(--green-d)", background: "#fbfdfb", flex: 1 }}>{json}</pre>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              style={btn(true)}
              onClick={async () => { setStatus("saving…"); const id = await saveCurrentConfig(); setStatus(id ? `saved → configs/${id}.yaml` : "save failed"); }}
            >
              Save to library
            </button>
            <button style={btn(false)} onClick={() => navigator.clipboard?.writeText(json)}>Copy JSON</button>
            {status && <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: mono }}>{status}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>Publish to Markets</span>
            <input
              value={nick}
              onChange={(e) => { setNick(e.target.value); setPub(null); }}
              placeholder="your nickname"
              spellCheck={false}
              onKeyDown={(e) => { if (e.key === "Enter") publish(); }}
              style={{ fontFamily: mono, fontSize: 12.5, color: "var(--green-d)", background: "#f7faf8", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", width: 150 }}
            />
            <button
              onClick={publish}
              disabled={!nick.trim()}
              style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--indigo)", border: "none", padding: "9px 16px", borderRadius: 9, cursor: nick.trim() ? "pointer" : "not-allowed", opacity: nick.trim() ? 1 : 0.5 }}
            >
              Publish
            </button>
            {pub && <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: mono }}>{pub}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Console() {
  const view = useStore((s) => s.view);
  const preset = useStore((s) => s.preset);
  const showConfig = useStore((s) => s.showConfig);

  // no preset chosen yet → the console opens on its preset picker
  if (!preset) return <PresetPicker />;

  return (
    <main style={{ display: "grid", gridTemplateColumns: "222px 1fr 312px", height: "calc(100vh - 68px)" }}>
      <SetupSidebar />
      <section style={{ position: "relative", background: "#fbfbfa", backgroundImage: "radial-gradient(circle,#e4e7e3 1px,transparent 1px)", backgroundSize: "22px 22px", overflow: "hidden" }}>
        <Toolbar />
        {view === "arena" && <WorldArena />}
        {view === "roster" && <Roster />}
        {view === "engine" && <EngineLoop />}
      </section>
      <aside style={{ borderLeft: "1px solid var(--border)", background: "#fff", padding: "20px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <MetricsPanel />
        <div style={{ height: 1, background: "var(--border)" }} />
        <Inspector />
      </aside>
      {showConfig && <ConfigPanel />}
    </main>
  );
}
