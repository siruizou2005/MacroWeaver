import { useStore } from "../store";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

function Code({ children }: { children: any }) {
  return <span style={{ fontFamily: mono, fontSize: "0.88em", color: "var(--green-d)", background: "var(--green-l)", padding: "1px 6px", borderRadius: 5 }}>{children}</span>;
}

function Section({ kicker, title, children }: { kicker: string; title: string; children: any }) {
  return (
    <section style={{ marginTop: 56 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".14em", color: "var(--green)", textTransform: "uppercase", marginBottom: 10 }}>{kicker}</div>
      <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: 30, letterSpacing: "-.4px", margin: "0 0 16px" }}>{title}</h2>
      <div style={{ fontSize: 16, lineHeight: 1.7, color: "var(--muted)" }}>{children}</div>
    </section>
  );
}

const markets = [
  { name: "Oligopoly Pricing", type: "fish_calvano", body: "Pricing LLMs on a logit-demand market. Watch price drift from the competitive Bertrand level toward the monopoly price — algorithmic collusion with no communication." },
  { name: "EconAgent · Macro", type: "econagent", body: "Household agents make work/consume decisions that aggregate into wages, prices, employment and inflation (CPI)." },
  { name: "TwinMarket · CLOB", type: "clob", body: "A central limit order book where fundamentalist, momentum and noise traders post orders; traded price tracks fair value." },
];

export function Docs() {
  const nav = useStore((s) => s.nav);
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "72px 32px 120px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: ".18em", color: "var(--green)", textTransform: "uppercase", marginBottom: 22 }}>Documentation</div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 56, lineHeight: 1.05, letterSpacing: "-1px", margin: 0 }}>How MacroWeaver works</h1>
      <p style={{ fontSize: 19, lineHeight: 1.6, color: "var(--muted)", margin: "24px 0 0" }}>
        MacroWeaver is a generative socio-economic simulation platform. One fixed agent pipeline runs around
        a swappable market — change the market at the center and the same engine reproduces a different paper.
      </p>

      <Section kicker="The kernel" title="Five primitives, one swappable block">
        <p style={{ margin: 0 }}>
          Every run is the same five-step loop:{" "}
          <Code>Population·Agents → Market → Observation → Scheduler → Recorder → write-back</Code>.
          The kernel is paper-agnostic; the <strong style={{ color: "var(--ink)" }}>Market</strong> is the only block you swap.
          Each agent perceives the world, decides, and the market settles the round into objective outcomes that feed the next one.
        </p>
      </Section>

      <Section kicker="Markets" title="Three markets ship today">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
          {markets.map((m) => (
            <div key={m.type} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 18, color: "var(--ink)" }}>{m.name}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: "var(--muted)" }}>{m.type}</span>
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: "8px 0 0" }}>{m.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="Determinism" title="Every run is byte-exact reproducible">
        <p style={{ margin: 0 }}>
          A deterministic run serializes to a self-contained <Code>trace.json</Code> — no API jitter on stage.
          Without an API key the engine falls back to deterministic heuristics, so every demo runs offline and
          still produces the curve. Set <Code>ANTHROPIC_API_KEY</Code> to let real LLM agents drive decisions instead.
        </p>
      </Section>

      <Section kicker="Workflow" title="From console to replay">
        <p style={{ margin: 0 }}>
          Open the console, pick a preset, inspect the agents and tune the rules, then <strong style={{ color: "var(--ink)" }}>Run</strong>.
          The engine streams each round live; when it finishes you land in <strong style={{ color: "var(--ink)" }}>Replay</strong>,
          where you can scrub the timeline round by round and read each agent's reasoning note.
        </p>
      </Section>

      <div style={{ display: "flex", gap: 14, marginTop: 56 }}>
        <button onClick={() => nav("console")} style={{ fontFamily: "inherit", fontSize: 16, fontWeight: 600, color: "#fff", background: "var(--green)", border: "none", padding: "14px 28px", borderRadius: 10, cursor: "pointer" }}>
          Open the console
        </button>
        <button onClick={() => nav("replay")} style={{ fontFamily: "inherit", fontSize: 16, fontWeight: 600, color: "var(--green-d)", background: "#fff", border: "1.5px solid var(--border)", padding: "14px 28px", borderRadius: 10, cursor: "pointer" }}>
          Watch a replay →
        </button>
      </div>
    </main>
  );
}
