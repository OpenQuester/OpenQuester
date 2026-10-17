import { defineConfig, devices } from "@playwright/test";

/** Smoke test against a deployed site; see e2e/live/live-game.spec.ts. */
export default defineConfig({
  testDir: "./e2e/live",
  timeout: 300_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.OQ_WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "live", use: { ...devices["Desktop Chrome"] } }],
});
