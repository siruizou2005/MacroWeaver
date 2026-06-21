// App-level defaults for NEW from-scratch worlds, persisted in localStorage.
// Edited on the Settings page; read by the store when opening a blank world.
import type { AppDefaults } from "../types";

const KEY = "mw_defaults";

export const FALLBACK_DEFAULTS: AppDefaults = {
  model: "claude-opus-4-8",
  maxConcurrency: 5,
  useCache: true,
  seed: 0,
  nickname: "",
};

export function loadDefaults(): AppDefaults {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...FALLBACK_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...FALLBACK_DEFAULTS };
}

export function saveDefaults(d: AppDefaults): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}
