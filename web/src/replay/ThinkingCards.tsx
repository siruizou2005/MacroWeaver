import { useStore, viewTrace, viewRound } from "../store";
import { agentColor } from "../lib/chart";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

// Per-agent numeric stats to show, by market — the engine's `realized` shape differs per
// market (fish: price/profit, clob: price/pnl, econ: income/wealth), so we can't assume
// the fish fields exist or nothing renders for the other markets.
function agentStats(a: any, market?: string): { label: string; value: any }[] {
  const r = a.realized || {};
  const act = a.action || {};
  if (market === "econagent") {
    return [
      { label: "income", value: a.income ?? r.income },
      { label: "wealth", value: a.wealth ?? r.wealth },
    ];
  }
  if (market === "clob") {
    return [
      { label: "price", value: a.price ?? r.price ?? act.price },
      { label: "P&L", value: a.pnl ?? r.pnl },
    ];
  }
  return [
    { label: "price", value: a.price ?? act.price },
    { label: "profit", value: a.profit ?? r.profit },
  ];
}

export function ThinkingCards() {
  const trace = useStore(viewTrace);
  const round = useStore(viewRound);
  const selectAgent = useStore((s) => s.selectAgent);
  if (!trace || !trace.rounds.length) return null;
  const frame = trace.rounds[Math.min(round, trace.rounds.length - 1)];
  const agents = frame?.agents || [];

  return (
    <aside style={{ background: "#fff", padding: "24px 22px", overflowY: "auto" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>What each agent is thinking</div>
      <div style={{ fontFamily: mono, fontSize: 11.5, color: "var(--green)", marginBottom: 18 }}>round t = {round}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {agents.map((a, i) => {
          const color = agentColor(i);
          const stats = agentStats(a, trace.market).filter((st) => st.value != null);
          return (
            <div
              key={a.id}
              onClick={() => selectAgent(a.id)}
              title="Open this agent's Q&A"
              style={{ border: "1px solid var(--border)", borderRadius: 13, padding: 16, background: "#fcfdfc", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: color }} />
                  <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>{a.id}</span>
                </div>
                {a.cost != null
                  ? <span style={{ fontSize: 11, color: "var(--muted)" }}>cost c={a.cost}</span>
                  : <span style={{ fontSize: 14, color: "var(--muted)" }}>›</span>}
              </div>
              {stats.length > 0 && (
                <div style={{ display: "flex", gap: 18, marginBottom: 12 }}>
                  {stats.map((st, j) => (
                    <div key={st.label}>
                      <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>{st.label}</div>
                      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 500, color: j === 0 ? undefined : "var(--green-d)" }}>{Number(st.value).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
              {a.reasoning && (
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#3c423c", borderLeft: `2px solid ${color}`, paddingLeft: 12, fontStyle: "italic" }}>
                  "{a.reasoning}"
                </div>
              )}
            </div>
          );
        })}
      </div>
      {trace.market === "fish_calvano" && (
        <div style={{ marginTop: 20, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--green-l)" }}>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--green-d)" }}>
            Prices have settled <b>above the competitive Bertrand level</b> and drift toward monopoly — collusion emerging with no communication between agents.
          </div>
        </div>
      )}
    </aside>
  );
}
