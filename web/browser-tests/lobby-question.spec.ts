import { expect, test } from "@playwright/test";
import type * as Fixture from "./lobby-question.fixture";

test.beforeEach(async ({ page, context }) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
});

for (const viewport of [
  { width: 1920, height: 914 },
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
]) {
  for (const mode of ["caption", "long", "timeline", "text"] as const) {
    test(`${mode} fits above the dock at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.evaluate(async (mode) => {
        const path = "/browser-tests/lobby-question.fixture.tsx";
        ((await import(path)) as typeof Fixture).mountLobbyQuestion(mode);
      }, mode);
      await expect(page.getByTestId("dock")).toBeVisible();
      const textTab = page.getByRole("tab", { name: "Text", exact: true });
      if (await textTab.isVisible()) await textTab.click();
      const text = page.getByTestId(mode === "timeline" ? "question-recap" : "question-text");
      await expect(text).toBeVisible();
      const dock = (await page.getByTestId("dock").boundingBox())!;
      const textRegion = page.getByTestId("question-text-scroll");
      const content = (await textRegion.boundingBox())!;
      expect(content.y + content.height).toBeLessThanOrEqual(dock.y);
      expect(content.height).toBeGreaterThan(20);
      if (mode !== "text") {
        const mediaTab = page.getByRole("tab", { name: "Media", exact: true });
        if (await mediaTab.isVisible()) await mediaTab.click();
        const media = page.getByTestId("media-frame");
        await expect(media.locator("img")).toBeVisible();
        const bounds = (await media.boundingBox())!;
        expect(bounds.height).toBeGreaterThan(100);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(dock.y);
      }
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        viewport.height,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
      const main = page.getByRole("main");
      expect(await main.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      await expect(page.getByText("The buzzer is open", { exact: true })).toHaveCount(0);
      if (viewport.width >= 1024) expect(dock.height).toBeLessThanOrEqual(96);
      if (mode === "long" || mode === "text") {
        if (await textTab.isVisible()) await textTab.click();
        expect(await textRegion.evaluate((el) => el.scrollHeight)).toBeGreaterThan(
          await textRegion.evaluate((el) => el.clientHeight),
        );
      }
      if (process.env.OQ_SCREENSHOT_DIR && mode === "caption")
        await page.screenshot({
          path: `${process.env.OQ_SCREENSHOT_DIR}/question-${viewport.width}.png`,
        });
    });
  }
}

test("lobby shows the showman, package overview and selected start mode, and keeps a vacant host slot", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    ((await import(path)) as typeof Fixture).mountLobbyQuestion("lobby", 1, false);
  });
  await expect(page.getByTestId("lobby-showman")).toContainText("user1");
  await expect(page.getByTestId("lobby-start-mode")).toContainText("Showman starts");
  await expect(page.getByText("Capitals", { exact: true })).toBeVisible();
  await expect(page.getByText("Final discoveries", { exact: true })).toBeVisible();
  if (process.env.OQ_SCREENSHOT_DIR)
    await page.screenshot({ path: `${process.env.OQ_SCREENSHOT_DIR}/lobby.png`, fullPage: true });
  await page.getByRole("button", { name: "Take seat 3", exact: true }).click();
  const sent = await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    const fixture = (await import(path)) as typeof Fixture;
    fixture.vacateShowman();
    return fixture.sent;
  });
  expect(sent).toContainEqual({
    action: "player-role-change",
    args: [{ playerId: 1, newRole: "player" }],
  });
  await expect(page.getByTestId("lobby-showman")).toContainText("Showman seat is open");
  await expect(page.getByTestId("lobby-player").filter({ hasText: "user1" })).toBeVisible();
  await page.getByRole("button", { name: "Become showman", exact: true }).click();
  expect(
    await page.evaluate(async () => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      return ((await import(path)) as typeof Fixture).sent.at(-1);
    }),
  ).toEqual({ action: "player-role-change", args: [{ playerId: 1, newRole: "showman" }] });
  if (process.env.OQ_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.OQ_SCREENSHOT_DIR}/lobby-vacant.png`,
      fullPage: true,
    });
});

test("start mode can be selected and the secret picker name is highlighted", async ({ page }) => {
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    ((await import(path)) as typeof Fixture).mountStartRules();
  });
  const automatic = page.getByRole("radio", { name: "When everyone is ready", exact: true });
  const manual = page.getByRole("radio", { name: "When the showman decides", exact: true });
  await expect(automatic).toBeChecked();
  await manual.click();
  await expect(manual).toBeChecked();
  await expect(
    page.getByText("Readiness is a signal to you. The game starts only when you press Start."),
  ).toBeVisible();
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    ((await import(path)) as typeof Fixture).mountLobbyQuestion("secret");
  });
  await expect(
    page
      .getByRole("heading", { name: "user3 picked a secret question and is choosing who answers." })
      .locator("span"),
  ).toHaveClass(/text-warning/);
});

for (const width of [1920, 768, 375, 320]) {
  test(`secret recipient names and scores stay inside their cards at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      ((await import(path)) as typeof Fixture).mountSecretRecipients();
    });
    const cards = page.getByRole("radiogroup", { name: "Give the question to" }).getByRole("radio");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(1)).toContainText("10,400");
    for (const card of await cards.all()) {
      const geometry = await card.evaluate((el) => {
        const bounds = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          left: bounds.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth),
          right: bounds.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth),
          overflow: el.scrollWidth - el.clientWidth,
          children: [...el.querySelectorAll("span")].map((child) => {
            const rect = child.getBoundingClientRect();
            return { left: rect.left, right: rect.right };
          }),
        };
      });
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      for (const child of geometry.children) {
        expect(child.left).toBeGreaterThanOrEqual(geometry.left - 1);
        expect(child.right).toBeLessThanOrEqual(geometry.right + 1);
      }
    }
    if (process.env.OQ_SCREENSHOT_DIR && width === 1920)
      await page.screenshot({ path: `${process.env.OQ_SCREENSHOT_DIR}/secret-overflow-fixed.png` });
  });
}

for (const width of [1280, 375]) {
  for (const [mode, myId] of [
    ["caption", 1],
    ["video", 2],
    ["point", 2],
    ["buzz", 2],
  ] as const) {
    test(`${mode} for role ${myId} keeps media and actions visible at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.evaluate(
        async ({ mode, myId }) => {
          const path = "/browser-tests/lobby-question.fixture.tsx";
          ((await import(path)) as typeof Fixture).mountLobbyQuestion(mode, myId);
        },
        { mode, myId },
      );
      const media = page.getByTestId("media-frame").first();
      await expect(media).toBeVisible();
      if (mode === "video") await expect(media.locator("video")).toBeVisible();
      if (mode === "point") await expect(page.getByTestId("point-picker")).toBeVisible();
      if (mode === "buzz") await expect(page.getByTestId("buzz")).toBeVisible();
      if (myId === 1) await expect(page.getByTestId("showman-panel")).toBeVisible();
      const bounds = (await media.boundingBox())!;
      const dock = (await page.getByTestId("dock").boundingBox())!;
      expect(bounds.height).toBeGreaterThan(80);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(dock.y);
      if (width >= 1024) expect(dock.height).toBeLessThanOrEqual(96);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        812,
      );
    });
  }
}
