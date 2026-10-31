import { devices, expect, test, type Page } from "@playwright/test";

import { buzz, dockPhase, dockStatus, joinByLink, person, signInAsGuest } from "../support/game";

/**
 * Smoke test for a deployed site against a real server and a real package:
 *   OQ_WEB_URL=https://….pages.dev OQ_LIVE_PACKAGE_ID=3 npx playwright test -c playwright.live.config.ts
 * Plays one question per round (skipping the rest of each round) to the results.
 */
test("a full game on the deployed site", async ({ browser }) => {
  test.setTimeout(300_000);
  const packageId = Number(process.env.OQ_LIVE_PACKAGE_ID ?? 3);
  const host = await person(browser, "Hana", { viewport: { width: 1440, height: 900 } });
  const alice = await person(browser, "Alice", devices["Pixel 7"]);
  const bob = await person(browser, "Bob", devices["Galaxy Tab S4"]);
  const sam = await person(browser, "Sam", { viewport: { width: 1280, height: 800 } });
  const everyone = [host, alice, bob, sam];

  await signInAsGuest(host.page, "Hana");
  await host.page.goto(`/games/new?packageId=${packageId}`);
  await host.page.getByLabel("Game name").fill(`E2E smoke ${Date.now()}`);
  await host.page.getByRole("button", { name: "Create & open lobby" }).click();
  await expect(host.page.getByText("You are")).toContainText("Showman");
  const code = (await host.page.getByTestId("room-code").innerText()).trim();

  await joinByLink(alice.page, code, "Alice", "player");
  await joinByLink(bob.page, code, "Bob", "player");
  await joinByLink(sam.page, code, "Sam", "spectator");
  await alice.page.getByRole("button", { name: "I'm ready" }).click();
  await bob.page.getByRole("button", { name: "I'm ready" }).click();
  for (const p of everyone)
    await expect(dockPhase(p.page)).toHaveText("Choosing", { timeout: 20_000 });

  // The first pick belongs to a player, not the showman: whoever's turn it is
  // can open a question (older servers don't say whose turn it is up front).
  await expect(async () => {
    for (const p of [alice.page, bob.page]) {
      const cellBtn = p.getByTestId("board-cell").and(p.locator(":enabled")).first();
      if ((await dockPhase(p).textContent()) === "Choosing" && (await cellBtn.count()) > 0) {
        await cellBtn.click();
        await p.waitForTimeout(1500);
        if ((await dockPhase(host.page).textContent()) !== "Choosing") break;
      }
    }
    expect(await dockPhase(host.page).textContent()).not.toBe("Choosing");
  }).toPass({ timeout: 30_000 });
  await playQuestion(host.page, alice.page);

  for (let round = 1; round <= 10; round++) {
    // One question per round: Alice buzzes and is judged correct.
    if (round > 1) {
      await host.page.getByTestId("board-cell").and(host.page.locator(":enabled")).first().click();
      await playQuestion(host.page, alice.page);
    }
    const roundName = await roundOf(host.page);
    if (!(await host.page.getByTestId("host-panel").isVisible()))
      await host.page.getByTestId("host-tools").click();
    await host.page.getByTestId("host-panel").getByTestId("skip-round").click();
    // Skipping asks for confirmation first
    await host.page.getByTestId("skip-round-confirm").click();
    // Wait for the next round's board, or the results after the last round.
    await expect(async () => {
      const phase = await dockPhase(host.page).textContent();
      const name = await roundOf(host.page);
      expect(phase === "Game over" || (phase === "Choosing" && name !== roundName)).toBe(true);
    }).toPass({ timeout: 20_000 });
    if ((await dockPhase(host.page).textContent()) === "Game over") break;
  }

  for (const p of everyone) await expect(dockPhase(p.page)).toHaveText("Game over");
  await expect(sam.page.getByTestId("podium")).toContainText(/wins!/);
  await expect(dockStatus(alice.page)).toHaveText("You finished #1");
  await expect(dockStatus(bob.page)).toHaveText("You finished #2");
  expect(everyone.flatMap((p) => p.errors)).toEqual([]);
  await Promise.all(everyone.map((p) => p.context.close()));
});

async function playQuestion(host: Page, alice: Page): Promise<void> {
  // Media may take a moment to load for everyone.
  await expect(dockPhase(alice)).toHaveText("Ready to buzz", { timeout: 30_000 });
  // Waits out the early (locked) part of "Ready to buzz", so it is no false start
  await buzz(alice);
  await expect(dockPhase(host)).toHaveText("Answering");
  await host.getByTestId("judge-correct").click();
  await expect(dockPhase(host)).toHaveText("Answer");
  await host.getByTestId("continue").click();
  await expect(dockPhase(host)).toHaveText("Choosing", { timeout: 20_000 });
}

/** The current round's name from the game header. */
async function roundOf(page: Page): Promise<string | null> {
  return page.locator("header span[title]").first().getAttribute("title");
}
