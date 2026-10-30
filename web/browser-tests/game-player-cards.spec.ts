import { expect, test } from "@playwright/test";
import type * as Fixture from "./lobby-question.fixture";

test.beforeEach(async ({ page }) => {
  await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
});

for (const viewport of [
  { width: 1920, height: 914 },
  { width: 1280, height: 600 },
  { width: 375, height: 812 },
  { width: 320, height: 568 },
  { width: 812, height: 375 },
]) {
  test(`all 16 cards and full scores fit at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.evaluate(async () => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      ((await import(path)) as typeof Fixture).mountMaxPlayers("long");
      await document.fonts.ready;
    });
    const cards = page.locator(".player-cards > li");
    await expect(cards).toHaveCount(16);
    await expect(page.locator(".player-card-own")).toHaveCount(1);
    const geometry = await page.locator(".game-screen").evaluate((game) => {
      const main = game.querySelector("main")!;
      const dock = game.querySelector('[data-testid="dock"]')!.getBoundingClientRect();
      const header = game.querySelector("header")!.getBoundingClientRect();
      const scores = [...game.querySelectorAll(".player-card-score")];
      return {
        mainOverflow: main.scrollHeight - main.clientHeight,
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
        fieldHeight: main.clientHeight,
        cardsFit: [...game.querySelectorAll(".player-cards > li")].every((el) => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth && r.bottom <= header.bottom;
        }),
        scoresFit: scores.every(
          (el) =>
            el.scrollWidth <= el.clientWidth + 1 &&
            el.getBoundingClientRect().right <= el.closest("button")!.getBoundingClientRect().right,
        ),
        mediaHeight: game.querySelector('[data-testid="media-frame"]')!.getBoundingClientRect()
          .height,
        dockBottom: dock.bottom,
      };
    });
    expect(geometry.cardsFit).toBe(true);
    expect(geometry.scoresFit).toBe(true);
    expect(geometry.mainOverflow).toBeLessThanOrEqual(1);
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
    expect(geometry.fieldHeight).toBeGreaterThan(80);
    expect(geometry.mediaHeight).toBeGreaterThan(40);
    expect(geometry.dockBottom).toBeLessThanOrEqual(viewport.height);
    const textTab = page.getByRole("tab", { name: "Text", exact: true });
    if (await textTab.isVisible()) await textTab.click();
    const text = page.getByTestId("question-text-scroll");
    await expect(text).toBeVisible();
    await text.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(await text.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.locator(".game-screen main").evaluate((el) => el.scrollTop)).toBe(0);
  });
}

test("expanded card offers showman score controls and an accessible centered avatar modal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    ((await import(path)) as typeof Fixture).mountMaxPlayers("buzz", 1);
  });
  const card = page.locator('[data-testid="player-chip"]').first().locator(".player-card");
  await card.hover();
  const popup = page.locator(".player-card-popover");
  await expect(popup).toContainText("Very_long_player_nickname_02_XYZ");
  await expect(page.getByTestId("quick-score-subtract")).toBeDisabled();
  await page.getByTestId("quick-score-add").click();
  expect(
    await page.evaluate(async () => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      return ((await import(path)) as typeof Fixture).sent.at(-1);
    }),
  ).toEqual({ action: "score-changed", args: [{ playerId: 2, newScore: -2_099_999_900 }] });
  const avatar = popup.getByRole("button", { name: /Open avatar/ });
  await avatar.click();
  const modal = page.locator("[data-avatar-dialog]");
  await expect(modal).toBeVisible();
  const box = (await modal.boundingBox())!;
  expect(box.width).toBeCloseTo(1440 * 0.6, 0);
  expect(box.height).toBeCloseTo(900 * 0.6, 0);
  expect(box.x + box.width / 2).toBeCloseTo(720, 0);
  expect(box.y + box.height / 2).toBeCloseTo(450, 0);
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(avatar).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(popup).not.toBeVisible();
  await expect(card).toBeFocused();
});

test("Buzz label stays centered and physical P passes only when available", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    ((await import(path)) as typeof Fixture).mountMaxPlayers("buzz");
  });
  const buzz = page.getByTestId("buzz");
  await expect(buzz).toBeEnabled();
  const pass = page.getByRole("button", { name: "Pass", exact: true });
  const buzzBox = (await buzz.boundingBox())!;
  const passBox = (await pass.boundingBox())!;
  expect(buzzBox.width).toBeGreaterThan(passBox.width * 2);
  expect(buzzBox.height).toBeGreaterThan(passBox.height);
  const offset = await buzz.evaluate((button) => {
    const text = [...button.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes("Buzz"),
    )!;
    const range = document.createRange();
    range.selectNodeContents(text);
    const label = range.getBoundingClientRect(),
      box = button.getBoundingClientRect();
    return Math.abs(label.x + label.width / 2 - box.x - box.width / 2);
  });
  expect(offset).toBeLessThan(1);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyP", key: "з", bubbles: true, cancelable: true }),
    ),
  );
  expect(
    await page.evaluate(async () => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      return ((await import(path)) as typeof Fixture).sent;
    }),
  ).toEqual([{ action: "question-skip", args: [] }]);
});

test("secret recipient pages preserve the full roster and highlight your card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    ((await import(path)) as typeof Fixture).mountMaxPlayers("secret", 1);
  });
  const recipients = page.getByRole("radiogroup", { name: "Give the question to" });
  const names = new Set<string>();
  do {
    for (const name of await recipients.getByRole("radio").allTextContents()) names.add(name);
    const next = page.getByRole("button", { name: "Next", exact: true });
    if (!(await next.isVisible()) || !(await next.isEnabled())) break;
    await next.click();
    await expect(recipients.getByRole("radio").first()).toHaveAttribute("tabindex", "0");
  } while (names.size < 15);
  expect(names.size).toBe(15);
  expect(
    await page.locator(".game-screen main").evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBeLessThanOrEqual(1);
});
