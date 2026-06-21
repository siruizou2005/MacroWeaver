import { useStore, viewTrace, viewRound } from "../store";
import { agentColor } from "../lib/chart";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

export function ThinkingCards() {
  const trace = useStore(viewTrace);
  const round = useStore(viewRound);
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
          const price = a.price ?? a.action?.price;
          const profit = a.profit ?? a.realized?.profit;
          return (
            <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 13, padding: 16, background: "#fcfdfc" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: color }} />
                  <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>{a.id}</span>
                </div>
                {a.cost != null && <span style={{ fontSize: 11, color: "var(--muted)" }}>cost c={a.cost}</span>}
              </div>
              <div style={{ display: "flex", gap: 18, marginBottom: 12 }}>
                {price != null && (
                  <div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>price</div>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 500 }}>{Number(price).toFixed(2)}</div>
                  </div>
                )}
                {profit != null && (
                  <div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>profit</div>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 500, color: "var(--green-d)" }}>{Number(profit).toFixed(2)}</div>
                  </div>
                )}
              </div>
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
