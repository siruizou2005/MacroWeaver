import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// repo root = .../project (server/src -> server -> project)
export const ROOT = path.resolve(__dirname, "..", "..");
export const ENGINE_DIR = path.join(ROOT, "engine");
export const PRESETS_DIR = path.join(ROOT, "presets");
export const TRACES_DIR = path.join(ROOT, "traces");
export const CONFIGS_DIR = path.join(ROOT, "configs");
export const TEMPLATES_DIR = path.join(ROOT, "templates"); // published-to-Markets community templates
export const MECHANISMS_DIR = path.join(ROOT, "mechanisms"); // user-authored Market plugins (.py)
export const SHARED_DIR = path.join(ROOT, "shared");

export const PORT = Number(process.env.MW_PORT || 8787);

// the in-tree markets the engine ships; anything else is treated as a user mechanism.
export const BUILTIN_MARKETS = new Set(["fish_calvano", "econagent", "clob"]);

// Build the env for an engine child process. Always points it at the user-mechanisms dir.
// SECURITY (MVV): when the run uses a NON-built-in (user) mechanism, scrub the Anthropic key
// and any *_KEY/_TOKEN/_SECRET so user-authored Python can't exfiltrate credentials — user
// mechanisms run via record+replay (no live LLM), so they never need the key anyway.
export function childEnv(marketType) {
  const env = { ...process.env, MW_MECHANISMS_DIR: MECHANISMS_DIR };
  if (!BUILTIN_MARKETS.has(marketType)) {
    for (const k of Object.keys(env)) {
      if (/(_KEY|_TOKEN|_SECRET|ANTHROPIC)/i.test(k)) delete env[k];
    }
  }
  return env;
}

// Prefer the engine venv python; fall back to python3 on PATH.
function resolvePython() {
  const venv = path.join(ENGINE_DIR, ".venv", "bin", "python");
  if (fs.existsSync(venv)) return venv;
  return process.env.MW_PYTHON || "python3";
}
export const PYTHON = resolvePython();

for (const d of [TRACES_DIR, CONFIGS_DIR, TEMPLATES_DIR, MECHANISMS_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}
