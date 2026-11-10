/// <reference types="vitest/config" />
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import {
  DEV_STORAGE_ORIGIN,
  DEV_STORAGE_PATH,
  DEV_STORAGE_PREFIX,
} from "./src/lib/devStorageMedia.js";

const devStorageProxy: ProxyOptions = {
  target: DEV_STORAGE_ORIGIN,
  changeOrigin: true,
  secure: true,
  bypass(req) {
    const path = req.url?.slice(DEV_STORAGE_PREFIX.length) ?? "";
    if ((req.method !== "GET" && req.method !== "HEAD") || !DEV_STORAGE_PATH.test(path))
      return false;
  },
  rewrite: (url) => url.slice(DEV_STORAGE_PREFIX.length),
  configure(proxy) {
    proxy.on("proxyReq", (req) => {
      req.removeHeader("cookie");
      req.removeHeader("authorization");
      req.removeHeader("proxy-authorization");
    });
    proxy.on("proxyRes", (res) => {
      delete res.headers["set-cookie"];
      // A storage object opened as a document must not run in the app origin.
      res.headers["content-security-policy"] = "default-src 'none'; sandbox";
      res.headers["x-content-type-options"] = "nosniff";
    });
  },
};

// The dev server proxies the API and the game socket so the session cookie is
// first-party in development. Point OQ_API_PROXY at any running server.
export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.OQ_API_PROXY || "http://localhost:3000";
  const devStorage =
    command === "serve" &&
    !isPreview &&
    target.replace(/\/$/, "") === "https://dev-api.openquester.app";
  // A remote API's session cookie must belong to the local app's host.
  const proxy = {
    "/v1": { target, changeOrigin: true, cookieDomainRewrite: "" },
    "/socket.io": { target, changeOrigin: true, cookieDomainRewrite: "", ws: true },
  };

  return {
    plugins: [react(), tailwindcss()],
    define: { "import.meta.env.OQ_DEV_MEDIA_PROXY": JSON.stringify(devStorage ? "1" : "") },
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
    // Worker-only imports must be discovered before editing: late optimization reloads lose form state.
    optimizeDeps: { include: ["@jsquash/avif/encode", "mediabunny"] },
    server: {
      port: 5173,
      proxy: devStorage ? { ...proxy, [DEV_STORAGE_PREFIX]: devStorageProxy } : proxy,
    },
    preview: { port: 4173, proxy },
    // Both production CSS transforms must supply maps when preserving module order.
    css: {
      transformer: mode === "production" ? "lightningcss" : "postcss",
      devSourcemap: true,
    },
    build: {
      sourcemap: true,
      target: "es2022",
      rolldownOptions: {
        output: {
          // Preserve initialization order for the toolkit's cyclic class imports.
          strictExecutionOrder: true,
          codeSplitting: {
            groups: [
              {
                name: "media-toolkit",
                test: /node_modules[\\/]mediabunny[\\/]/,
                maxSize: 1_000_000,
                entriesAware: true,
              },
            ],
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
    },
  };
});
