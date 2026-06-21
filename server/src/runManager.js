import { spawn } from "node:child_process";
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import YAML from "yaml";
import { PYTHON, ENGINE_DIR } from "./config.js";
import { listPresets, listTraces, traceIdForRun, tracePathForRun } from "./files.js";

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

// Spawn the Python engine `stream` subcommand and relay its NDJSON stdout 1:1 over the WS.
function startRun(ws, config) {
  if (ws._child) {
    try { ws._child.kill("SIGTERM"); } catch { /* ignore */ }
    ws._child = null;
  }
  const runId = randomUUID().slice(0, 8);
  const runName = config?.run_name || "run";
  const tracePath = tracePathForRun(runName);
  const traceId = traceIdForRun(runName);

  const child = spawn(
    PYTHON,
    ["-m", "macroweaver", "stream", "--config", "-", "--out", tracePath],
    { cwd: ENGINE_DIR, env: { ...process.env } },
  );
  ws._child = child;
  ws._runId = runId;

  send(ws, { type: "run.started", runId });

  // feed the config to the engine over stdin
  try {
    child.stdin.write(YAML.stringify(config));
    child.stdin.end();
  } catch (e) {
    send(ws, { type: "run.error", runId, message: `failed to write config: ${e.message}` });
  }

  const rl = readline.createInterface({ input: child.stdout });
  let sawDone = false;
  rl.on("line", (line) => {
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
  child.on("close", (code) => {
    ws._child = null;
    if (!sawDone && code !== 0) {
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
          if (ws._child) {
            try { ws._child.kill("SIGTERM"); } catch { /* ignore */ }
            ws._child = null;
          }
          break;
        default:
          break;
      }
    });

    ws.on("close", () => {
      if (ws._child) {
        try { ws._child.kill("SIGTERM"); } catch { /* ignore */ }
        ws._child = null;
      }
    });
  });
}
