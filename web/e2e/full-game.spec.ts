import { devices, expect, test, type Page } from "@playwright/test";

import {
  cell,
  chipScore,
  dockPhase,
  dockStatus,
  expectNoHorizontalScroll,
  expectPhase,
  hostGame,
  joinByLink,
  person,
  signInAsGuest,
  shot,
  type Person,
} from "./support/game";

/**
 * One complete game with four real browsers: a showman on a laptop, a player
 * on a phone, a player on a tablet and a spectator. It plays every question
 * type in the demo package, a refresh mid-question, the final round and the
 * results screen, checking what each role sees along the way.
 */
test.describe("full game", () => {
  test("showman, two players and a spectator play to the end", async ({ browser }) => {
    test.skip(
      test.info().project.name !== "desktop",
      "runs once; it already spans phone, tablet and desktop",
    );
    test.setTimeout(240_000);
    const desktop = { viewport: { width: 1440, height: 900 } };
    const host = await person(browser, "Hana", desktop);
    const alice = await person(browser, "Alice", devices["Pixel 7"]);
    const bob = await person(browser, "Bob", { ...devices["Galaxy Tab S4"] });
    const sam = await person(browser, "Sam", desktop);
    const everyone = [host, alice, bob, sam];
    const all = everyone.map((p) => p.page);
    const players = [alice, bob];

    // ── Lobby ──────────────────────────────────────────────────────────────
    await signInAsGuest(host.page, "Hana");
    const code = await hostGame(host.page, "E2E quiz night");
    await joinByLink(alice.page, code, "Alice", "player");
    await joinByLink(bob.page, code, "Bob", "player");
    await joinByLink(sam.page, code, "Sam", "spectator");

    await expect(host.page.getByTestId("lobby-player")).toHaveCount(2);
    await expect(host.page.getByTestId("ready-count")).toHaveText("0 of 2 ready");
    await shot(host.page, "01-lobby-showman-desktop");
    await shot(alice.page, "02-lobby-player-phone");
    await expectNoHorizontalScroll(alice.page);
    await expectNoHorizontalScroll(bob.page);

    // Everyone ready starts the game automatically.
    await alice.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(host.page.getByTestId("ready-count")).toHaveText("1 of 2 ready");
    await bob.page.getByRole("button", { name: "I'm ready" }).click();
    await expectPhase(all, "Choosing");
    for (const p of everyone)
      await expect(p.page.getByTestId("my-role")).toHaveText(
        p === host ? "Showman" : p === sam ? "Spectator" : "Player",
      );

    // Everyone can see every player's score; the showman also gets host tools.
    await sam.page.getByTestId("open-players").click();
    await expect(sam.page.getByTestId("players-row")).toHaveCount(2);
    await expect(sam.page.getByTestId("players-panel")).toContainText("Hana");
    await sam.page.keyboard.press("Escape");
    await expect(alice.page.getByTestId("host-tools")).toHaveCount(0);
    await host.page.getByTestId("host-tools").click();
    await expect(host.page.getByTestId("host-panel")).toBeVisible();
    await expect(
      host.page.getByTestId("host-panel").getByRole("button", { name: "Manage Alice" }),
    ).toBeVisible();
    await host.page.keyboard.press("Escape");

    // ── Simple question: buzz, typed answer, correct ───────────────────────
    await cell(host.page, "Capitals", 100).click();
    await expectPhase(all, "Ready to buzz");
    await expect(alice.page.getByTestId("question-text")).toHaveText(
      "What is the capital of France?",
    );
    await expect(sam.page.getByTestId("dock-info")).toHaveText(
      "You're watching — spectators can't buzz",
    );
    await expect(host.page.getByTestId("showman-answer")).toHaveText("Paris");
    await shot(host.page, "04-question-showman-desktop");
    await shot(alice.page, "05-question-player-phone");
    await shot(bob.page, "06-question-player-tablet");
    await shot(sam.page, "07-question-spectator-desktop");
    await expect(alice.page.getByTestId("showman-answer")).toHaveCount(0);

    await alice.page.getByTestId("buzz").click();
    await expectPhase(all, "Answering");
    await expect(alice.page.getByTestId("dock-status")).toHaveText("You're answering!");
    await expect(bob.page.getByTestId("dock-status")).toHaveText("Alice is answering");
    await alice.page.getByLabel("Your answer").fill("Paris");
    await alice.page.getByRole("button", { name: "Send" }).click();
    await expect(host.page.getByTestId("showman-panel")).toContainText("“Paris”");
    await shot(host.page, "08-judging-showman-desktop");
    await shot(alice.page, "09-answering-player-phone");
    await host.page.keyboard.press("c");
    await expectPhase(all, "Answer");
    await expect(dockStatus(bob.page)).toHaveText("Alice was right · +100");
    await expect(sam.page.getByTestId("answer-reveal")).toContainText("Paris");
    await shot(bob.page, "10-reveal-tablet");
    expect(await chipScore(sam.page, "Alice")).toBe("100");
    await host.page.getByTestId("continue").click();
    await expectPhase(all, "Choosing");
    await expect(dockStatus(alice.page)).toHaveText("Your turn to pick");
    await shot(alice.page, "03-board-picker-phone");
    await shot(host.page, "03-board-showman-desktop");
    await shot(bob.page, "03-board-tablet");
    await expect(dockStatus(bob.page)).toHaveText("Alice is picking");

    // ── Image question picked by the player; refresh mid-question ──────────
    await expect(cell(bob.page, "Capitals", 200)).toBeDisabled();
    await cell(alice.page, "Capitals", 200).click();
    await expectPhase(all, "Ready to buzz");
    await expect(bob.page.getByRole("img", { name: "Question image" })).toBeVisible();
    await shot(bob.page, "11-image-question-tablet");
    await shot(alice.page, "11-image-question-phone");
    await bob.page.reload();
    await expect(dockPhase(bob.page)).toHaveText("Ready to buzz");
    await expect(bob.page.getByRole("img", { name: "Question image" })).toBeVisible();

    // Wrong answer reopens the buzzer for the others; passing ends it.
    await bob.page.getByTestId("buzz").click();
    await expectPhase([host.page], "Answering");
    await host.page.getByTestId("judge-wrong").click();
    await expectPhase([alice.page, bob.page], "Ready to buzz");
    await expect(bob.page.getByTestId("dock-info")).toHaveText("You already answered this one");
    expect(await chipScore(host.page, "Bob")).toBe("−200");
    await alice.page.getByRole("button", { name: "Pass on this question" }).click();
    await expectPhase(all, "Answer");
    await expect(dockStatus(alice.page)).toHaveText("Here's the answer");
    await expect(alice.page.getByTestId("answer-reveal")).toContainText("Amber");
    await host.page.getByTestId("continue").click();
    await expectPhase(all, "Choosing");

    // ── Pause freezes everyone; chat works for every role ──────────────────
    await host.page.getByRole("button", { name: "Pause" }).click();
    await expect(alice.page.getByTestId("paused-banner")).toContainText("Paused by Hana");
    await expect(dockPhase(alice.page)).toHaveText("Paused");
    await host.page.getByRole("button", { name: "Resume" }).click();
    await expect(alice.page.getByTestId("paused-banner")).toHaveCount(0);
    await sam.page.getByRole("button", { name: "Chat" }).click();
    await sam.page.getByLabel("Message").fill("good luck everyone");
    await sam.page.getByRole("button", { name: "Send" }).click();
    await sam.page.keyboard.press("Escape");
    await alice.page.getByRole("button", { name: "Chat" }).click();
    await expect(alice.page.getByRole("dialog")).toContainText("good luck everyone");
    await alice.page.keyboard.press("Escape");

    // ── No-risk question: a wrong answer costs nothing ─────────────────────
    await cell(host.page, "Capitals", 300).click();
    await expectPhase(all, "Ready to buzz");
    await bob.page.keyboard.press("Space");
    await expectPhase([host.page], "Answering");
    await host.page.keyboard.press("w");
    await expectPhase(all, "Answer");
    expect(await chipScore(host.page, "Bob")).toBe("−200");
    await host.page.getByTestId("continue").click();
    await expectPhase(all, "Choosing");

    // ── Stake question: auction, the winner answers alone ──────────────────
    // Bob is below zero and cannot bid, so the auction may close at once.
    await cell(host.page, "Specials", 200).click();
    await expect(dockPhase(host.page)).toHaveText(/Stake · bidding|Answering/);
    await runStakeAuction(alice.page, bob.page);
    await expectPhase([host.page], "Answering");
    await expect(dockStatus(host.page)).toHaveText("Alice is answering — judge it");
    await host.page.getByTestId("judge-correct").click();
    await expectPhase(all, "Answer");
    await host.page.getByTestId("continue").click();
    await expectPhase(all, "Choosing");

    // ── Secret question: handed to Bob ─────────────────────────────────────
    await cell(host.page, "Specials", 300).click();
    await expectPhase(all, "Secret question");
    const picker = (await dockStatus(alice.page).textContent())!.includes("Choose")
      ? alice.page
      : host.page;
    await picker.getByRole("radio", { name: /Bob/ }).click();
    await shot(picker, "12-secret-picker");
    await picker.getByTestId("secret-give").click();
    await expectPhase([host.page], "Answering");
    await expect(dockStatus(bob.page)).toHaveText("You're answering!");
    await host.page.getByTestId("judge-correct").click();
    await expectPhase(all, "Answer");
    expect(await chipScore(host.page, "Bob")).toBe("100");
    await host.page.getByTestId("continue").click();
    await expectPhase(all, "Choosing");

    // ── Choice question: buzz, then pick an option ─────────────────────────
    await cell(host.page, "Specials", 400).click();
    await expectPhase(all, "Ready to buzz");
    await expect(alice.page.getByRole("button", { name: /Dolphin/ })).toBeDisabled();
    await alice.page.getByTestId("buzz").click();
    await expect(alice.page.getByRole("button", { name: /Dolphin/ })).toBeEnabled();
    await shot(alice.page, "13-choice-phone");
    await alice.page.getByRole("button", { name: /Dolphin/ }).click();
    await expect(host.page.getByTestId("showman-panel")).toContainText("“Dolphin”");
    await host.page.getByTestId("judge-correct").click();
    await expectPhase(all, "Answer");
    await host.page.getByTestId("continue").click();

    // ── Final round ────────────────────────────────────────────────────────
    await expectPhase(all, "Theme elimination");
    await expect(host.page.getByText("Final round", { exact: true })).toBeVisible();
    await shot(alice.page, "14-final-themes-phone");
    await shot(host.page, "14-final-themes-desktop");
    await eliminateUntilOne([alice.page, bob.page]);
    await shot(alice.page, "15-final-bid-phone");
    await expectPhase(all, "Final · bidding");
    for (const p of players) {
      await p.page.getByTestId("bid-submit").click();
      await expect(dockStatus(p.page)).toHaveText(/Your bid: |Type your answer/);
    }
    await expectPhase(all, "Final · answering");
    await expect(sam.page.getByTestId("question-text")).toContainText("Final");
    await shot(bob.page, "16-final-answer-tablet");
    await alice.page.getByLabel("Your final answer").fill("A legend");
    await alice.page.getByTestId("final-submit").click();
    await expect(dockStatus(alice.page)).toHaveText("Answer locked in");
    await bob.page.getByLabel("Your final answer").fill("No idea");
    await bob.page.keyboard.press("Enter");
    await expectPhase(all, "Final · review");
    await expect(host.page.getByTestId("final-answer")).toHaveCount(2);
    await shot(host.page, "17-final-review-desktop");
    const answers = host.page.getByTestId("final-answer");
    await answers
      .filter({ hasText: "A legend" })
      .getByRole("button", { name: /Correct/ })
      .click();
    await answers.filter({ hasText: "No idea" }).getByRole("button", { name: /Wrong/ }).click();

    // ── Results ────────────────────────────────────────────────────────────
    await expectPhase(all, "Game over");
    await expect(sam.page.getByTestId("podium")).toContainText("Alice wins!");
    await shot(sam.page, "18-results-desktop");
    await shot(alice.page, "18-results-phone");
    await expect(dockStatus(alice.page)).toHaveText("You finished #1");
    await expect(dockStatus(bob.page)).toHaveText("You finished #2");
    for (const p of [alice, bob]) await expectNoHorizontalScroll(p.page);
    await alice.page.getByTestId("back-to-games").click();
    await expect(alice.page).toHaveURL(/\/$/);

    expect(everyone.flatMap((p) => p.errors)).toEqual([]);
    await Promise.all(everyone.map((p) => p.context.close()));
  });
});

