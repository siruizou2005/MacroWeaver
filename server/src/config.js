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
export const SHARED_DIR = path.join(ROOT, "shared");

export const PORT = Number(process.env.MW_PORT || 8787);

// Prefer the engine venv python; fall back to python3 on PATH.
function resolvePython() {
  const venv = path.join(ENGINE_DIR, ".venv", "bin", "python");
  if (fs.existsSync(venv)) return venv;
  return process.env.MW_PYTHON || "python3";
}
export const PYTHON = resolvePython();

for (const d of [TRACES_DIR, CONFIGS_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}
