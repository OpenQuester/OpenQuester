import { expect, test } from "@playwright/test";

import { buzz, cell, dockPhase, hostGame, joinByLink, person, signInAsGuest } from "./support/game";

const laptop = { viewport: { width: 1280, height: 800 } };

test.describe("stats and reports", () => {
  test("a player reports a question at the answer", async ({ browser, page }) => {
    await signInAsGuest(page, "Host");
    const code = await hostGame(page, "Reports");
    const pat = await person(browser, "Pat", laptop);
    await joinByLink(pat.page, code, "Pat", "player");
    await pat.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    await cell(page, "Capitals", 100).click();
    await buzz(pat.page);
    await expect(dockPhase(page)).toHaveText("Answering");
    await page.getByTestId("judge-wrong").click();

    const reveal = pat.page.getByTestId("answer-reveal");
    await expect(reveal).toBeVisible();
    await reveal.getByTestId("report-question").click();
    const dialog = pat.page.getByRole("dialog", { name: "Report this question" });
    await dialog.getByLabel("A picture, sound or video doesn't work").check();
    await dialog.getByLabel("Details (optional)").fill("The map doesn't load");
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(pat.page.getByTestId("report-sent")).toBeVisible();

    await pat.context.close();
  });

  test("the leaderboard and profile stats load", async ({ page }) => {
    await signInAsGuest(page, "Viewer");
    await page.getByRole("link", { name: "Leaderboard" }).click();
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
    await page.getByRole("tab", { name: "This week" }).click();
    await expect(page.getByRole("tab", { name: "This week" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByTestId("leaderboard").or(page.getByText("Nobody has finished a game")),
    ).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByTestId("my-stats")).toBeVisible();
    await expect(page.getByText("Finish a game as a player")).toBeVisible();
  });
});
