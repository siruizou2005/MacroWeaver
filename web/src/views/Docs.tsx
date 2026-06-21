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
];

const preStyle = {
  fontFamily: mono, fontSize: 12.5, lineHeight: 1.55, color: "var(--green-d)",
  background: "var(--green-l)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "16px 18px", overflowX: "auto" as const, marginTop: 16, whiteSpace: "pre" as const,
};

const MECHANISM_TEMPLATE = `from macroweaver.market import (
    Market, register, AgentAction, Outcome, MarketObservation,
)
from pydantic import BaseModel

class MyDecision(BaseModel):
    bid: float

@register("my_mechanism")          # <- this name becomes the preset's market.type
class MyMarket(Market):
    def init_world(self, params, agents, rng):
        return {"last": 0.0}

    def build_observation(self, state, agent_id, round_no):
        return MarketObservation(public={"last": state["last"]}, private={})

    def settle(self, actions, state, round_no, rng):           # pure: draw randomness from rng
        bids = [a.payload.get("bid", 0.0) for a in actions]
        clearing = sum(bids) / max(1, len(bids))
        outs = [Outcome(a.agent_id, {"bid": a.payload.get("bid", 0.0),
                                     "clearing": clearing}) for a in actions]
        return outs, {**state, "last": clearing}

    def public_series(self, state, outcomes, round_no):
        return {"clearing": state["last"]}

    def benchmarks(self, params):
        return {}

    def decision_schema(self):
        return MyDecision

    def parse_decision(self, raw, agent_id):
        return AgentAction(agent_id, "bid", {"bid": float(raw["bid"])})`;

export function Docs() {
  const nav = useStore((s) => s.nav);
  const watchReplay = useStore((s) => s.watchReplay);
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

      <Section kicker="Extend" title="Author your own mechanism">
        <p style={{ margin: 0 }}>
          The market is the one swappable block, and it's open. Write a Python class that subclasses{" "}
          <Code>Market</Code> and implement the seven hooks — <Code>init_world</Code>, <Code>build_observation</Code>,{" "}
          <Code>settle</Code>, <Code>public_series</Code>, <Code>benchmarks</Code>, <Code>decision_schema</Code> and{" "}
          <Code>parse_decision</Code> — then decorate it <Code>@register("my_mechanism")</Code>. Save the draft from the
          console (or drop the file in <Code>mechanisms/</Code>) and reference its name as a preset's <Code>market.type</Code>.
          Everything else — the agent pipeline, the Q&amp;A record, replay — is shared for free.
        </p>
        <pre style={preStyle}>{MECHANISM_TEMPLATE}</pre>
        <p style={{ margin: "18px 0 0" }}>
          <strong style={{ color: "var(--ink)" }}>settle() must be pure.</strong> Draw all randomness from the passed-in{" "}
          <Code>rng</Code> — never <Code>random</Code> seeded yourself, nor wall-clock time — so a recorded run replays faithfully.
        </p>
        <p style={{ margin: "16px 0 0" }}>
          <strong style={{ color: "var(--ink)" }}>Sandbox.</strong> Mechanisms run in an isolated subprocess and may import only{" "}
          <Code>numpy · math · statistics · random · dataclasses · typing · pydantic · collections · itertools · functools</Code>{" "}
          and the <Code>macroweaver.market</Code> types. <Code>os</Code>, <Code>subprocess</Code>, file I/O, <Code>eval</Code>/<Code>exec</Code>{" "}
          and network libraries are blocked at load time. A mechanism has no network access and no API key — it cannot call an LLM,
          so it is exercised via record + replay. This is local-trust isolation for a single-user tool, not a defense against
          deliberately malicious code: only run drafts you understand.
        </p>
      </Section>

      <Section kicker="Determinism" title="Record once, replay forever">
        <p style={{ margin: 0 }}>
          Every run serializes to a self-contained <Code>trace.json</Code> — no API jitter on stage. There is no
          algorithmic stand-in: record a run once with live LLM agents (<Code>ANTHROPIC_API_KEY</Code>), then{" "}
          <strong style={{ color: "var(--ink)" }}>replay</strong> that trace offline forever — the kernel re-runs the
          market with the same seed, so the whole event stream regenerates byte-for-byte.
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
        <button onClick={watchReplay} style={{ fontFamily: "inherit", fontSize: 16, fontWeight: 600, color: "var(--green-d)", background: "#fff", border: "1.5px solid var(--border)", padding: "14px 28px", borderRadius: 10, cursor: "pointer" }}>
          Watch a replay →
        </button>
      </div>
    </main>
  );
}