/** Alice keeps bidding the minimum; Bob passes. Ends when the auction closes. */
async function runStakeAuction(alice: Page, bob: Page): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if ((await dockPhase(alice).textContent()) === "Answering") return;
    if (await bob.getByTestId("bid-pass").isVisible()) {
      await bob.getByTestId("bid-pass").click();
    } else if (await alice.getByTestId("bid-submit").isVisible()) {
      await alice.getByTestId("bid-submit").click();
    }
    await alice.waitForTimeout(300);
  }
  const state = await alice.evaluate(() => {
    const s = (
      window as unknown as { __oqGame: { getState(): { session: unknown } } }
    ).__oqGame.getState().session as {
      state: unknown;
      players: unknown;
    };
    return JSON.stringify({ state: s.state, players: s.players });
  });
  throw new Error(`stake auction did not finish: ${state}`);
}

/** Whoever has the turn removes the first theme they can until one remains. */
async function eliminateUntilOne(pages: Page[]): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if ((await dockPhase(pages[0]!).textContent()) !== "Theme elimination") return;
    for (const p of pages) {
      const btn = p.getByTestId("final-theme").and(p.locator(":enabled")).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await p.waitForTimeout(400);
        break;
      }
    }
    await pages[0]!.waitForTimeout(200);
  }
  throw new Error("theme elimination did not finish");
}

export type { Person };
