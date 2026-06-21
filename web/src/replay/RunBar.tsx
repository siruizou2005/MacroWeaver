import { useState } from "react";
import { useStore } from "../store";

const mono = "'Spline Sans Mono',monospace";

// Save-as popover: keeps a named copy of the loaded trace so a re-run can't clobber it.
function SaveRun() {
  const traceId = useStore((s) => s.traceId);
  const trace = useStore((s) => s.trace);
  const running = useStore((s) => s.running);
  const saveTrace = useStore((s) => s.saveTrace);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const disabled = running || !traceId;
  const openPanel = () => {
    setName(trace?.run_name || traceId || "");
    setMsg(null);
    setOpen(true);
  };
  const doSave = async () => {
    const nm = name.trim();
    if (!nm) return;
    setMsg("saving…");
    const id = await saveTrace(nm);
    setMsg(id ? `Saved · ${id}` : "Save failed");
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={openPanel}
        disabled={disabled}
        title={disabled ? "Finish a run, then save a kept copy" : "Save a kept, named copy of this run"}
        style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--green-d)", background: open ? "var(--green-l)" : "#fff", border: "1px solid var(--border)", padding: "8px 13px", borderRadius: 9, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap" }}
      >
        💾 Save run
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 31, width: 300, background: "#fff", border: "1px solid var(--border)", borderRadius: 13, boxShadow: "0 18px 50px -20px rgba(20,40,28,.45)", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Save run as</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45, marginBottom: 10 }}>Keeps a copy in your Traces library so the next run won't overwrite it.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={name}
                autoFocus
                onChange={(e) => { setName(e.target.value); setMsg(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") doSave(); }}
                placeholder="run name"
                spellCheck={false}
                style={{ flex: 1, minWidth: 0, fontFamily: mono, fontSize: 12.5, color: "var(--green-d)", background: "#f7faf8", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}
              />
              <button
                onClick={doSave}
                disabled={!name.trim()}
                style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--green)", border: "none", padding: "8px 14px", borderRadius: 8, cursor: name.trim() ? "pointer" : "not-allowed", opacity: name.trim() ? 1 : 0.5, flex: "none" }}
              >
                Save
              </button>
            </div>
            {msg && <div style={{ marginTop: 9, fontSize: 11.5, color: "var(--muted)", fontFamily: mono, wordBreak: "break-all" }}>{msg}</div>}
          </div>
        </>
      )}
    </div>
  );
}

export function RunBar() {
  const traces = useStore((s) => s.traces);
  const traceId = useStore((s) => s.traceId);
  const running = useStore((s) => s.running);
  const runName = useStore((s) => s.runName);
  const liveRound = useStore((s) => s.liveRound);
  const rounds = useStore((s) => s.rounds);
  const rerun = useStore((s) => s.rerun);
  const startRun = useStore((s) => s.startRun);
  const armRun = useStore((s) => s.armRun);
  const viewReplay = useStore((s) => s.viewReplay);
  const cancelRun = useStore((s) => s.cancelRun);
  const loadTrace = useStore((s) => s.loadTrace);

  // empty (no trace) + not streaming ⇒ new-run mode; a loaded trace ⇒ replay
  const newRun = !running && !traceId;
  // Run launches the configured world (new run) or re-runs the open trace (replay)
  const onRun = running ? cancelRun : newRun ? startRun : rerun;

  const seg = (active: boolean, label: string, onClick: () => void) => (
    <span
      onClick={running ? undefined : onClick}
      style={{ fontSize: 13, fontWeight: active ? 600 : 500, padding: "6px 13px", borderRadius: 7, cursor: running ? "default" : "pointer", background: active ? "var(--green-l)" : "transparent", color: active ? "var(--green-d)" : "var(--muted)", opacity: running ? 0.5 : 1 }}
    >
      {label}
    </span>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 30px", borderBottom: "1px solid var(--border)", background: "#fff", flexWrap: "wrap" }}>
      {/* explicit mode toggle so it's never ambiguous: a NEW run vs replaying a saved one */}
      <div style={{ display: "flex", background: "#fff", border: "1px solid var(--border)", borderRadius: 9, padding: 3, gap: 2 }}>
        {seg(newRun, "New run", armRun)}
        {seg(!newRun && !running, "Replay", viewReplay)}
      </div>

      {/* context for the active mode */}
      {running ? (
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--green-d)", background: "var(--green-l)", borderRadius: 999, padding: "5px 11px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", animation: "mw-pulse 1.2s ease-in-out infinite" }} />
          running · t={liveRound}/{rounds}
        </span>
      ) : newRun ? (
        <span style={{ fontFamily: mono, fontSize: 12.5, color: "var(--green-d)", fontWeight: 600 }} title="the configured world Run will launch">{runName}</span>
      ) : (
        <select
          value={traceId || ""}
          onChange={(e) => e.target.value && loadTrace(e.target.value)}
          style={{ fontFamily: mono, fontSize: 12.5, color: "var(--green-d)", background: "#f7faf8", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px", cursor: "pointer", maxWidth: 320 }}
        >
          {!traceId && <option value="">select a trace…</option>}
          {traces.map((t) => (
            <option key={t.id} value={t.id}>{t.run_name || t.id}{t.T ? ` · T=${t.T}` : ""}</option>
          ))}
        </select>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <SaveRun />
        <button
          onClick={onRun}
          style={{ fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", background: running ? "var(--amber)" : "var(--green)", border: "none", padding: "9px 20px", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
        >
          {running ? "■ Stop" : newRun ? "▶ Run" : "↻ Re-run"}
        </button>
      </div>
    </div>
  );
}
