import { useStore } from "../store";
import { SetupSidebar } from "../console/SetupSidebar";
import { WorldArena } from "../console/canvas/WorldArena";
import { Roster } from "../console/canvas/Roster";
import { EngineLoop } from "../console/canvas/EngineLoop";
import { MetricsPanel } from "../console/rail/MetricsPanel";
import { Inspector } from "../console/rail/Inspector";

const serif = "'Spectral',serif";

function Toolbar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const running = useStore((s) => s.running);
  const startRun = useStore((s) => s.startRun);
  const cancelRun = useStore((s) => s.cancelRun);

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
      <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 600 }}>Simulation console</span>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", background: "#fff", border: "1px solid var(--border)", borderRadius: 9, padding: 3, gap: 2 }}>
          {seg("arena", "World")}
          {seg("roster", "Roster")}
          {seg("engine", "Engine")}
        </div>
        <button
          onClick={running ? cancelRun : startRun}
          style={{ fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", background: running ? "var(--amber)" : "var(--green)", border: "none", padding: "10px 20px", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          {running ? "■ Stop" : "▶ Run"}
        </button>
      </div>
    </div>
  );
}

export function Console() {
  const view = useStore((s) => s.view);
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
    </main>
  );
}
