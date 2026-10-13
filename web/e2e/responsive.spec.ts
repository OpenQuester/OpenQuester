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
    await expect(page.getByTestId("board-cell")).toHaveCount(60);
    await expectNoHorizontalScroll(page);
    await shot(page, `big-board-${test.info().project.name}`);
    // Every price stays a comfortable touch target and fully visible.
    const viewport = page.viewportSize()!;
    for (const box of await page
      .getByTestId("board-cell")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.right).toBeLessThanOrEqual(viewport.width);
    }
    await host.context.close();
  });
});
