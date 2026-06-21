import { useEffect, useState, type CSSProperties } from "react";
import { useStore } from "../../store";
import { MARKETS } from "../marketFields";
import type { Mech } from "../../types";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

// shared red "destructive" pill for the card delete / un-publish buttons
const delBtn: CSSProperties = {
  position: "absolute", top: 8, right: 8, fontFamily: "inherit", fontSize: 11, fontWeight: 600,
  color: "#a8443c", background: "#fbf1f0", border: "1px solid #ecd5d2", borderRadius: 7,
  padding: "4px 9px", cursor: "pointer", lineHeight: 1,
};
// armed (second-click-to-confirm) state — solid red
const delBtnArmed: CSSProperties = { ...delBtn, color: "#fff", background: "#a8443c", border: "1px solid #a8443c", fontWeight: 700 };

const ACCENT: Record<Mech, { fg: string; bg: string }> = {
  fish: { fg: "var(--green-d)", bg: "var(--green-l)" },
  econ: { fg: "var(--amber)", bg: "#f7efe2" },
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "mechanism";
}

// A fork-and-edit starter that already implements the Market ABC + @register.
const MECH_TEMPLATE = `from macroweaver.market import (
    Market, register, AgentAction, Outcome, MarketObservation,
)
from pydantic import BaseModel


class MyDecision(BaseModel):
    bid: float


@register("my_mechanism")          # auto-synced to your mechanism name on save
class MyMarket(Market):
    def init_world(self, params, agents, rng):
        return {"last": 0.0}

    def build_observation(self, state, agent_id, round_no):
        return MarketObservation(public={"last": state["last"]}, private={})

    def settle(self, actions, state, round_no, rng):     # pure: draw randomness from rng
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
        return AgentAction(agent_id, "bid", {"bid": float(raw["bid"])})
`;

// Author / upload a Python mechanism: name + code → save (server) → validate (engine AST gate +
// ABC smoke). On success the new mechanism is opened as a from-scratch world.
function MechanismEditor({ onClose, onDone }: { onClose: () => void; onDone: (type: string) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(MECH_TEMPLATE);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "err"; msg?: string }>({ kind: "idle" });
  const slug = slugify(name || "mechanism");

  const save = async () => {
    if (!name.trim()) { setStatus({ kind: "err", msg: "Give the mechanism a name first." }); return; }
    setStatus({ kind: "busy", msg: "Saving + validating…" });
    // force @register(...) to match the slug so the engine can find the class
    const src = code.replace(/@register\(\s*["'][^"']*["']\s*\)/, `@register("${slug}")`);
    try {
      const r = await fetch("/api/mechanisms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: slug, source: src }) });
      if (!r.ok) { setStatus({ kind: "err", msg: (await r.json().catch(() => ({} as any))).error || "save failed" }); return; }
      const v = await fetch(`/api/mechanisms/${slug}/validate`, { method: "POST" });
      const verdict = await v.json().catch(() => ({ ok: false, error: "no verdict from validator" }));
      if (verdict.ok) { setStatus({ kind: "ok", msg: "Valid ✓ — opening…" }); setTimeout(() => onDone(slug), 350); }
      else setStatus({ kind: "err", msg: verdict.line ? `${verdict.error} (line ${verdict.line})` : verdict.error });
    } catch (e: any) { setStatus({ kind: "err", msg: e.message }); }
  };

  const statusColor = status.kind === "ok" ? "var(--green-d)" : status.kind === "err" ? "#a8443c" : "var(--muted)";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,30,24,.45)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(820px,96vw)", maxHeight: "90vh", overflow: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "0 24px 60px -24px rgba(20,40,28,.5)", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 22, margin: 0 }}>Author a mechanism · Python</h2>
          <span onClick={onClose} style={{ fontSize: 22, color: "#aab3ab", cursor: "pointer", lineHeight: 1 }}>×</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 14px", lineHeight: 1.5 }}>
          Subclass <span style={{ fontFamily: mono }}>Market</span> and implement the seven hooks. It runs in a sandboxed
          subprocess (allowlisted imports only: numpy · math · pydantic · …; no <span style={{ fontFamily: mono }}>os</span> /
          network / file I/O). No golden trace exists yet, so the first run must be live (Claude).
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <input
            value={name}
            placeholder="mechanism name (e.g. Sealed-bid auction)"
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, fontFamily: "inherit", fontSize: 14, color: "var(--ink)", background: "#f7faf8", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px" }}
          />
          <span style={{ fontFamily: mono, fontSize: 11.5, color: "var(--muted)" }}>type · {slug}</span>
        </div>
        <textarea
          value={code}
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          rows={20}
          style={{ width: "100%", boxSizing: "border-box", fontFamily: mono, fontSize: 12, lineHeight: 1.5, color: "var(--green-d)", background: "#fbfdfb", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", resize: "vertical" }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 12 }}>
          <span style={{ fontSize: 12.5, color: statusColor, fontFamily: status.kind === "err" ? mono : "inherit", flex: 1, minWidth: 0 }}>{status.msg || ""}</span>
          <button onClick={onClose} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--muted)", background: "#fff", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 16px", cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={status.kind === "busy"} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--green)", border: "none", borderRadius: 9, padding: "9px 18px", cursor: status.kind === "busy" ? "default" : "pointer", opacity: status.kind === "busy" ? 0.6 : 1 }}>Validate &amp; save</button>
        </div>
      </div>
    </div>
  );
}

