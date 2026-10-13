import { seedPackage } from "./seed.mjs";

const API_URL = process.env.OQ_API_URL ?? "http://localhost:53000";

/** Waits for the API and seeds one demo package for the run. */
export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const res = await fetch(`${API_URL}/v1/games?limit=1&offset=0`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline)
      throw new Error(
        `API not reachable at ${API_URL}. Run "npm run e2e:full" or start the stack.`,
      );
    await new Promise((r) => setTimeout(r, 1000));
  }
  const pkg = await seedPackage(API_URL, `E2E package ${Date.now()}`);
  process.env.OQ_E2E_PACKAGE_ID = String(pkg.id);
  process.env.OQ_E2E_PACKAGE_TITLE = pkg.title;
}
