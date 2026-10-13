import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run real browsers against a real backend.
 *
 *   npm run e2e:full   # starts Postgres/Redis/S3 in Docker, the server and the app, then runs everything
 *   npm run e2e        # when the stack (OQ_API_URL) and app (OQ_WEB_URL) are already running
 */
const WEB_URL = process.env.OQ_WEB_URL ?? "http://localhost:4173";
const API_URL = process.env.OQ_API_URL ?? "http://localhost:53000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./e2e/support/global-setup.ts",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "tablet", use: { ...devices["Galaxy Tab S4"], defaultBrowserType: "chromium" } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.OQ_WEB_URL
    ? undefined
    : {
        command: "npm run build && npm run preview -- --host localhost --port 4173 --strictPort",
        url: WEB_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { OQ_API_PROXY: API_URL },
      },
  metadata: { apiUrl: API_URL },
});
