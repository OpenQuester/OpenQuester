import { test, expect } from "@playwright/test";
import type * as Fixture from "./authored-content.fixture";

for (const width of [375, 820, 1440]) {
  test(`keeps timed speech private, clears screens and reveals ordered text at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    const mount = async (
      role: Parameters<typeof Fixture.mount>[0],
      reveal = false,
      elapsed = 1500,
    ) => {
      await page.goto("/");
      await page.evaluate(
        async ({ role, reveal, elapsed }) => {
          const path = "/browser-tests/authored-content.fixture.tsx";
          ((await import(path)) as typeof Fixture).mount(role, reveal, elapsed);
        },
        { role, reveal, elapsed },
      );
    };
    for (const role of ["player", "spectator", "showman"] as const) {
      await mount(role);
      if (role === "showman")
        await expect(page.getByTestId("showman-replic")).toHaveText("Private spoken secret");
      else {
        await expect(page.getByTestId("oral-placeholder")).toHaveText(
          "The showman is reading the question",
        );
        await expect(page.getByText("Private spoken secret")).toHaveCount(0);
        await expect(page.getByText("Private instruction")).toHaveCount(0);
        expect(
          await page.evaluate(async () => {
            const path = "/src/game/store.ts";
            return JSON.stringify(
              (await import(path)).useGameStore.getState().session!.state.currentQuestion,
            );
          }),
        ).not.toMatch(
          /Private spoken|Private instruction|Before answer image|After answer image|Paris/,
        );
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await mount("player", false, 4500);
    await expect(page.getByTestId("question-text")).toHaveCount(0);
    await expect(page.getByTestId("question-recap")).toHaveCount(0);
    await mount("player", true, 0);
    await expect(page.getByTestId("question-text")).toHaveText("Before answer image");
    await expect(page.getByTestId("answer-explanation")).toHaveText("Revealed explanation");
    await expect(page.getByTestId("content-stage").locator("img")).toHaveCount(0);
    await mount("player", true, 2200);
    await expect(page.getByTestId("content-stage").locator("img")).toBeVisible();
    await mount("player", true, 3500);
    await expect(page.getByTestId("question-text")).toHaveText("After answer image");
    await page.screenshot({ path: test.info().outputPath(`authored-answer-${width}.png`) });
  });
}
