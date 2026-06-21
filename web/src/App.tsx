import { useEffect } from "react";
import { useStore } from "./store";
import type { LibTab, Screen } from "./types";
import { Landing } from "./views/Landing";
import { Docs } from "./views/Docs";
import { Blog } from "./views/Blog";
import { Console } from "./views/Console";
import { Replay } from "./views/Replay";

// Logo mark: two point-symmetric line fans inside a circle, à la a woven yin-yang.
// Generated rather than hand-plotted so the curve stays adjustable via a few params.
const LOGO_R = 37;
function logoFan(rimStart: number, rimSweep: number, neckAngle: number, neckR: number, ease: number, n: number, rotate: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const rimA = rad(rimStart + rimSweep * t + rotate);
    const na = rad(neckAngle + rotate);
    const r = neckR * Math.pow(1 - t, ease);
    lines.push({
      x1: 50 + r * Math.cos(na),
      y1: 50 + r * Math.sin(na),
      x2: 50 + LOGO_R * Math.cos(rimA),
      y2: 50 + LOGO_R * Math.sin(rimA),
    });
  }
  return lines;
}
const LOGO_LINES = [...logoFan(-80, 150, -30, 29, 1.4, 15, 0), ...logoFan(-80, 150, -30, 29, 1.4, 15, 180)];

function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flex: "none" }}>
      <circle cx={50} cy={50} r={LOGO_R + 1.6} fill="none" stroke="var(--green-d)" strokeWidth={3.2} />
      {LOGO_LINES.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--green-d)" strokeWidth={2.2} strokeLinecap="round" />
      ))}
    </svg>
  );
}

function NavLink({ label, target }: { label: string; target: Screen }) {
  const screen = useStore((s) => s.screen);
  const nav = useStore((s) => s.nav);
  const on = screen === target;
  return (
    <a
      onClick={() => nav(target)}
      style={{
        fontSize: 14.5,
        fontWeight: 500,
        padding: "7px 13px",
        borderRadius: 8,
        cursor: "pointer",
        color: on ? "var(--green-d)" : "var(--muted)",
        background: on ? "var(--green-l)" : "transparent",
      }}
    >
      {label}
    </a>
  );
}

function Header() {
  const nav = useStore((s) => s.nav);
  const screen = useStore((s) => s.screen);
  const preset = useStore((s) => s.preset);
  const connected = useStore((s) => s.connected);
  const backToPicker = useStore((s) => s.backToPicker);
  const enterConsole = useStore((s) => s.enterConsole);
  const libTab = useStore((s) => s.libTab);
  const inApp = screen === "console" || screen === "replay";

  // Contextual single step back:
  //  - console home (picker) → Home (landing)
  //  - editor / trace replay → back to the console tab it was entered from
  //  - a replay reached by Running a world → back to that editor
  const TAB_LABEL: Record<LibTab, string> = { presets: "Presets", traces: "Traces", markets: "Markets", schema: "config schema", settings: "Settings" };
  const inEditor = screen === "console" && !!preset;
  const onPicker = screen === "console" && !preset;
  let backLabel: string;
  let goBack: () => void;
  if (onPicker) {
    backLabel = "Home";
    goBack = () => nav("landing");
  } else if (inEditor) {
    backLabel = TAB_LABEL[libTab] || "Console";
    goBack = () => backToPicker();
  } else {
    backLabel = preset ? "Console" : TAB_LABEL[libTab] || "Console";
    goBack = () => nav("console");
  }
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(251,251,250,.86)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "0 32px",
          height: 68,
          display: "flex",
          alignItems: "center",
          gap: 36,
        }}
      >
        <div
          onClick={() => nav("landing")}
          style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer", flex: "none" }}
        >
          <Logo />
          <span
            style={{
              fontFamily: "'Spectral',serif",
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: "-.2px",
            }}
          >
            MacroWeaver
          </span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {inApp ? (
            // one contextual step back (replay → console, editor → library, …)
            <a
              onClick={goBack}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14.5, fontWeight: 500, padding: "7px 13px 7px 10px", borderRadius: 8, cursor: "pointer", color: "var(--green-d)", background: "var(--green-l)" }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>←</span> Back to {backLabel}
            </a>
          ) : (
            <>
              <NavLink label="Overview" target="landing" />
              <NavLink label="Blog" target="blog" />
              <NavLink label="Docs" target="docs" />
            </>
          )}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          {inApp ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: connected ? "var(--green)" : "#c9ccc6",
                }}
              />
              {connected ? "Engine connected" : "Connecting…"}
            </span>
          ) : (
            <button
              onClick={enterConsole}
              style={{
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: "var(--green)",
                border: "none",
                padding: "9px 18px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Open console
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function App() {
  const screen = useStore((s) => s.screen);
  const connect = useStore((s) => s.connect);
  const syncFromPath = useStore((s) => s.syncFromPath);
  useEffect(() => {
    connect();
    syncFromPath();
    window.addEventListener("popstate", syncFromPath);
    return () => window.removeEventListener("popstate", syncFromPath);
  }, [connect, syncFromPath]);
  // reset scroll on every screen change so a jump never lands mid-page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      {screen === "landing" && <Landing />}
      {screen === "docs" && <Docs />}
      {screen === "blog" && <Blog />}
      {screen === "console" && <Console />}
      {screen === "replay" && <Replay />}
    </div>
  );
}
