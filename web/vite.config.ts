/// <reference types="vitest/config" />
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The dev server proxies the API and the game socket so the session cookie is
// first-party in development. Point OQ_API_PROXY at any running server.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.OQ_API_PROXY || "http://localhost:3000";
  const proxy = {
    "/v1": { target, changeOrigin: true },
    "/socket.io": { target, changeOrigin: true, ws: true },
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
    // Worker-only imports must be discovered before editing: late optimization reloads lose form state.
    optimizeDeps: { include: ["@jsquash/avif/encode", "mediabunny"] },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: { sourcemap: true, target: "es2022" },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
    },
  };
});
