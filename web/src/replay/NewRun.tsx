import { useStore } from "../store";
import { getMarket } from "../console/marketFields";
import { agentColor, CHART_W, CHART_H } from "../lib/chart";
import { FlowStrip } from "./FlowStrip";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

// the headline stat labels each market shows in the replay header — mirrored here so the
// new-run scaffold reserves the same slots, just empty (—)
const STAT_LABELS: Record<string, string[]> = {
  fish: ["Mean price", "Collusion index"],
  econ: ["CPI", "Inflation %", "Unemployment %"],
  clob: ["Last price", "Return %"],
};

const TITLES: Record<string, string> = {
  fish: "Oligopoly Pricing — price vs. benchmarks",
  econ: "EconAgent · Macro — CPI & inflation",
  clob: "CLOB — traded price vs. fair value",
};

// Empty chart frame: axes + faint gridlines + a centered prompt. No data — that emptiness
// is the signal that this is a NEW run that hasn't produced anything yet.
function EmptyChart() {
  const grid = [88, 150, 212, 274].map((y) => (
    <line key={y} x1="52" x2="752" y1={y} y2={y} stroke="#eef1ee" strokeWidth="1" />
  ));
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: "100%", height: "100%", maxHeight: 420, fontFamily: mono }}>
      {grid}
      <line x1="52" y1="28" x2="52" y2="340" stroke="#e5e8e4" strokeWidth="1" />
      <line x1="52" y1="340" x2="752" y2="340" stroke="#e5e8e4" strokeWidth="1" />
      <text x="402" y="182" textAnchor="middle" fill="#aab3ab" fontSize="13">no data yet</text>
      <text x="402" y="204" textAnchor="middle" fill="#c2ccc4" fontSize="11">press ▶ Run to generate the price path</text>
      <text x="392" y="368" textAnchor="middle" fill="#9aa29b" fontSize="10.5">round t →</text>
    </svg>
  );
}

function DisabledTransport({ rounds }: { rounds: number }) {
  const btn = (child: any, primary = false) => (
    <div style={{ width: primary ? 46 : 38, height: primary ? 46 : 38, border: primary ? "none" : "1px solid var(--border)", background: primary ? "#cfe0d4" : "#fff", color: primary ? "#fff" : "#c2ccc4", borderRadius: primary ? 11 : 9, fontSize: primary ? 16 : 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed" }}>{child}</div>
  );
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "16px 30px 20px", background: "#fff", opacity: 0.7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {btn("⏮")}{btn("▶", true)}{btn("⏭")}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 4, background: "#e6e9e5" }} />
          <span style={{ fontFamily: mono, fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>t = <span style={{ color: "var(--green-d)", fontWeight: 500 }}>0</span> / {Math.max(0, rounds - 1)}</span>
        </div>
      </div>
    </div>
  );
}

export function NewRunBody() {
  const mech = useStore((s) => s.mech);
  const rounds = useStore((s) => s.rounds);
  const labels = STAT_LABELS[mech] || STAT_LABELS.fish;

  return (
    <>
      <div style={{ padding: "22px 30px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--amber)" }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--amber)" }}>New run · not started</span>
          </div>
          <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 27, letterSpacing: "-.3px", margin: 0 }}>{TITLES[mech] || getMarket(mech).name}</h1>
        </div>
        <div style={{ display: "flex", gap: 26 }}>
          {labels.map((l) => (
            <div key={l}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>{l}</div>
              <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: "#c2ccc4" }}>—</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "14px 24px 6px", minHeight: 0, display: "flex", alignItems: "center" }}>
        <EmptyChart />
      </div>

      <DisabledTransport rounds={rounds} />
      <div style={{ padding: "0 30px 18px", background: "#fff" }}>
        <FlowStrip />
      </div>
    </>
  );
}

export function NewRunAside() {
  const cohorts = useStore((s) => s.cohorts);
  return (
    <aside style={{ background: "#fff", padding: "24px 22px", overflowY: "auto", borderLeft: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>What each agent is thinking</div>
      <div style={{ fontFamily: mono, fontSize: 11.5, color: "var(--muted)", marginBottom: 18 }}>not run yet — press ▶ Run</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {cohorts.map((co, i) => {
          const color = agentColor(i);
          return (
            <div key={co.id} style={{ border: "1px dashed var(--border)", borderRadius: 13, padding: 16, background: "#fcfdfc" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: color, opacity: 0.5 }} />
                  <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>{co.name}</span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: "var(--muted)" }}>×{co.n}</span>
                </div>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{co.policy === "claude" ? "Claude" : "det"}</span>
              </div>
              <div style={{ display: "flex", gap: 18, marginBottom: 12 }}>
                {["price", "profit"].map((k) => (
                  <div key={k}>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</div>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 500, color: "#c2ccc4" }}>—</div>
                  </div>
                ))}
              </div>
              {co.persona && (
                <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted)", borderLeft: `2px solid ${color}`, paddingLeft: 12, fontStyle: "italic", opacity: 0.7 }}>
                  {co.persona}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
