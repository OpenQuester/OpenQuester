import { defineConfig } from "@playwright/test";

/** Native storage and media regressions; no backend, auth or Docker required. */
export default defineConfig({
  testDir: "./browser-tests",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    channel: process.env.OQ_BROWSER_CHANNEL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
});
