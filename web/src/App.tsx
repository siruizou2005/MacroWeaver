import { useEffect } from "react";
import { useStore } from "./store";
import type { Screen } from "./types";
import { Landing } from "./views/Landing";
import { Dashboard } from "./views/Dashboard";
import { Console } from "./views/Console";
import { Replay } from "./views/Replay";

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
  const connected = useStore((s) => s.connected);
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
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 30,
              border: "1.5px solid var(--green-d)",
              borderRadius: 6,
              fontFamily: "'Spectral',serif",
              fontWeight: 600,
              fontSize: 15,
              color: "var(--green-d)",
              letterSpacing: "-.5px",
            }}
          >
            M<span style={{ color: "var(--green)", padding: "0 1px" }}>≋</span>
          </span>
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
          <NavLink label="Overview" target="landing" />
          <NavLink label="Presets" target="dashboard" />
          <NavLink label="Console" target="console" />
          <NavLink label="Replay" target="replay" />
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span
            title={connected ? "engine connected" : "connecting…"}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connected ? "var(--green)" : "#c9ccc6",
            }}
          />
          <span style={{ fontSize: 14, color: "var(--muted)", cursor: "pointer" }}>Docs</span>
          <button
            onClick={() => nav("console")}
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
        </div>
      </div>
    </header>
  );
}

export function App() {
  const screen = useStore((s) => s.screen);
  const connect = useStore((s) => s.connect);
  useEffect(() => {
    connect();
  }, [connect]);
  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      {screen === "landing" && <Landing />}
      {screen === "dashboard" && <Dashboard />}
      {screen === "console" && <Console />}
      {screen === "replay" && <Replay />}
    </div>
  );
}
