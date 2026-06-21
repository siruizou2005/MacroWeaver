import { useState } from "react";
import { useStore } from "../../store";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";
const italic = { fontFamily: `${serif}`, fontStyle: "italic" as const, fontSize: 14 };
const sub = { fontSize: 9, verticalAlign: "sub" as const, lineHeight: 0 };

function V({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: mono, fontSize: 12, color: "var(--green-d)", fontWeight: 600 }}>{children}</span>;
}

export function MetricsPanel() {
  const mech = useStore((s) => s.mech);
  const mp = useStore((s) => s.marketParams);
  const [open, setOpen] = useState(false);

  if (mech !== "fish") return null;

  const mu = mp.mu ?? 0.25;
  const a = mp.a ?? 2;
  const a0 = mp.a0 ?? 0;
  const alpha = mp.alpha ?? 1;
  const beta = mp.beta ?? 100;

  const chips = `μ=${mu}  a=${a}  a₀=${a0}`;

  return (
    <div>
      {/* collapsed: single clickable row */}
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
      >
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--green-l)", color: "var(--green-d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flex: "none" }}>▤</span>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>Demand Function</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", flex: "none" }}>{chips}</span>
        <span style={{ fontSize: 11, color: "var(--muted)", flex: "none", transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}>▸</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 12px", background: "#fcfdfc" }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
              Logit demand (Calvano et al.)
            </div>
            <div style={{ lineHeight: 1.8, fontSize: 13 }}>
              <span style={italic}>q</span><span style={sub}>i</span>
              {" = "}
              <span style={italic}>β</span>
              {" · "}
              <span style={{ fontSize: 12 }}>exp((<span style={italic}>a</span> − <span style={italic}>p</span><span style={sub}>i</span> / <span style={italic}>α</span>) / <span style={italic}>μ</span>)</span>
              {" / "}
              <span style={{ fontSize: 12 }}>(Σ<span style={sub}>j</span> exp(…) + exp(<span style={italic}>a</span><span style={sub}>0</span> / <span style={italic}>μ</span>))</span>
            </div>
            <div style={{ lineHeight: 1.8, fontSize: 13, marginTop: 1 }}>
              <span style={italic}>π</span><span style={sub}>i</span>
              {" = "}
              (<span style={italic}>p</span><span style={sub}>i</span> − <span style={italic}>α</span> · <span style={italic}>c</span><span style={sub}>i</span>)
              {" · "}
              <span style={italic}>q</span><span style={sub}>i</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
            <ParamCard label="μ" value={mu} />
            <ParamCard label="a" value={a} />
            <ParamCard label="a₀" value={a0} />
            <ParamCard label="α" value={alpha} />
            <ParamCard label="β" value={beta} />
          </div>

          <div style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
            lower <V>μ</V> → price-sensitive · higher <V>a₀</V> → outside option
          </div>
        </div>
      )}
    </div>
  );
}

function ParamCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px" }}>
      <div style={{ fontSize: 9, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
