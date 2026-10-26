import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, packageId, person, signInAsGuest } from "./support/game";

test("private game retries stay in the form and game start introduces the first round", async ({
  page: host,
  browser,
}, testInfo) => {
  const guest = await person(browser, "Password guest", {
    viewport: testInfo.project.use.viewport ?? { width: 1440, height: 900 },
    isMobile: testInfo.project.use.isMobile,
    hasTouch: testInfo.project.use.hasTouch,
  });
  let gameId: string | undefined;
  try {
    await signInAsGuest(host, "Password host");
    await host.goto(`/games/new?packageId=${packageId()}`);
    await host.getByLabel("Game name").fill(`Password check ${Date.now()}`);
    await host.getByRole("radio", { name: "Password", exact: true }).click();
    const hostPassword = host.getByLabel("Password", { exact: true });
    await expect(hostPassword).toHaveAttribute("type", "password");
    await hostPassword.fill("Test_332");
    await host.getByRole("button", { name: "Create & open lobby" }).click();
    await expect(host.getByTestId("room-code")).toBeVisible();
    gameId = (await host.getByTestId("room-code").innerText()).trim();

    const page = guest.page;
    await page.goto(`/games/${gameId}`);
    const password = page.getByLabel("Game password");
    await page.getByLabel("Your name").fill("Password guest");
    await expect(password).toHaveAttribute("type", "password");
    await password.fill("фівфів");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Join as player" }).click();
    await expect(page.getByRole("alert")).toHaveText("Use 1–16 Latin letters, digits, - or _.");
    await expect(page.getByLabel("Your name")).toHaveValue("Password guest");
    await expect(password).toHaveValue("фівфів");

    await password.fill("wrong");
    const playerButton = page.getByRole("button", { name: "Join as player" });
    const spectatorButton = page.getByRole("button", { name: "Spectate", exact: true });
    // Hold the real join before password validation to make pending UI observable.
    for (const button of [playerButton, spectatorButton]) {
      const previousError = await page.getByRole("alert").innerText();
      const beforeRetry = await button.boundingBox();
      let resume!: () => void;
      const gate = new Promise<void>((resolve) => {
        resume = resolve;
      });
      await page.route("**/v1/auth/socket", async (route) => {
        await gate;
        await route.continue();
      });
      try {
        const authenticating = page.waitForRequest("**/v1/auth/socket");
        await button.click();
        await authenticating;
        await expect(password).toBeVisible();
        await expect(playerButton).toBeDisabled();
        await expect(spectatorButton).toBeDisabled();
        await expect(button).toHaveAttribute("aria-busy", "true");
        await expect(button.getByRole("status", { includeHidden: true })).toBeVisible();
        await expect(page.getByText("Joining the game…")).toHaveCount(0);
        await expect(page.getByRole("alert")).toHaveText(previousError);
        // Once signed in, a retry must not shift or resize the button.
        if (button === spectatorButton) expect(await button.boundingBox()).toEqual(beforeRetry);
        await password.press("Enter");
        await expect(password).toBeVisible();
        await expect(button.getByRole("status", { includeHidden: true })).toBeVisible();
        await expectNoHorizontalScroll(page);
        await page.screenshot({
          path: testInfo.outputPath("password-pending.png"),
          fullPage: true,
        });
      } finally {
        resume();
      }
      await expect(page.getByRole("alert")).toHaveText("Password is incorrect");
      await expect(password).toBeVisible();
      await expect(playerButton).toBeEnabled();
      await expect(spectatorButton).toBeEnabled();
      if (button === spectatorButton) expect(await button.boundingBox()).toEqual(beforeRetry);
      await page.unroute("**/v1/auth/socket");
    }
    await expect(password).toHaveValue("wrong");
    await expect(password).toHaveAttribute("type", "password");
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: testInfo.outputPath("password-retry.png"), fullPage: true });
    await password.fill("Test_332");
    await page.getByRole("button", { name: "Join as player" }).click();
    await expect(page.getByText("You are")).toContainText("Player");
    await expect(page.getByTestId("round-transition")).toHaveCount(0);

    await host.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(host.getByRole("dialog", { name: "First round" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "First round" })).toBeVisible();
    await expect(page.getByTestId("round-transition")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("round-name")).toBeVisible();
    await expect(page.getByTestId("round-transition")).toHaveCount(0);
    expect(guest.errors).toEqual([]);
  } finally {
    if (gameId) await host.request.delete(`/v1/games/${gameId}`);
    await guest.context.close();
  }
});
