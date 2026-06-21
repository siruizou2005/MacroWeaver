import { useStore } from "../store";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";
const ACOLORS = [
  { bg: "#e7f1ea", fg: "#1c7a4b" }, { bg: "#e6eef4", fg: "#2f6f8f" },
  { bg: "#f2efe6", fg: "#9a7a37" }, { bg: "#ece9f2", fg: "#6a5d99" },
  { bg: "#e6f1ee", fg: "#2f7d6a" }, { bg: "#f1eae9", fg: "#9a5a52" },
];

const PRESET_NAMES: Record<string, string> = { fish: "Fish · Calvano", econ: "EconAgent · Macro", clob: "TwinMarket · CLOB", blank: "Untitled simulation" };
const PRESET_IDS: Record<string, string> = { fish: "fish_calvano", econ: "econagent_macro", clob: "clob_twinmarket", blank: "new_config" };

function Block({ id, glyph, glyphColor, label, optional }: any) {
  const node = useStore((s) => s.node);
  const selectNode = useStore((s) => s.selectNode);
  const sel = node === id;
  return (
    <div
      onClick={() => selectNode(id)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, border: `1px solid ${sel ? "var(--green)" : "transparent"}`, background: sel ? "#f3faf6" : "transparent" }}
    >
      <span style={{ color: glyphColor }}>{glyph}</span>
      <span style={{ flex: 1 }}>
        {label} {optional && <span style={{ color: "var(--muted)", fontSize: 11 }}>· {optional}</span>}
      </span>
    </div>
  );
}

export function SetupSidebar() {
  const preset = useStore((s) => s.preset) || "blank";
  const runName = useStore((s) => s.runName);
  const cohorts = useStore((s) => s.cohorts);
  const node = useStore((s) => s.node);
  const selectNode = useStore((s) => s.selectNode);
  const addCohort = useStore((s) => s.addCohort);
  const total = cohorts.reduce((m, c) => m + c.n, 0);
  const simName = PRESET_NAMES[preset] || runName || "Simulation";
  const simId = PRESET_IDS[preset] || runName || "config";

  return (
    <aside style={{ borderRight: "1px solid var(--border)", background: "#fff", padding: "22px 16px", overflowY: "auto" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 10px 4px" }}>Simulation</div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 11, padding: "12px 13px", marginBottom: 18 }}>
        <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 15 }}>{simName}</div>
        <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{simId} · {total} agents</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 4px 9px" }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Cohorts · {cohorts.length}</span>
        <span onClick={addCohort} style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", cursor: "pointer" }}>+ Add</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
        {cohorts.map((co, i) => {
          const sel = node === `cohort:${co.id}`;
          const col = ACOLORS[i % ACOLORS.length];
          return (
            <div
              key={co.id}
              onClick={() => selectNode(`cohort:${co.id}`)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 8, cursor: "pointer", border: `1px solid ${sel ? "var(--green)" : "transparent"}`, background: sel ? "#f3faf6" : "transparent" }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 6, background: col.bg, color: col.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flex: "none" }}>◎</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{co.name}</span>
              <span style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)" }}>×{co.n}</span>
            </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: "var(--border)", margin: "0 4px 16px" }} />
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", margin: "0 4px 9px" }}>Blocks</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Block id="market" glyph="⊞" glyphColor="var(--indigo)" label="Market" optional="swappable" />
        <Block id="observation" glyph="◇" glyphColor="var(--green-d)" label="Observation" />
        <Block id="scheduler" glyph="◷" glyphColor="var(--green-d)" label="Scheduler" />
        <Block id="recorder" glyph="▤" glyphColor="var(--green-d)" label="Recorder" />
        <Block id="shock" glyph="⚡" glyphColor="var(--amber)" label="Shock" optional="optional" />
      </div>
    </aside>
  );
}
