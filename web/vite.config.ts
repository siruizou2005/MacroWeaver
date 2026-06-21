import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy: REST + WebSocket both go to the Node BFF on :8787.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/ws": { target: "ws://127.0.0.1:8787", ws: true },
    },
  },
});
