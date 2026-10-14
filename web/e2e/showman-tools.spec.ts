import { expect, test } from "@playwright/test";

import {
  buzz,
  cell,
  chipScore,
  dockPhase,
  hostGame,
  joinByLink,
  person,
  signInAsGuest,
} from "./support/game";

const laptop = { viewport: { width: 1280, height: 800 } };

test.describe("showman tools", () => {
  test("remove a question, undo a ruling and close the game", async ({ browser, page }) => {
    await signInAsGuest(page, "Host");
    const code = await hostGame(page, "Tools");
    const pat = await person(browser, "Pat", laptop);
    await joinByLink(pat.page, code, "Pat", "player");
    // A second player keeps the question open after Pat's wrong answer
    const kim = await person(browser, "Kim", laptop);
    await joinByLink(kim.page, code, "Kim", "player");
    await pat.page.getByRole("button", { name: "I'm ready" }).click();
    await kim.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    // Take a question off the board and put it back
    await page.getByTestId("host-tools").click();
    const tools = page.getByTestId("host-panel");
    await tools.getByTestId("board-edit").click();
    await expect(page.getByTestId("board-edit-hint")).toBeVisible();
    await cell(page, "Capitals", 300).click();
    await expect(
      pat.page.getByRole("button", { name: "Capitals, 300, already played" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Capitals, 300, already played" }).click();
    await expect(cell(pat.page, "Capitals", 300)).toBeVisible();
    await tools.getByTestId("board-edit").click();

    // Close the game to newcomers
    await tools.getByLabel("Who can join").selectOption("closed");
    const late = await person(browser, "Late", laptop);
    await late.page.goto(`/games/${code}`);
    await late.page.getByLabel("Your name").fill("Late");
    await late.page.getByRole("button", { name: "Spectate" }).click();
    await expect(late.page.getByText("The showman closed this game to new people")).toBeVisible();
    await tools.getByLabel("Who can join").selectOption("open");

    // A wrong ruling taken back: the points return and Pat may buzz again
    await cell(page, "Capitals", 100).click();
    await buzz(pat.page);
    await expect(dockPhase(page)).toHaveText("Answering");
    await page.getByTestId("judge-wrong").click();
    await expect.poll(() => chipScore(page, "Pat")).toBe("−100");
    await tools.getByTestId("undo-ruling").click();
    await expect.poll(() => chipScore(page, "Pat")).toBe("0");
    await buzz(pat.page);
    await expect(dockPhase(page)).toHaveText("Answering");

    await pat.context.close();
    await kim.context.close();
    await late.context.close();
  });
});
