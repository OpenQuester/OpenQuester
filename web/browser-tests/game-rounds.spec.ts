import { expect, test, type Page } from "@playwright/test";
import type * as Fixture from "./lobby-question.fixture";

async function mount(page: Page, count = 4, current = 1, final = true, metadata = true) {
  await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(
    async ({ count, current, final, metadata }) => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      ((await import(path)) as typeof Fixture).mountRoundIndicator(count, current, final, metadata);
    },
    { count, current, final, metadata },
  );
  await expect(page.getByTestId("round-name")).toBeVisible();
}

test("round capsule supports hover, pinned click and keyboard without moving the field", async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  await page.setViewportSize({ width: 1440, height: 900 });
  await mount(page);
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    const { useGameStore } = (await import(path)) as typeof Fixture;
    const session = useGameStore.getState().session!;
    useGameStore.setState({
      session: {
        ...session,
        state: {
          ...session.state,
          questionState: "showing",
          currentQuestion: {
            id: 100,
            order: 0,
            type: "simple",
            price: 100,
            isHidden: false,
            answerDelay: 0,
            text: "Ready to buzz",
          },
        },
      },
    });
  });
  await expect(page.getByTestId("buzz")).toBeEnabled();
  const trigger = page.getByRole("button", { name: /^Rounds\. 2 of 4/ });
  const panel = page.getByRole("region", { name: "Package rounds" });
  const stage = page.getByTestId("game-stage");
  const bounds = await stage.boundingBox();
  await expect(trigger).toContainText("2/4");
  await trigger.hover();
  await expect(panel).toBeVisible();
  await expect(panel.locator("li")).toHaveCount(4);
  await expect(panel.locator('[aria-current="step"]')).toContainText("A long round name");
  await expect(panel.locator('[data-state="next"]')).toContainText("Round 3");
  await expect(panel.locator('[data-final="true"] svg')).toHaveCount(1);
  expect(await stage.boundingBox()).toEqual(bounds);
  await panel.hover();
  await expect(panel).toBeVisible();
  await page.mouse.move(1200, 750);
  await expect(panel).toBeHidden();
  await trigger.click();
  await page.mouse.move(1200, 750);
  await expect(panel).toBeVisible();
  await page.mouse.click(1200, 750);
  await expect(panel).toBeHidden();
  await trigger.focus();
  await expect(panel).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(panel.getByRole("list")).toBeFocused();
  await page.keyboard.press("Space");
  const commands = await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    return ((await import(path)) as typeof Fixture).sent;
  });
  expect(commands).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  const transitions = await page
    .locator(".round-indicator-panel")
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(transitions).toContain("0.18s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".round-indicator-panel")
      .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration)),
  ).toBeLessThan(0.001);
  expect(await stage.boundingBox()).toEqual(bounds);
  expect(errors).toEqual([]);
});

for (const width of [375, 1280]) {
  test(`12 rounds remain readable and follow server updates at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, 12, 9);
    const trigger = page.getByTestId("round-name");
    await expect(trigger).toContainText("10/12");
    await trigger.click();
    const panel = page.getByRole("region", { name: "Package rounds" });
    await expect(panel.locator("li")).toHaveCount(12);
    await expect(panel.locator('[aria-current="step"]')).toBeInViewport();
    const geometry = await page.evaluate(() => {
      const count = document.querySelector(".round-indicator-count")!;
      const main = document.querySelector("main")!;
      return {
        x: document.documentElement.scrollWidth - innerWidth,
        y: document.documentElement.scrollHeight - innerHeight,
        count: count.scrollWidth - count.clientWidth,
        stage: main.scrollHeight - main.clientHeight,
      };
    });
    expect(geometry).toEqual({ x: 0, y: 0, count: 0, stage: 0 });
    await page.evaluate(async () => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      const { useGameStore } = (await import(path)) as typeof Fixture;
      const session = useGameStore.getState().session!;
      useGameStore.setState({
        session: {
          ...session,
          state: {
            ...session.state,
            currentRound: {
              ...session.state.currentRound!,
              id: 12,
              order: 22,
              type: "final",
              name: "Last round",
            },
          },
        },
      });
    });
    await expect(trigger).toContainText("12/12");
    await expect(trigger).toContainText("Final round");
    await expect(panel).toBeHidden();
    await trigger.click();
    await expect(panel.locator('[aria-current="step"] svg')).toHaveCount(1);
    await expect(panel.locator('[data-state="next"]')).toHaveCount(0);
  });
}

test("single regular round has no final icon; missing metadata keeps the live label", async ({
  page,
}) => {
  await mount(page, 1, 0, false);
  await expect(page.getByTestId("round-name")).toContainText("1/1");
  await page.getByTestId("round-name").click();
  await expect(page.locator('.round-indicator-panel [data-final="true"]')).toHaveCount(0);
  await mount(page, 4, 1, true, false);
  await expect(page.getByTestId("round-name")).toHaveText(
    "Round 3 · A long round name with discoveries and journeys around the world",
  );
  await expect(page.locator(".round-indicator-trigger")).toHaveCount(0);
});
