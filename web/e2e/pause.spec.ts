import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalScroll,
  hostGame,
  joinByLink,
  person,
  signInAsGuest,
} from "./support/game";

test("pause covers only the field and preserves chat, host tools and board editing", async ({
  page: host,
  browser,
}, testInfo) => {
  if (testInfo.project.name === "phone") await host.setViewportSize({ width: 375, height: 812 });
  const device = {
    viewport: host.viewportSize()!,
    isMobile: testInfo.project.use.isMobile,
    hasTouch: testInfo.project.use.hasTouch,
  };
  const player = await person(browser, "Pat", device);
  const spectator = await person(browser, "Sam", device);
  let code: string | undefined;
  try {
    await signInAsGuest(host, "Host");
    code = await hostGame(host, "Pause screen");
    await joinByLink(player.page, code, "Pat", "player");
    await joinByLink(spectator.page, code, "Sam", "spectator");
    await host.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(host.getByTestId("dock-phase")).toHaveText("Choosing");
    await expect(host.getByTestId("round-transition")).toHaveCount(0);
    await host.getByTestId("host-tools").click();
    await host.getByTestId("board-edit").click();
    await host.keyboard.press("Escape");
    const cell = host.getByTestId("board-cell").first();
    const originalLabel = await cell.getAttribute("aria-label");
    await expect(cell).toHaveAttribute("data-editing", "true");
    await host.getByRole("button", { name: "Pause", exact: true }).click();

    for (const page of [host, player.page, spectator.page]) {
      await expect(page.getByTestId("pause-overlay")).toContainText("Game paused");
      await expect(page.getByTestId("pause-overlay").getByRole("button")).toHaveCount(0);
      await expect(page.getByTestId("game-stage")).toHaveAttribute("inert", "");
      await expect(page.getByTestId("paused-banner")).toHaveCount(0);
      await expectNoHorizontalScroll(page);
    }
    for (const page of [player.page, spectator.page]) {
      await expect(page.getByTestId("pause-overlay")).toContainText("Waiting for the showman");
      await expect(page.getByTestId("dock")).toContainText("Waiting for the showman");
    }
    // The inert board cannot take keyboard focus or receive a click through the overlay.
    await cell.evaluate((element: HTMLElement) => element.focus());
    await expect(cell).not.toBeFocused();
    const box = await cell.boundingBox();
    await host.mouse.click(box!.x + 5, box!.y + 5);
    await host.keyboard.press("Escape");
    await host.keyboard.press("Space");
    await expect(host.getByTestId("pause-overlay")).toBeVisible();

    await host.getByTestId("host-tools").click();
    const tools = host.getByTestId("host-panel");
    await expect(tools.getByTestId("board-edit")).toBeDisabled();
    await expect(tools.getByTestId("skip-round")).toBeDisabled();
    await expect(tools.getByRole("button", { name: "Resume", exact: true })).toBeEnabled();
    await tools.getByLabel("Who can join").selectOption("spectators_only");
    await expect(tools.getByLabel("Who can join")).toHaveValue("spectators_only");
    await host.keyboard.press("Escape");

    await spectator.page.getByTestId("open-chat").click();
    await spectator.page.getByLabel("Message", { exact: true }).fill("Still here during the pause");
    await spectator.page.getByRole("button", { name: "Send", exact: true }).click();
    await player.page.getByTestId("open-chat").click();
    await expect(player.page.getByTestId("chat-panel")).toContainText(
      "Still here during the pause",
    );
    await player.page.keyboard.press("Escape");
    await player.page.reload();
    await expect(player.page.getByTestId("pause-overlay")).toBeVisible();
    await expect(player.page.getByTestId("round-transition")).toHaveCount(0);

    const overlay = host.getByTestId("pause-overlay");
    const resume = host.locator("header").getByRole("button", { name: "Resume", exact: true });
    await expect(resume).toBeInViewport();
    await resume.focus();
    for (let i = 0; i < 8; i++) {
      await host.keyboard.press("Tab");
      expect(await host.evaluate(() => document.activeElement?.closest("[inert]") != null)).toBe(
        false,
      );
    }
    for (const theme of ["midnight", "daylight"]) {
      await host.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await expect(overlay).toHaveCSS("backdrop-filter", "blur(4px)");
      await expectNoHorizontalScroll(host);
      await host.screenshot({ path: testInfo.outputPath(`pause-${theme}.png`) });
    }
    await host.emulateMedia({ reducedMotion: "reduce" });
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveCSS("animation-name", "none");
    await resume.click();
    for (const page of [host, player.page, spectator.page]) {
      await expect(page.getByTestId("pause-overlay")).toHaveCount(0);
      await expect(page.getByTestId("game-stage")).not.toHaveAttribute("inert", "");
    }
    await expect(cell).toHaveAttribute("data-editing", "true");
    await expect(cell).toHaveAttribute("aria-label", originalLabel!);
    expect([...player.errors, ...spectator.errors]).toEqual([]);
  } finally {
    if (code) await host.request.delete(`/v1/games/${code}`);
    await player.context.close();
    await spectator.context.close();
  }
});
