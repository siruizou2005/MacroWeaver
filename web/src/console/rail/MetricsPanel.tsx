import { useStore } from "../../store";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";
const italic = { fontFamily: `${serif}`, fontStyle: "italic" as const, fontSize: 15 };
const sub = { fontSize: 10, verticalAlign: "sub" as const, lineHeight: 0 };

function V({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: mono, fontSize: 13, color: "var(--green-d)", fontWeight: 600 }}>{children}</span>;
}

export function MetricsPanel() {
  const mech = useStore((s) => s.mech);
  const mp = useStore((s) => s.marketParams);

  if (mech !== "fish") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--green-l)", color: "var(--green-d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▤</span>
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>Metrics · Recorder</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          Select the Oligopoly Pricing market to see the demand function.
        </div>
      </div>
    );
  }

  const mu = mp.mu ?? 0.25;
  const a = mp.a ?? 2;
  const a0 = mp.a0 ?? 0;
  const alpha = mp.alpha ?? 1;
  const beta = mp.beta ?? 100;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--green-l)", color: "var(--green-d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▤</span>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>Demand Function</span>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "16px 14px", background: "#fcfdfc" }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
          Logit demand (Calvano et al.)
        </div>

        {/* q_i */}
        <div style={{ lineHeight: 1.9, fontSize: 14 }}>
          <span style={italic}>q</span><span style={sub}>i</span>
          {" = "}
          <span style={italic}>β</span>
          {" · "}
          <span style={{ fontSize: 13 }}>exp((<span style={italic}>a</span> − <span style={italic}>p</span><span style={sub}>i</span> / <span style={italic}>α</span>) / <span style={italic}>μ</span>)</span>
          {" / "}
          <span style={{ fontSize: 13 }}>(Σ<span style={sub}>j</span> exp(…) + exp(<span style={italic}>a</span><span style={sub}>0</span> / <span style={italic}>μ</span>))</span>
        </div>

        {/* π_i */}
        <div style={{ lineHeight: 1.9, fontSize: 14, marginTop: 2 }}>
          <span style={italic}>π</span><span style={sub}>i</span>
          {" = "}
          (<span style={italic}>p</span><span style={sub}>i</span> − <span style={italic}>α</span> · <span style={italic}>c</span><span style={sub}>i</span>)
          {" · "}
          <span style={italic}>q</span><span style={sub}>i</span>
        </div>
      </div>

      {/* live parameter values */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <ParamCard label="μ  substitution" value={mu} />
        <ParamCard label="a  quality" value={a} />
        <ParamCard label="a₀  outside opt." value={a0} />
        <ParamCard label="α  money scale" value={alpha} />
        <ParamCard label="β  qty scale" value={beta} />
      </div>

      <div style={{ fontFamily: mono, fontSize: 10.5, color: "var(--muted)", marginTop: 12, lineHeight: 1.7 }}>
        lower <V>μ</V> → more price-sensitive<br />
        higher <V>a₀</V> → stronger outside option
      </div>
    </div>
  );
}

function ParamCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: ".04em" }}>{label}</div>
      <div style={{ fontFamily: "'Spectral',serif", fontSize: 18, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}
