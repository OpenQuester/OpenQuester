import { expect, test } from "@playwright/test";
import type * as Fixture from "./lobby-question.fixture";

for (const viewport of [
  { width: 1920, height: 914 },
  { width: 844, height: 390 },
  { width: 375, height: 812 },
]) {
  for (const count of [1, 15]) {
    test(`${count} coincident points stay inspectable with a bounded footer at ${viewport.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
      await page.goto("/");
      await page.evaluate(async (count) => {
        const path = "/browser-tests/lobby-question.fixture.tsx";
        ((await import(path)) as typeof Fixture).mountPointResults(count);
      }, count);
      await expect(page.getByTestId("point-answer-marker")).toHaveCount(count);
      await expect(page.getByTestId("point-answer-label")).toHaveCount(count);
      await expect(page.getByTestId("dock-status")).toHaveText(`Correct: ${count}/${count}`);
      expect((await page.getByTestId("dock").boundingBox())!.height).toBeLessThanOrEqual(110);
      await expect(page.getByTestId("point-answer-label").last()).toContainText(
        `player_${count + 1}_`,
      );
      await expect(page.getByTestId("point-result")).toHaveCount(0);
      const state = await page.evaluate(async () => {
        const path = "/browser-tests/lobby-question.fixture.tsx";
        const fixture = (await import(path)) as typeof Fixture;
        const main = document.querySelector(".game-screen main")!;
        return {
          x: main.scrollWidth - main.clientWidth,
          y: main.scrollHeight - main.clientHeight,
          bodyX: document.documentElement.scrollWidth - innerWidth,
          bodyY: document.documentElement.scrollHeight - innerHeight,
          sent: fixture.sent,
        };
      });
      expect(state).toEqual({ x: 0, y: 0, bodyX: 0, bodyY: 0, sent: [] });
    });
  }
}
