import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import YAML from "yaml";
import { SHARED_DIR, PYTHON, ENGINE_DIR, childEnv } from "./config.js";
import {
  listPresets, getPreset, listTraces, getTrace, saveTraceAs,
  listConfigs, getConfig, saveConfig, deleteConfig,
  listTemplates, getTemplate, saveTemplate, deleteTemplate,
  listMechanisms, getMechanism, saveMechanism, deleteMechanism,
} from "./files.js";

export const router = Router();

// Sample the per-agent roster (cohorts → individuals + traits) by running the engine's fast
// `roster` subcommand: feed the config on stdin, collect the JSON it prints to stdout. No sim run.
function sampleRoster(config) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, ["-m", "macroweaver", "roster", "--config", "-"], {
      cwd: ENGINE_DIR, env: childEnv(config?.market?.type),
    });
    let out = "", err = "";
    const timer = setTimeout(() => { try { child.kill("SIGTERM"); } catch { /* ignore */ } reject(new Error("roster timed out")); }, 20000);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || `roster exited ${code}`));
      try { resolve(JSON.parse(out)); } catch (e) { reject(new Error(`bad roster output: ${e.message}`)); }
    });
    child.stdin.on("error", () => { /* surfaced via close/err */ });
    child.stdin.write(YAML.stringify(config));
    child.stdin.end();
  });
}

// Run the engine `validate-mechanism` subcommand for a saved user mechanism and return its
// {ok, error, line} verdict JSON. Spawned with the user-mechanism env (key scrubbed).
function validateMechanism(name) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, ["-m", "macroweaver", "validate-mechanism", "--name", name], {
      cwd: ENGINE_DIR, env: childEnv(name),
    });
    let out = "", err = "";
    const timer = setTimeout(() => { try { child.kill("SIGTERM"); } catch { /* ignore */ } reject(new Error("validation timed out")); }, 20000);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(out)); } catch { reject(new Error(err.trim() || "validation produced no verdict")); }
    });
  });
}

// POST /api/roster  { config } -> { agents: [{id, cohort, cohort_name, name, traits}] }
router.post("/roster", async (req, res) => {
  const config = req.body?.config;
  if (!config || !config.market) return res.status(400).json({ error: "missing config.market" });
  try {
    res.json(await sampleRoster(config));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/health", (_req, res) => res.json({ ok: true }));

router.get("/presets", (_req, res) => res.json(listPresets()));
router.get("/presets/:id", (req, res) => {
  const cfg = getPreset(req.params.id);
  if (!cfg) return res.status(404).json({ error: "not found" });
  res.json(cfg);
});

router.get("/traces", (_req, res) => res.json(listTraces()));
// save a kept, named copy of an existing trace (replay-page "Save run")
router.post("/traces/save", (req, res) => {
  const { id, name } = req.body || {};
  if (!id) return res.status(400).json({ error: "missing id" });
  try {
    res.json({ id: saveTraceAs(id, name) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.get("/traces/*", (req, res) => {
  try {
    const id = req.params[0]; // captures nested ids like "golden/fish_calvano"
    const t = getTrace(id);
    if (!t) return res.status(404).json({ error: "not found" });
    res.json(t);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/configs", (_req, res) => res.json(listConfigs()));
router.get("/configs/:id", (req, res) => {
  const c = getConfig(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
});
router.post("/configs", (req, res) => {
  const { name, config } = req.body || {};
  if (!config || !config.market) return res.status(400).json({ error: "missing config.market" });
  try {
    const id = saveConfig(name || config.run_name, config);
    res.json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.delete("/configs/:id", (req, res) => {
  try {
    deleteConfig(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/templates", (_req, res) => res.json(listTemplates()));
router.get("/templates/:id", (req, res) => {
  const c = getTemplate(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
});
router.post("/templates", (req, res) => {
  const { name, author, config } = req.body || {};
  if (!config || !config.market) return res.status(400).json({ error: "missing config.market" });
  try {
    const id = saveTemplate(name || config.run_name, author, config);
    res.json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.delete("/templates/:id", (req, res) => {
  try {
    deleteTemplate(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- user-authored mechanisms (Market plugins) ----------
router.get("/mechanisms", (_req, res) => res.json(listMechanisms()));
router.get("/mechanisms/:id", (req, res) => {
  const src = getMechanism(req.params.id);
  if (src == null) return res.status(404).json({ error: "not found" });
  res.json({ id: req.params.id, source: src });
});
// save a draft → mechanisms/<slug>.py. The slug becomes the engine market.type.
router.post("/mechanisms", (req, res) => {
  const { name, source } = req.body || {};
  if (!name || typeof source !== "string") return res.status(400).json({ error: "missing name or source" });
  try {
    res.json({ id: saveMechanism(name, source) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// validate a saved mechanism (AST gate + ABC + smoke) before it is used in a run.
router.post("/mechanisms/:id/validate", async (req, res) => {
  try {
    res.json(await validateMechanism(req.params.id));
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});
router.delete("/mechanisms/:id", (req, res) => {
  try {
    deleteMechanism(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/schema", (_req, res) => {
  const p = path.join(SHARED_DIR, "config.schema.json");
  if (!fs.existsSync(p)) return res.status(404).json({ error: "schema not generated" });
  res.type("application/json").send(fs.readFileSync(p, "utf-8"));
});
