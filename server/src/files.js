import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { PRESETS_DIR, TRACES_DIR, CONFIGS_DIR, TEMPLATES_DIR } from "./config.js";

// --- path sandboxing: never read/write outside the intended directory ---
function safeJoin(dir, name) {
  const p = path.resolve(dir, name);
  if (!p.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error("path escapes directory");
  }
  return p;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "config";
}

// ---------- presets ----------
export function listPresets() {
  if (!fs.existsSync(PRESETS_DIR)) return [];
  return fs
    .readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => {
      const id = f.replace(/\.(yaml|yml)$/, "");
      let cfg = {};
      try {
        cfg = YAML.parse(fs.readFileSync(path.join(PRESETS_DIR, f), "utf-8")) || {};
      } catch {
        /* ignore malformed */
      }
      const cohorts = cfg.cohorts || [];
      const agents = cohorts.reduce((m, c) => m + (c.n || 1), 0);
      return {
        id,
        name: cfg.run_name || id,
        market: cfg.market?.type || "unknown",
        rounds: cfg.rounds || 0,
        cohorts: cohorts.length,
        agents,
        description: cfg.description || "",
      };
    });
}

export function getPreset(id) {
  const p = safeJoin(PRESETS_DIR, `${slug(id)}.yaml`);
  if (!fs.existsSync(p)) return null;
  return YAML.parse(fs.readFileSync(p, "utf-8"));
}

// ---------- traces ----------
export function listTraces() {
  const out = [];
  const scan = (dir, prefix = "") => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        scan(full, prefix + f + "/");
      } else if (f.endsWith(".trace.json")) {
        const id = prefix + f.replace(/\.trace\.json$/, "");
        let meta = {};
        try {
          const t = JSON.parse(fs.readFileSync(full, "utf-8"));
          meta = { run_name: t.run_name, market: t.market, T: t.T, benchmarks: t.benchmarks };
        } catch {
          /* ignore */
        }
        out.push({ id, mtime: st.mtimeMs, ...meta });
      }
    }
  };
  scan(TRACES_DIR);
  return out.sort((a, b) => b.mtime - a.mtime);
}

export function getTrace(id) {
  // id may include a subdir prefix like "golden/fish_calvano"
  const rel = String(id).replace(/[^a-zA-Z0-9_/-]+/g, "");
  const p = path.resolve(TRACES_DIR, `${rel}.trace.json`);
  if (!p.startsWith(path.resolve(TRACES_DIR) + path.sep)) throw new Error("bad trace id");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function traceIdForRun(runName) {
  return slug(runName);
}

export function tracePathForRun(runName) {
  return path.join(TRACES_DIR, `${slug(runName)}.trace.json`);
}

// ---------- user configs ----------
export function listConfigs() {
  if (!fs.existsSync(CONFIGS_DIR)) return [];
  return fs
    .readdirSync(CONFIGS_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => {
      const id = f.replace(/\.yaml$/, "");
      let cfg = {};
      try {
        cfg = YAML.parse(fs.readFileSync(path.join(CONFIGS_DIR, f), "utf-8")) || {};
      } catch {
        /* ignore malformed */
      }
      return { id, run_name: cfg.run_name || id, market: cfg.market?.type || "config", rounds: cfg.rounds || 0 };
    });
}

export function getConfig(id) {
  const p = safeJoin(CONFIGS_DIR, `${slug(id)}.yaml`);
  if (!fs.existsSync(p)) return null;
  return YAML.parse(fs.readFileSync(p, "utf-8"));
}

export function saveConfig(name, configObj) {
  const id = slug(name || configObj?.run_name || "config");
  const p = safeJoin(CONFIGS_DIR, `${id}.yaml`);
  fs.writeFileSync(p, YAML.stringify(configObj), "utf-8");
  return id;
}

export function deleteConfig(id) {
  const p = safeJoin(CONFIGS_DIR, `${slug(id)}.yaml`);
  if (fs.existsSync(p)) fs.rmSync(p);
  return true;
}

// ---------- published Markets templates (config + author nickname) ----------
export function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => {
      const id = f.replace(/\.yaml$/, "");
      let cfg = {};
      try {
        cfg = YAML.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf-8")) || {};
      } catch {
        /* ignore malformed */
      }
      return {
        id,
        name: cfg.run_name || id,
        market: cfg.market?.type || "config",
        rounds: cfg.rounds || 0,
        author: cfg.author || "anonymous",
      };
    });
}

export function getTemplate(id) {
  const p = safeJoin(TEMPLATES_DIR, `${slug(id)}.yaml`);
  if (!fs.existsSync(p)) return null;
  return YAML.parse(fs.readFileSync(p, "utf-8"));
}

export function saveTemplate(name, author, configObj) {
  const id = slug(name || configObj?.run_name || "template");
  const p = safeJoin(TEMPLATES_DIR, `${id}.yaml`);
  // author rides along at the top level; the engine ignores unknown keys and the
  // editor rebuilds a clean config from buildConfig() on run, so it never reaches the kernel.
  fs.writeFileSync(p, YAML.stringify({ ...configObj, author: String(author || "anonymous") }), "utf-8");
  return id;
}

export function deleteTemplate(id) {
  const p = safeJoin(TEMPLATES_DIR, `${slug(id)}.yaml`);
  if (fs.existsSync(p)) fs.rmSync(p);
  return true;
}
