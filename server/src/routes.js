import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { SHARED_DIR } from "./config.js";
import {
  listPresets, getPreset, listTraces, getTrace,
  listConfigs, getConfig, saveConfig,
  listTemplates, getTemplate, saveTemplate,
} from "./files.js";

export const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.get("/presets", (_req, res) => res.json(listPresets()));
router.get("/presets/:id", (req, res) => {
  const cfg = getPreset(req.params.id);
  if (!cfg) return res.status(404).json({ error: "not found" });
  res.json(cfg);
});

router.get("/traces", (_req, res) => res.json(listTraces()));
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

router.get("/schema", (_req, res) => {
  const p = path.join(SHARED_DIR, "config.schema.json");
  if (!fs.existsSync(p)) return res.status(404).json({ error: "schema not generated" });
  res.type("application/json").send(fs.readFileSync(p, "utf-8"));
});
