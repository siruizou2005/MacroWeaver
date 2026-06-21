import { useStore, viewTrace, viewRound } from "../store";
import { agentColor } from "../lib/chart";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";
const subhead = { fontFamily: mono, fontSize: 9.5, textTransform: "uppercase" as const, letterSpacing: ".1em", color: "var(--muted)", marginBottom: 5 };

function fmt(v: any): string {
  if (v == null) return "—";
  if (typeof v === "number")
    return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

// a compact key:value block for a record (observation slice, action, beliefs, realized)
function KV({ obj, color }: { obj: Record<string, any>; color?: string }) {
  const entries = Object.entries(obj || {}).filter(
    ([, v]) => v != null && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0),
  );
  if (!entries.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12 }}>
          <span style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)", flex: "0 0 auto" }}>{k}</span>
          <span style={{ fontFamily: mono, fontSize: 11.5, color: color || "var(--green-d)", wordBreak: "break-word", textAlign: "right", flex: 1 }}>{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

function Block({ kicker, accent, children }: { kicker: string; accent: string; children: any }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderLeft: `3px solid ${accent}`, borderRadius: 11, padding: "12px 14px", background: "#fcfdfc" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: accent, marginBottom: 8 }}>{kicker}</div>
      {children}
    </div>
  );
}

// The click-an-agent right panel: one agent's heterogeneous Q&A for the scrubbed round —
// what it saw (question) → what it decided (answer) → its outcome (result, which feeds the
// next round's input). Replaces the all-agents ThinkingCards overview while an agent is selected.
export function AgentQA() {
  const trace = useStore(viewTrace);
  const round = useStore(viewRound);
  const selectedAgentId = useStore((s) => s.selectedAgentId);
  const selectAgent = useStore((s) => s.selectAgent);
  if (!trace || !selectedAgentId) return null;

  const meta: any = (trace.agents || []).find((a) => a.id === selectedAgentId);
  const r = Math.min(round, Math.max(0, trace.rounds.length - 1));
  const frame: any = trace.rounds[r]?.agents?.find((a: any) => a.id === selectedAgentId);
  const idx = (trace.agents || []).findIndex((a) => a.id === selectedAgentId);
  const color = agentColor(idx < 0 ? 0 : idx);

  const q = frame?.question || {};
  const reasoning = frame?.reasoning;
  const traitChips = Object.entries(meta || {}).filter(
    ([k, v]) => !["id", "cohort", "name", "persona", "system_prompt"].includes(k) && v != null && typeof v !== "object",
  );

  return (
    <aside style={{ background: "#fff", padding: "20px 20px 28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, borderLeft: "1px solid var(--border)" }}>
      <button onClick={() => selectAgent(null)} style={{ alignSelf: "flex-start", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>← all agents</button>

      {/* identity */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 19 }}>{meta?.name || selectedAgentId}</span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10.5, color: "var(--green)" }}>{selectedAgentId} · round t = {round}</div>
        {meta?.persona && <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#3c423c", marginTop: 8 }}>{meta.persona}</div>}
        {meta?.system_prompt && (
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: "var(--muted)", fontStyle: "italic", borderLeft: "2px solid var(--border)", paddingLeft: 10 }}>
            <span style={{ fontFamily: mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em", display: "block", marginBottom: 3 }}>system prompt</span>
            {meta.system_prompt}
          </div>
        )}
        {traitChips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
            {traitChips.map(([k, v]) => (
              <span key={k} style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", background: "#f4f6f3", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 7px" }}>
                <span style={{ color: "#9aa79e" }}>{k}</span> {fmt(v)}
              </span>
            ))}
          </div>
        )}
      </div>

      {!frame ? (
        <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>No record for this agent at round {round}.</div>
      ) : (
        <>
          <Block kicker="Question · what it saw" accent="var(--indigo)">
            {Object.keys(q.public || {}).length > 0 && (<><div style={subhead}>market</div><KV obj={q.public} color="var(--indigo)" /></>)}
            {Object.keys(q.private || {}).length > 0 && (<><div style={{ ...subhead, marginTop: 8 }}>private</div><KV obj={q.private} color="var(--indigo)" /></>)}
            {Object.keys(q.public || {}).length === 0 && Object.keys(q.private || {}).length === 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>(no observation recorded)</div>
            )}
          </Block>

          <Block kicker="Answer · its decision" accent={color}>
            {frame.action && Object.keys(frame.action).length > 0 && <KV obj={frame.action} color="var(--green-d)" />}
            {reasoning && <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#3c423c", fontStyle: "italic", marginTop: frame.action ? 8 : 0 }}>"{reasoning}"</div>}
            {frame.beliefs && Object.keys(frame.beliefs).length > 0 && (<><div style={{ ...subhead, marginTop: 8 }}>beliefs</div><KV obj={frame.beliefs} /></>)}
          </Block>

          <Block kicker="Result · fed to next round" accent="var(--amber)">
            {frame.result_description && <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#3c423c", marginBottom: frame.realized ? 8 : 0 }}>{frame.result_description}</div>}
            {frame.realized && <KV obj={frame.realized} color="var(--amber)" />}
          </Block>
        </>
      )}
    </aside>
  );
}
