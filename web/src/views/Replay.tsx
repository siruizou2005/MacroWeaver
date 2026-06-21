import { useEffect } from "react";
import { useStore, viewTrace, viewRound } from "../store";
import { PriceChart } from "../replay/PriceChart";
import { Transport } from "../replay/Transport";
import { FlowStrip } from "../replay/FlowStrip";
import { ThinkingCards } from "../replay/ThinkingCards";
import { AgentQA } from "../replay/AgentQA";
import { RunBar } from "../replay/RunBar";
import { NewRunBody, NewRunAside } from "../replay/NewRun";

const serif = "'Spectral',serif";

export function Replay() {
  const trace = useStore(viewTrace);
  const round = useStore(viewRound);
  const running = useStore((s) => s.running);
  const selectedAgentId = useStore((s) => s.selectedAgentId);
  const refreshTraces = useStore((s) => s.refreshTraces);

  // keep the replay picker fresh when the page opens
  useEffect(() => { refreshTraces(); }, [refreshTraces]);

  // new-run mode (the default): no trace open and not streaming → an empty scaffold of the
  // configured world. A loaded trace ⇒ replay; a live stream ⇒ live. So empty = new run.
  const newRun = !running && !trace;
  const booting = running && (!trace || trace.T < 1); // run started, first round not in yet

  const shell = (body: React.ReactNode, aside: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 68px)" }}>
      <RunBar />
      <main style={{ display: "grid", gridTemplateColumns: "1fr 340px", flex: 1, minHeight: 0 }}>
        <section style={{ display: "flex", flexDirection: "column", minWidth: 0, borderRight: "1px solid var(--border)" }}>{body}</section>
        {aside}
      </main>
    </div>
  );
  const blankAside = <aside style={{ background: "#fff", borderLeft: "1px solid var(--border)" }} />;

  if (newRun) return shell(<NewRunBody />, <NewRunAside />);
  if (booting) return shell(
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontFamily: serif, fontSize: 20 }}>Starting run…</div>,
    blankAside,
  );
  if (!trace) return shell(
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontFamily: serif, fontSize: 20 }}>Loading trace…</div>,
    blankAside,
  );

  const r = Math.min(round, trace.T - 1);
  const series: any = trace.series;
  const at = (arr: number[] | undefined, fb = 0) => (arr && arr[r] != null ? arr[r] : fb);
  // per-market headline stats
  let stats: { label: string; value: string; color?: string }[];
  if (trace.market === "econagent") {
    stats = [
      { label: "CPI", value: at(series.mean_price).toFixed(1) },
      { label: "Inflation %", value: at(series.inflation).toFixed(2), color: "var(--amber)" },
      { label: "Unemployment %", value: at(series.unemployment).toFixed(1), color: "var(--green)" },
    ];
  } else if (trace.market === "clob") {
    stats = [
      { label: "Last price", value: at(series.mean_price).toFixed(2) },
      { label: "Return %", value: at(series.return_pct).toFixed(2), color: "var(--teal)" },
    ];
  } else {
    stats = [
      { label: "Mean price", value: at(series.mean_price).toFixed(2) },
      { label: "Collusion index", value: Math.round(at(series.collusion_index) * 100) + "%", color: "var(--green)" },
    ];
  }
  const title =
    trace.market === "fish_calvano" ? "Oligopoly Pricing — price vs. benchmarks" :
    trace.market === "econagent" ? "EconAgent · Macro — CPI & inflation" :
    "CLOB — traded price vs. fair value";

  return shell(
    <>
      <div style={{ padding: "22px 30px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--green)", marginBottom: 7 }}>
            {running ? "Live run · streaming" : "Replay"}
          </div>
          <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 27, letterSpacing: "-.3px", margin: 0 }}>{title}</h1>
        </div>
        <div style={{ display: "flex", gap: 26 }}>
          {stats.map((st) => (
            <div key={st.label}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>{st.label}</div>
              <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: st.color || "var(--ink)" }}>{st.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "14px 24px 6px", minHeight: 0, display: "flex", alignItems: "center" }}>
        <PriceChart />
      </div>

      {/* scrubbing transport only when reviewing a finished trace; a live run is pinned to its edge */}
      {!running && <Transport />}
      <div style={{ padding: "0 30px 18px", background: "#fff" }}>
        <FlowStrip />
      </div>
    </>,
    selectedAgentId ? <AgentQA /> : <ThinkingCards />,
  );
}
