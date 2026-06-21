import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { WebSocketServer } from "ws";
import { PORT, ROOT } from "./config.js";
import { router } from "./routes.js";
import { attachWebSocket } from "./runManager.js";

const app = express();
app.use(express.json({ limit: "4mb" }));

// permissive CORS for local dev (vite proxy normally avoids this, but harmless)
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next();
});

app.use("/api", router);

// serve the built web bundle in production if it exists
const WEB_DIST = path.join(ROOT, "web", "dist");
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get("*", (_req, res) => res.sendFile(path.join(WEB_DIST, "index.html")));
}

// Last-resort guards: a stray async error (e.g. a child-process pipe error) should be
// logged, not allowed to take the whole BFF down and drop every connected client.
process.on("uncaughtException", (err) => {
  console.error("[macroweaver] uncaughtException:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[macroweaver] unhandledRejection:", err);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
attachWebSocket(wss);

server.listen(PORT, () => {
  console.log(`[macroweaver] BFF listening on http://127.0.0.1:${PORT}  (REST /api, WS /ws)`);
});