// modal shown by "Start from scratch": pick a built-in market OR a user-authored Python mechanism
// for a new world (or author a new one), then enter the console.
function MarketChooser({ onClose }: { onClose: () => void }) {
  const openPreset = useStore((s) => s.openPreset);
  const setMech = useStore((s) => s.setMech);
  const mechanisms = useStore((s) => s.mechanisms);
  const refreshMechanisms = useStore((s) => s.refreshMechanisms);
  const openMechanism = useStore((s) => s.openMechanism);
  const [editing, setEditing] = useState(false);
  useEffect(() => { refreshMechanisms(); }, [refreshMechanisms]);

  const pick = (m: Mech) => { openPreset("blank"); setMech(m); }; // navigates into the empty console
  const card: CSSProperties = { border: "1px solid var(--border)", borderRadius: 13, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, minHeight: 168 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,30,24,.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(820px,94vw)", background: "#fff", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "0 24px 60px -24px rgba(20,40,28,.5)", padding: "24px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 24, margin: 0 }}>Pick a market</h2>
          <span onClick={onClose} style={{ fontSize: 22, color: "#aab3ab", cursor: "pointer", lineHeight: 1 }}>×</span>
        </div>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "8px 0 20px", maxWidth: 560 }}>
          The market is the only swappable block — pick a built-in, your own Python mechanism, or author a new one. It's fixed once you start; you'll add agents next.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {MARKETS.map((spec) => {
            const a = ACCENT[spec.mech];
            return (
              <div key={spec.type} onClick={() => pick(spec.mech)} className="mw-card-hover" style={card}>
                <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, alignSelf: "flex-start", color: a.fg, background: a.bg, padding: "3px 8px", borderRadius: 6 }}>{spec.type}</span>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 18 }}>{spec.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45, flex: 1 }}>{spec.blurb}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{spec.params.length} params · {spec.action}</div>
              </div>
            );
          })}
          {mechanisms.map((mech) => (
            <div key={mech.id} onClick={() => openMechanism(mech.id)} className="mw-card-hover" style={card}>
              <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, alignSelf: "flex-start", color: "var(--indigo)", background: "var(--indigo-l)", padding: "3px 8px", borderRadius: 6 }}>{mech.id}</span>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 18 }}>{mech.id}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45, flex: 1 }}>Your Python mechanism. Add agents, then run live (Claude) to record its first trace.</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: "var(--indigo)" }}>custom · Python</div>
            </div>
          ))}
          <div onClick={() => setEditing(true)} style={{ ...card, border: "1.5px dashed #cfd6cf", background: "#fcfdfc", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
            <span style={{ fontSize: 30, fontWeight: 300, lineHeight: 1 }}>{"</>"}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Create your own</span>
            <span style={{ fontSize: 12, textAlign: "center" }}>author a mechanism in Python</span>
          </div>
        </div>
      </div>
      {editing && <MechanismEditor onClose={() => setEditing(false)} onDone={(type) => { setEditing(false); openMechanism(type); }} />}
    </div>
  );
}

function PresetCard({ chips, badge, badgeColor, badgeBg, title, body, svg, onClick }: any) {
  return (
    <div onClick={onClick} className="mw-card-hover" style={{ border: "1px solid var(--border)", borderRadius: 15, background: "#fff", overflow: "hidden", cursor: "pointer" }}>
      <div style={{ height: 110, background: svg.bg, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)" }}>{svg.el}</div>
      <div style={{ padding: 18 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: badgeColor, background: badgeBg, padding: "4px 9px", borderRadius: 5 }}>{badge}</span>
        <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "12px 0 6px" }}>{title}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted)", margin: "0 0 14px" }}>{body}</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
          {chips.map((c: string) => <span key={c} style={{ border: "1px solid var(--border)", borderRadius: 5, padding: "3px 7px" }}>{c}</span>)}
        </div>
      </div>
    </div>
  );
}

