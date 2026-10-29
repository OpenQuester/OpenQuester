import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type * as Fixture from "./final-media-barrier.fixture";

test("final media barrier waits, starts the timeline and explains timeout on desktop and mobile", async ({
  page,
  context,
}) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  const dir = process.env.OQ_FINAL_BARRIER_SHOTS;
  if (dir) mkdirSync(dir, { recursive: true });
  for (const viewport of [
    { width: 1366, height: 884 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    const label = viewport.width === 375 ? "mobile" : "desktop";
    for (const role of ["player", "showman"] as const) {
      await page.evaluate(async (r) => {
        const path = "/browser-tests/final-media-barrier.fixture.tsx";
        ((await import(path)) as typeof Fixture).mountFinal(r);
      }, role);
      const fixture = page.getByTestId("final-fixture");
      await expect(
        fixture.getByText("Waiting for players to load the final question."),
      ).toBeVisible();
      await expect(fixture.getByText(/buzzer/i)).toHaveCount(0);
      await expect(fixture.getByRole("button", { name: "Skip this question" })).toHaveCount(0);
      await expect(fixture.getByTestId("final-submit")).toHaveCount(0);
      await expect(fixture.getByRole("textbox")).toHaveCount(0);
      if (role === "player") await expect(fixture.getByText("Get ready…")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (dir)
        await page.screenshot({
          path: join(dir, `final-${label}-${role}-waiting.png`),
          animations: "disabled",
        });
      await page.evaluate(async (timedOut) => {
        const path = "/browser-tests/final-media-barrier.fixture.tsx";
        ((await import(path)) as typeof Fixture).startFinal(timedOut);
      }, role === "player");
      if (role === "player")
        await expect(fixture.getByRole("alert")).toContainText("could not load the media in time");
      else await expect(fixture.getByRole("alert")).toHaveCount(0);
      await expect(fixture.getByTestId("content-stage")).toContainText("Final clue starts here");
      await expect(fixture.getByTestId("player-chip").first()).toContainText("waiting");
      await expect(fixture.getByText(/typing/i)).toHaveCount(0);
      await expect(fixture.getByTestId("final-submit")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (dir)
        await page.screenshot({
          path: join(
            dir,
            `final-${label}-${role}-${role === "player" ? "timed-out" : "ready"}.png`,
          ),
          animations: "disabled",
        });
      await expect(fixture.getByTestId("content-stage").locator("img")).toBeVisible({
        timeout: 5000,
      });
      await expect(fixture.getByTestId("content-stage")).toContainText("Final second clue", {
        timeout: 5000,
      });
      await expect(fixture.getByTestId("player-chip").first()).toContainText("typing", {
        timeout: 5000,
      });
      if (role === "player")
        await expect(fixture.getByTestId("final-submit")).toBeVisible({ timeout: 5000 });
    }
  }
});
