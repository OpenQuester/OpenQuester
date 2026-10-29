import { expect, test } from "@playwright/test";

import {
  cell,
  dockPhase,
  expectNoHorizontalScroll,
  hostGame,
  joinByLink,
  person,
  shot,
  signInAsGuest,
} from "./support/game";

/**
 * Runs in every project (desktop, tablet, phone): the page under test uses the
 * project's device, the showman always plays on a laptop.
 */
test.describe("layout on this device", () => {
  test("public pages fit the screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Join a game in seconds" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Packages" }).click();
    await expect(page.getByRole("heading", { name: "Packages" })).toBeVisible();
    await page.getByTestId("package-tile").first().click();
    await expect(
      page.getByRole("link", { name: /Sign in to host|Host a game with this/ }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto("/login");
    await expectNoHorizontalScroll(page);
  });

  test("a player can join, ready up and buzz", async ({ browser, page }) => {
    if (test.info().project.name === "phone") {
      await page.setViewportSize({ width: 375, height: 812 });
    }
    const host = await person(browser, "Host", { viewport: { width: 1280, height: 800 } });
    await signInAsGuest(host.page, "Host");
    const code = await hostGame(host.page, "Layout check");

    await page.goto("/");
    await page.getByLabel("Room code or invite link").fill(`https://example.test/games/${code}`);
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/games/${code}$`));
    await expectNoHorizontalScroll(page);
    await joinByLink(page, code, "Pat", "player");
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");
    await expectNoHorizontalScroll(page);
    await expect(page.getByTestId("dock")).toBeInViewport();

    await cell(host.page, "Capitals", 100).click();
    await expect(dockPhase(page)).toHaveText("Ready to buzz");
    const buzz = page.getByTestId("buzz");
    await expect(buzz).toBeInViewport();
    const box = await buzz.boundingBox();
    expect(box!.height, "buzzer is a big touch target").toBeGreaterThanOrEqual(64);
    await expectNoHorizontalScroll(page);
    await expect(buzz).not.toHaveAttribute("data-early", /.*/, { timeout: 20_000 });
    await buzz.click();
    await expect(dockPhase(page)).toHaveText("Answering");
    await expect(page.getByLabel("Your answer")).toBeInViewport();

    await host.context.close();
  });

  test("a board with many questions fits without sideways scrolling", async ({ browser, page }) => {
    const host = await person(browser, "Host", { viewport: { width: 1280, height: 800 } });
    await signInAsGuest(host.page, "Host");
    const code = await hostGame(host.page, "Big board", {
      packageId: Number(process.env.OQ_E2E_BIG_PACKAGE_ID),
    });
    await joinByLink(page, code, "Pat", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");
    const cells = page.getByTestId("board-cell");
    await expect(cells).toHaveCount(60);
    // Wait until the round intro no longer covers the board before measuring.
    await cells.first().click({ trial: true });
    const viewport = page.viewportSize()!;
    // Every price stays a comfortable touch target and fully visible after responsive layout.
    await expect
      .poll(() =>
        cells.evaluateAll(
          (els, width) => ({
            count: els.length,
            invalid: els.flatMap((el, index) => {
              const rect = el.getBoundingClientRect();
              return rect.width < 44 || rect.right > width
                ? [{ index, width: rect.width, right: rect.right }]
                : [];
            }),
          }),
          viewport.width,
        ),
      )
      .toEqual({ count: 60, invalid: [] });
    await expectNoHorizontalScroll(page);
    await shot(page, `big-board-${test.info().project.name}`);

    // A missing media file is reported, not shown as an empty question. A
    // player whose media failed doesn't report ready, so the question opens
    // after the server's 30 s media timeout.
    await page.getByTestId("board-cell").first().click();
    await expect(page.getByTestId("media-failed")).toBeVisible({ timeout: 45_000 });
    await expect(host.page.getByTestId("media-failed")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await shot(host.page, `broken-media-showman`);
    await shot(page, `broken-media-${test.info().project.name}`);
    await host.context.close();
  });
});