const fishSvg = {
  bg: "linear-gradient(180deg,#f1f7f3,#e7f1ea)",
  el: (
    <svg width="170" height="64" viewBox="0 0 180 74">
      <line x1="8" y1="56" x2="172" y2="56" stroke="#c5d3ca" strokeWidth="1" />
      <line x1="8" y1="20" x2="172" y2="20" stroke="#cdb89a" strokeWidth="1" strokeDasharray="3 3" />
      <path d="M8 52 L30 50 L52 44 L74 36 L96 30 L118 26 L140 24 L172 23" fill="none" stroke="#1c7a4b" strokeWidth="2.5" />
      <path d="M8 54 L30 53 L52 49 L74 41 L96 33 L118 28 L140 26 L172 25" fill="none" stroke="#2f6f8f" strokeWidth="2" />
    </svg>
  ),
};
const econSvg = {
  bg: "linear-gradient(180deg,#f8f3ea,#f2e9da)",
  el: (
    <svg width="170" height="64" viewBox="0 0 180 74">
      <line x1="8" y1="56" x2="172" y2="56" stroke="#d8c6a6" strokeWidth="1" />
      <path d="M8 50 L30 46 L52 48 L74 40 L96 42 L118 34 L140 36 L172 30" fill="none" stroke="#bd7a2a" strokeWidth="2.5" />
      <path d="M8 53 L30 50 L52 51 L74 47 L96 45 L118 42 L140 40 L172 38" fill="none" stroke="#8a8f88" strokeWidth="2" strokeDasharray="4 3" />
    </svg>
  ),
};

export function PresetsPanel() {
  const openPreset = useStore((s) => s.openPreset);
  const savedConfigs = useStore((s) => s.savedConfigs);
  const loadSavedConfig = useStore((s) => s.loadSavedConfig);
  const deleteSavedConfig = useStore((s) => s.deleteSavedConfig);
  const [choosing, setChoosing] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null); // saved-config delete armed?

  return (
    <div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 40, letterSpacing: "-.4px", margin: 0 }}>Choose a preset</h1>
      <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--muted)", maxWidth: 660, margin: "14px 0 0" }}>
        Each preset is one <span style={{ fontFamily: mono, fontSize: 14 }}>config</span> plus a recorded golden{" "}
        <span style={{ fontFamily: mono, fontSize: 14 }}>trace</span>. Open it on the console to inspect the world, tune the rules, or swap the market.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 18, marginTop: 30 }}>
        <PresetCard chips={["100 agents", "T=240"]} badge="Demo" badgeColor="var(--amber)" badgeBg="#f7efe2" title="EconAgent · Macro" body="Households drive wages, prices, jobs (Li et al. 2024)." svg={econSvg} onClick={() => openPreset("econ")} />
        <PresetCard chips={["μ=0.25", "T=48", "2 firms"]} badge="Quantitative" badgeColor="var(--green-d)" badgeBg="var(--green-l)" title="Oligopoly Pricing" body="Pricing firms collude on logit demand." svg={fishSvg} onClick={() => openPreset("fish")} />
        <div
          onClick={() => setChoosing(true)}
          style={{ border: "1.5px dashed #cfd6cf", borderRadius: 15, background: "#fcfdfc", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 240, color: "var(--muted)" }}
        >
          <span style={{ fontSize: 34, fontWeight: 300, lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>Start from scratch</span>
          <span style={{ fontSize: 12.5, maxWidth: 170, textAlign: "center" }}>Pick a market, then add agents</span>
        </div>
      </div>

      {choosing && <MarketChooser onClose={() => setChoosing(false)} />}

      {savedConfigs.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "0 0 14px" }}>Saved configs</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
            {savedConfigs.map((c) => {
              const armed = confirmId === c.id;
              return (
              <div key={c.id} onClick={() => loadSavedConfig(c.id)} onMouseLeave={() => setConfirmId((p) => (p === c.id ? null : p))} className="mw-card-hover" style={{ position: "relative", border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "#fff", cursor: "pointer" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); if (armed) { deleteSavedConfig(c.id); setConfirmId(null); } else setConfirmId(c.id); }}
                  title={armed ? "Click again to confirm" : "Delete this saved config"}
                  style={armed ? delBtnArmed : delBtn}
                >
                  {armed ? "Confirm?" : "✕ Delete"}
                </button>
                <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{c.market || "config"}</div>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 16, margin: "4px 0", paddingRight: 58 }}>{c.run_name || c.id}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>{c.rounds ? `T=${c.rounds} · ` : ""}edit ▸</div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
