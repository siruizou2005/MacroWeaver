import { useEffect, useState } from "react";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

type Block = { h?: string; p?: string };

interface Post {
  id: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  title: string;
  date: string;
  author: string;
  excerpt: string;
  body: Block[];
}

// Research write-ups and platform notes. Replace / extend these with real posts.
const POSTS: Post[] = [
  {
    id: "collusion-emerges",
    tag: "Research",
    tagColor: "var(--green-d)",
    tagBg: "var(--green-l)",
    title: "Algorithmic collusion emerges without communication",
    date: "Jun 2026",
    author: "MacroWeaver team",
    excerpt:
      "Running the Oligopoly Pricing preset, pricing agents drift from the competitive Bertrand level toward the monopoly price — supra-competitive prices with no explicit agreement.",
    body: [
      { p: "We reproduced the headline result of Fish et al. (2024): LLM pricing agents on a logit-demand market converge to supra-competitive prices without ever communicating. Each firm only sees rivals' recent prices and its own profit history, yet prices settle well above the Bertrand–Nash equilibrium." },
      { h: "Setup" },
      { p: "Two firms, T=48 rounds, logit demand with μ=0.25. Each round every agent sets a price simultaneously; the market settles demand and profit, and writes the outcome back into each agent's memory. The Bertrand and monopoly prices are drawn as benchmarks on the replay chart." },
      { h: "What we saw" },
      { p: "Mean price climbs from roughly 1.47 toward 1.92 over the run — a collusion index that rises steadily as the agents learn that softening competition raises joint profit. Scrub the replay round by round and each agent's reasoning note shows the logic: undercutting triggers retaliation, so holding price is individually rational." },
      { h: "Why it matters" },
      { p: "The behavior is emergent, not programmed. It is the kind of system-level outcome the platform is built to surface: place agents around an objective market, let the rules settle each round, and watch macro behavior arise from micro decisions." },
    ],
  },
  {
    id: "one-kernel-three-papers",
    tag: "Methods",
    tagColor: "var(--indigo)",
    tagBg: "var(--indigo-l)",
    title: "One kernel, three papers: the swappable-market design",
    date: "Jun 2026",
    author: "MacroWeaver team",
    excerpt:
      "The same five-primitive agent pipeline runs around a market that is the only swappable block. Change the center and the engine reproduces a different paper.",
    body: [
      { p: "MacroWeaver is built on one fixed loop — Population·Agents → Market → Observation → Scheduler → Recorder → write-back — where the Market is the only block you swap. The agent pipeline (profile, perception, memory, decision, reflection) is identical across markets; heterogeneity lives entirely in the cohort config." },
      { h: "Three markets ship today" },
      { p: "Oligopoly Pricing reproduces algorithmic collusion on logit demand. EconAgent · Macro drives wages, prices and inflation from household work/consume decisions." },
      { h: "Why a single kernel" },
      { p: "Swapping only the market isolates the variable under study. If the same agents produce collusion in one market and realistic inflation dynamics in another, the result is a property of the agent behavior, not of bespoke per-paper scaffolding." },
    ],
  },
  {
    id: "reading-an-agents-mind",
    tag: "Platform",
    tagColor: "var(--amber)",
    tagBg: "#f7efe2",
    title: "Reading an agent's mind: reasoning notes in replay",
    date: "Jun 2026",
    author: "MacroWeaver team",
    excerpt:
      "Every run serializes to a deterministic trace. Scrub the timeline and each agent's one-line reasoning note tells you exactly what it was thinking that round.",
    body: [
      { p: "A deterministic run is byte-exact reproducible and serializes to a self-contained trace.json — no API jitter on stage. The replay view lets you scrub the run round by round, watch the headline series track its benchmarks, and read each agent's reasoning note for that round." },
      { h: "Record once, replay offline" },
      { p: "Record a run once with live LLM agents (ANTHROPIC_API_KEY), then replay that trace offline forever — the kernel re-runs the market with the same seed, so it regenerates byte-for-byte. Same pipeline, no API jitter on stage." },
      { h: "From console to replay" },
      { p: "Open the console, pick a preset, tune the rules, and run. The engine streams each round live; when it finishes you land in replay, where the whole story is yours to inspect." },
    ],
  },
];

function PostList({ onOpen }: { onOpen: (p: Post) => void }) {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "72px 32px 120px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: ".18em", color: "var(--green)", textTransform: "uppercase", marginBottom: 22 }}>Blog</div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 56, lineHeight: 1.05, letterSpacing: "-1px", margin: 0 }}>Research & writing</h1>
      <p style={{ fontSize: 19, lineHeight: 1.6, color: "var(--muted)", margin: "24px 0 0" }}>
        Results from running simulations on MacroWeaver, plus notes on the platform and the papers it reproduces.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 48 }}>
        {POSTS.map((p) => (
          <article
            key={p.id}
            onClick={() => onOpen(p)}
            className="mw-card-hover"
            style={{ border: "1px solid var(--border)", borderRadius: 15, padding: "26px 28px", background: "#fff", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: p.tagColor, background: p.tagBg, padding: "4px 9px", borderRadius: 5 }}>{p.tag}</span>
              <span style={{ fontFamily: mono, fontSize: 12, color: "var(--muted)" }}>{p.date}</span>
            </div>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 26, letterSpacing: "-.3px", margin: "0 0 10px" }}>{p.title}</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>{p.excerpt}</p>
            <span style={{ display: "inline-block", marginTop: 16, fontSize: 14.5, fontWeight: 600, color: "var(--link)" }}>Read →</span>
          </article>
        ))}
      </div>
    </main>
  );
}

function PostView({ post, onBack }: { post: Post; onBack: () => void }) {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 32px 120px" }}>
      <span onClick={onBack} style={{ fontSize: 14.5, fontWeight: 600, color: "var(--link)", cursor: "pointer" }}>← Back to blog</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "34px 0 16px" }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: post.tagColor, background: post.tagBg, padding: "4px 9px", borderRadius: 5 }}>{post.tag}</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: "var(--muted)" }}>{post.date} · {post.author}</span>
      </div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 44, lineHeight: 1.08, letterSpacing: "-.6px", margin: 0 }}>{post.title}</h1>
      <div style={{ marginTop: 34 }}>
        {post.body.map((b, i) =>
          b.h ? (
            <h2 key={i} style={{ fontFamily: serif, fontWeight: 600, fontSize: 24, letterSpacing: "-.3px", margin: "36px 0 12px" }}>{b.h}</h2>
          ) : (
            <p key={i} style={{ fontSize: 17, lineHeight: 1.75, color: "var(--ink)", margin: "0 0 18px" }}>{b.p}</p>
          ),
        )}
      </div>
    </main>
  );
}

export function Blog() {
  const [active, setActive] = useState<Post | null>(null);
  // list↔post is local state (screen stays "blog"), so App's screen-scroll reset never
  // fires — reset here so opening a post from low in the list doesn't land mid-page.
  useEffect(() => { window.scrollTo(0, 0); }, [active]);
  if (active) return <PostView post={active} onBack={() => setActive(null)} />;
  return <PostList onOpen={setActive} />;
}
