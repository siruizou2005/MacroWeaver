import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { LibTab } from "../types";
import { PresetsPanel } from "./library/PresetsPanel";
import { TracesPanel } from "./library/TracesPanel";
import { MarketsPanel } from "./library/MarketsPanel";
import { SchemaPanel } from "./library/SchemaPanel";
import { SettingsPanel } from "./library/SettingsPanel";

const TABS: { id: LibTab; glyph: string; label: string; group: "Library" | "Reference" }[] = [
  { id: "presets", glyph: "◫", label: "Presets", group: "Library" },
  { id: "traces", glyph: "◴", label: "Traces", group: "Library" },
  { id: "markets", glyph: "⊞", label: "Markets", group: "Library" },
  { id: "schema", glyph: "{ }", label: "config schema", group: "Reference" },
  { id: "settings", glyph: "⚙", label: "Settings", group: "Reference" },
];

function Sidebar({ tab, setTab }: { tab: LibTab; setTab: (t: LibTab) => void }) {
  const Item = ({ id, glyph, label }: { id: LibTab; glyph: string; label: string }) => {
    const active = tab === id;
    return (
      <div
        onClick={() => setTab(id)}
        style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, background: active ? "var(--green-l)" : "transparent", color: active ? "var(--green-d)" : "var(--ink)", fontWeight: active ? 600 : 400, fontSize: 14.5, cursor: "pointer" }}
      >
        <span style={{ width: 18, textAlign: "center", color: active ? "var(--green-d)" : "var(--muted)" }}>{glyph}</span>
        {label}
      </div>
    );
  };
  const group = (g: "Library" | "Reference") => (
    <>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 14px 6px" }}>{g}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TABS.filter((t) => t.group === g).map((t) => <Item key={t.id} {...t} />)}
      </div>
    </>
  );
  return (
    <aside style={{ borderRight: "1px solid var(--border)", padding: "38px 24px 38px 0" }}>
      {group("Library")}
      <div style={{ height: 1, background: "var(--border)", margin: "22px 6px" }} />
      {group("Reference")}
    </aside>
  );
}

export function PresetPicker() {
  const [tab, setTab] = useState<LibTab>("presets");
  const refreshConfigs = useStore((s) => s.refreshConfigs);
  useEffect(() => { refreshConfigs(); }, [refreshConfigs]);

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "230px 1fr", minHeight: "calc(100vh - 68px)" }}>
      <Sidebar tab={tab} setTab={setTab} />
      <section style={{ padding: "44px 0 44px 40px", minWidth: 0 }}>
        {tab === "presets" && <PresetsPanel />}
        {tab === "traces" && <TracesPanel />}
        {tab === "markets" && <MarketsPanel />}
        {tab === "schema" && <SchemaPanel />}
        {tab === "settings" && <SettingsPanel />}
      </section>
    </main>
  );
}
