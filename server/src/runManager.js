import { spawn } from "node:child_process";
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import YAML from "yaml";
import { PYTHON, ENGINE_DIR, childEnv } from "./config.js";
import { listPresets, listTraces, traceIdForRun, tracePathForRun } from "./files.js";

const IDLE_MS = 180000; // kill an engine child that emits no events for 3 min (e.g. a hung user mechanism)

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

// Deliberately stop the current run: mark the child dead (so its remaining buffered
// stdout lines aren't relayed into the next run), close its reader, and SIGTERM it.
function killChild(ws) {
  const child = ws._child;
  if (!child) return;
  child._dead = true;
  try { child._rl?.close(); } catch { /* ignore */ }
  try { child.kill("SIGTERM"); } catch { /* ignore */ }
  ws._child = null;
}

// Spawn the Python engine `stream` subcommand and relay its NDJSON stdout 1:1 over the WS.
function startRun(ws, config) {
  killChild(ws);
  const runId = randomUUID().slice(0, 8);
  const runName = config?.run_name || "run";
  const tracePath = tracePathForRun(runName, runId);
  const traceId = traceIdForRun(runName, runId);

  const child = spawn(
    PYTHON,
    ["-m", "macroweaver", "stream", "--config", "-", "--out", tracePath],
    // SECURITY (MVV): childEnv points at MW_MECHANISMS_DIR and scrubs the API key when the run
    // uses a user mechanism (non-built-in market.type), so user Python can't reach the key.
    { cwd: ENGINE_DIR, env: childEnv(config?.market?.type) },
  );
  ws._child = child;
  ws._runId = runId;

  // idle-timeout: a hung mechanism (e.g. infinite loop in settle()) emits nothing — kill it.
  let idleTimer = null;
  const clearIdle = () => { if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; } };
  const bumpIdle = () => {
    clearIdle();
    idleTimer = setTimeout(() => {
      if (child._dead) return;
      send(ws, { type: "run.error", runId, message: "engine idle timeout (no events for 180s) — killed" });
      killChild(ws);
    }, IDLE_MS);
  };
  bumpIdle();

  send(ws, { type: "run.started", runId });

  // feed the config to the engine over stdin. If the engine dies before draining stdin
  // (bad config, import error) a large write surfaces EPIPE *asynchronously* — without
  // this listener it becomes an uncaughtException that takes down the whole BFF.
  child.stdin.on("error", (e) => {
    send(ws, { type: "run.error", runId, message: `failed to write config: ${e.message}` });
  });
  try {
    child.stdin.write(YAML.stringify(config));
    child.stdin.end();
  } catch (e) {
    send(ws, { type: "run.error", runId, message: `failed to write config: ${e.message}` });
  }

  const rl = readline.createInterface({ input: child.stdout });
  child._rl = rl;
  let sawDone = false;
  rl.on("line", (line) => {
    if (child._dead) return; // a superseded/cancelled run must not bleed into the next one
    bumpIdle();              // progress → reset the idle-timeout
    line = line.trim();
    if (!line) return;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      return; // ignore non-JSON noise on stdout
    }
    if (ev.type === "done") {
      sawDone = true;
      send(ws, {
        type: "run.done",
        runId,
        traceId,
        metrics: ev.payload?.metrics || {},
        tracePath: ev.payload?.trace_path,
      });
    } else if (ev.type === "error") {
      send(ws, { type: "run.error", runId, message: ev.payload?.message || "engine error" });
    } else {
      send(ws, { type: "round", runId, event: ev });
    }
  });

  child.stderr.on("data", (buf) => {
    // engine diagnostics — surface as info, not failure
    process.stderr.write(`[engine ${runId}] ${buf}`);
  });

  child.on("error", (e) => {
    send(ws, { type: "run.error", runId, message: `spawn failed: ${e.message}` });
  });
  child.on("close", (code, signal) => {
    clearIdle();
    // only clear the pointer if it still refers to THIS child — a newer run may have
    // already claimed ws._child, and nulling it would orphan that live process.
    if (ws._child === child) ws._child = null;
    // a deliberate SIGTERM (cancel / pre-empt) is not an error: signal is set, or _dead.
    if (!sawDone && code !== 0 && !signal && !child._dead) {
      send(ws, { type: "run.error", runId, message: `engine exited with code ${code}` });
    }
  });
}

export function attachWebSocket(wss) {
  wss.on("connection", (ws) => {
    send(ws, { type: "hello", presets: listPresets(), traces: listTraces() });

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (msg.type) {
        case "run.start":
          if (!msg.config || !msg.config.market) {
            send(ws, { type: "run.error", runId: null, message: "missing config.market" });
            return;
          }
          startRun(ws, msg.config);
          break;
        case "run.cancel":
          killChild(ws);
          break;
        default:
          break;
      }
    });

    ws.on("close", () => {
      killChild(ws);
    });
  });
}
