import { useStore } from "../store";

const mono = "'Spline Sans Mono',monospace";
const serif = "'Spectral',serif";

function Feature({ glyph, title, children }: { glyph: string; title: string; children: any }) {
  return (
    <div>
      <div
        style={{
          width: 46, height: 46, borderRadius: 11, background: "var(--green-l)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, color: "var(--green-d)", marginBottom: 22,
        }}
      >
        {glyph}
      </div>
      <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 30, lineHeight: 1.12, margin: "0 0 14px", color: "var(--green-d)" }}>
        {title}
      </h3>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>{children}</p>
    </div>
  );
}

function PresetCard({
  badge, badgeColor, badgeBg, title, body, onClick,
}: any) {
  return (
    <div
      onClick={onClick}
      className="mw-card-hover"
      style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 30, background: "#fff", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: badgeColor, background: badgeBg, padding: "5px 10px", borderRadius: 6 }}>
          {badge}
        </span>
      </div>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 27, margin: "0 0 8px" }}>{title}</h3>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--muted)", margin: "0 0 20px" }}>{body}</p>
      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--link)" }}>Load preset →</span>
    </div>
  );
}

export function Landing() {
  const openPreset = useStore((s) => s.openPreset);
  const enterConsole = useStore((s) => s.enterConsole);
  const watchReplay = useStore((s) => s.watchReplay);
  return (
    <main>
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 32px 64px", textAlign: "center" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: ".18em", color: "var(--green)", textTransform: "uppercase", marginBottom: 30 }}>
          Generative Socio-Economic Simulation Engine
        </div>
        <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 78, lineHeight: 1.02, letterSpacing: "-1.5px", margin: "0 auto", maxWidth: 880 }}>
          Weave markets from the bottom up.
        </h1>
        <p style={{ fontSize: 21, lineHeight: 1.55, color: "var(--muted)", maxWidth: 680, margin: "30px auto 0" }}>
          Place LLM agents around an objective market. Let the rules settle every round and drive the
          next one — and watch system-level behavior like algorithmic collusion emerge. Then replay it,
          round by round.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 42 }}>
          <button onClick={enterConsole} style={{ fontFamily: "inherit", fontSize: 16, fontWeight: 600, color: "#fff", background: "var(--green)", border: "none", padding: "15px 30px", borderRadius: 10, cursor: "pointer" }}>
            Open the console
          </button>
          <button onClick={watchReplay} style={{ fontFamily: "inherit", fontSize: 16, fontWeight: 600, color: "var(--green-d)", background: "#fff", border: "1.5px solid var(--border)", padding: "15px 30px", borderRadius: 10, cursor: "pointer" }}>
            Watch a replay →
          </button>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 32px 70px" }}>
        <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 30 }}>
          Reproducing results from
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "14px 40px", fontFamily: serif, fontSize: 19, color: "#6d756e" }}>
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>Fish et&nbsp;al. 2024</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>Algorithmic Collusion</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>EconAgent</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>Calvano logit</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>Bertrand–Nash</span>
        </div>
      </section>

      <section style={{ borderTop: "1px solid var(--border)", background: "#fff" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 32px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 56 }}>
          <Feature glyph="◎" title="A world with depth">
            A market at the core, wrapped by an institution layer, an observation layer, then a ring of
            agent cohorts and their social ties. Concentric, not flat — read the structure at a glance,
            drill in when you want.
          </Feature>
          <Feature glyph="◷" title="Run a golden trace">
            Every agent acts at once; the market settles the round into objective outcomes and writes
            back the world. One run serializes to a deterministic <span style={{ fontFamily: mono, fontSize: 14 }}>trace.json</span> — no API jitter on stage.
          </Feature>
          <Feature glyph="◴" title="Replay every round">
            Scrub the timeline and watch price track between the Bertrand and monopoly benchmarks — while
            each agent's reasoning note tells you exactly what it was thinking that round.
          </Feature>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 32px 100px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 36, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: ".16em", color: "var(--green)", textTransform: "uppercase", marginBottom: 14 }}>
              ★ The market is the only swappable block
            </div>
            <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: 42, lineHeight: 1.08, letterSpacing: "-.5px", margin: 0, maxWidth: 560 }}>
              Same agents, different market.
            </h2>
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--muted)", maxWidth: 380, margin: 0 }}>
            Swap the market at the center and the same engine reproduces a different paper. Load a preset,
            inspect the cohorts, tune the rules — then run.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <PresetCard
            badge="Primary · quantitative" badgeColor="var(--green-d)" badgeBg="var(--green-l)"
            title="Oligopoly Pricing"
            body="Pricing LLMs on a Calvano logit market. Watch price drift above the competitive Bertrand level toward the monopoly price — collusion with no communication."
            onClick={() => openPreset("fish")}
          />
          <PresetCard
            badge="Second config · demo" badgeColor="var(--amber)" badgeBg="#f7efe2"
            title="EconAgent · Macro Inflation"
            body="The same agents face a labor & goods market. Work/consume decisions aggregate into wages, prices and employment — proof that only the market block changes."
            onClick={() => openPreset("econ")}
          />
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--border)", background: "#fff" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", fontSize: 13.5, color: "var(--muted)" }}>
          <span>© 2026 MacroWeaver · Generative socio-economic simulation</span>
          <span style={{ display: "flex", gap: 22 }}>
            <span>Engine</span>
            <span>config schema</span>
            <span>trace schema</span>
            <span>GitHub</span>
          </span>
        </div>
      </footer>
    </main>
  );
}
