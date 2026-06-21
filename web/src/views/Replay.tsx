import { useEffect } from "react";
import { useStore } from "../store";
import { PriceChart } from "../replay/PriceChart";
import { Transport } from "../replay/Transport";
import { FlowStrip } from "../replay/FlowStrip";
import { ThinkingCards } from "../replay/ThinkingCards";

const serif = "'Spectral',serif";

export function Replay() {
  const trace = useStore((s) => s.trace);
  const traces = useStore((s) => s.traces);
  const round = useStore((s) => s.round);
  const loadTrace = useStore((s) => s.loadTrace);

  // auto-load a trace if none is open yet (prefer the freshest; else the golden)
  useEffect(() => {
    if (trace) return;
    if (traces.length) loadTrace(traces[0].id);
    else loadTrace("golden/fish_calvano");
  }, [trace, traces, loadTrace]);

  if (!trace) {
    return (
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 68px)", color: "var(--muted)", fontFamily: serif, fontSize: 20 }}>
        Loading trace…
      </main>
    );
  }

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

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 340px", height: "calc(100vh - 68px)" }}>
      <section style={{ display: "flex", flexDirection: "column", minWidth: 0, borderRight: "1px solid var(--border)" }}>
        <div style={{ padding: "22px 30px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--green)", marginBottom: 7 }}>Golden trace · replay</div>
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

        <Transport />
        <div style={{ padding: "0 30px 18px", background: "#fff" }}>
          <FlowStrip />
        </div>
      </section>
      <ThinkingCards />
    </main>
  );
}
