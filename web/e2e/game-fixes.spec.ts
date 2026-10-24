import { expect, test, type Page } from "@playwright/test";

import {
  buzz,
  cell,
  chipScore,
  dockPhase,
  dockStatus,
  expectNoHorizontalScroll,
  hostGame,
  joinByLink,
  person,
  shot,
  signInAsGuest,
} from "./support/game";

const laptop = { viewport: { width: 1280, height: 800 } };

function mediaPackageId(): number {
  const id = Number(process.env.OQ_E2E_MEDIA_PACKAGE_ID);
  if (!id) throw new Error("OQ_E2E_MEDIA_PACKAGE_ID missing: global setup did not seed it");
  return id;
}

/** Showman log lines (chat entries the server wrote), read from the game state. */
function chatLog(page: Page) {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __oqGame: {
          getState: () => {
            session: { chat: { system?: { action: string } }[] } | null;
          };
        };
      }
    ).__oqGame;
    return (store.getState().session?.chat ?? [])
      .map((m) => m.system?.action)
      .filter((a): a is string => !!a);
  });
}

function video(page: Page) {
  return page.locator("[data-testid=media-video]").evaluate((el: HTMLMediaElement) => ({
    time: el.currentTime,
    paused: el.paused,
  }));
}

test.describe("game fixes", () => {
  test("showman opens the buzzer early, rules double and every action lands in chat", async ({
    browser,
    page,
  }) => {
    await signInAsGuest(page, "Host");
    const code = await hostGame(page, "Fixes");
    const pat = await person(browser, "Pat", laptop);
    await joinByLink(pat.page, code, "Pat", "player");
    const kim = await person(browser, "Kim", laptop);
    await joinByLink(kim.page, code, "Kim", "player");
    await pat.page.getByRole("button", { name: "I'm ready" }).click();
    await kim.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    // Skip round asks first; cancelling keeps the round
    await page.getByTestId("skip-round").first().click();
    await expect(page.getByRole("dialog", { name: "Skip to the next round?" })).toContainText(
      "6 questions are still on the board",
    );
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("round-name")).toContainText("Warm-up");

    // The picture question plays for a few seconds; the showman opens the buzzer now
    await cell(page, "Capitals", 200).click();
    await expect(dockPhase(pat.page)).toHaveText("Ready to buzz", { timeout: 15_000 });
    await expect(pat.page.getByTestId("buzz")).toHaveAttribute("data-early", "true");
    await expect(pat.page.locator("#buzz-early-hint")).toBeVisible();
    await page.getByTestId("open-buzzer").click();
    await expect(pat.page.getByTestId("buzz")).not.toHaveAttribute("data-early", /.*/, {
      timeout: 2_000,
    });
    await expect(page.getByTestId("open-buzzer")).toHaveCount(0);

    // While Pat answers, the others read who answers and what happens next
    const menuButton = pat.page.getByRole("button", { name: "Game menu" });
    await menuButton.focus();
    await pat.page.keyboard.press("Space");
    await expect(pat.page.getByRole("dialog", { name: "Game menu" })).toBeVisible();
    await expect(dockPhase(kim.page)).toHaveText("Ready to buzz");
    await pat.page.keyboard.press("Escape");
    await expect(menuButton).toBeFocused();
    await pat.page.getByTestId("buzz").click();
    await expect(dockPhase(kim.page)).toHaveText("Answering");
    await expect(kim.page.getByTestId("dock")).toContainText("If Pat is wrong");
    await expect(kim.page.getByTestId("dock")).not.toContainText("{{");
    await shot(page, `fixes-judge-${test.info().project.name}`);

    // Double points for a right answer
    await page.getByTestId("judge-correct-double").click();
    await expect.poll(() => chipScore(page, "Pat")).toBe("400");
    await expect
      .poll(() => chatLog(kim.page))
      .toEqual(expect.arrayContaining(["buzzer-open", "question-pick", "answer-result"]));
    const wide = (page.viewportSize()?.width ?? 0) >= 1024;
    if (wide) {
      await page.getByTestId("open-chat").click();
      await expect(
        page.getByTestId("chat-log").filter({ hasText: "judged Pat right" }),
      ).toContainText("+400");
    }

    // The report form stays open after the reveal ends
    await pat.page.getByTestId("report-question").click();
    const report = pat.page.getByRole("dialog", { name: "Report this question" });
    await expect(report).toBeVisible();
    await page.getByTestId("continue").click();
    await expect(dockPhase(pat.page)).toHaveText("Choosing");
    await expect(report).toBeVisible();
    await report.getByRole("button", { name: "Cancel" }).click();
    await expect(report).toHaveCount(0);

    // Zero ruling: wrong, but no points lost, and the buzzer reopens
    await cell(page, "Capitals", 100).click();
    await buzz(kim.page);
    await expect(dockPhase(page)).toHaveText("Answering");
    await page.getByTestId("judge-wrong-zero").click();
    await expect(dockPhase(pat.page)).toHaveText("Ready to buzz");
    await expect.poll(() => chipScore(page, "Kim")).toBe("0");
    for (const p of [page, pat.page]) await expectNoHorizontalScroll(p);

    expect([...pat.errors, ...kim.errors]).toEqual([]);
    await pat.context.close();
    await kim.context.close();
  });

  test("a rejoin keeps the answer going, and leavers can sit back down", async ({
    browser,
    page,
  }) => {
    await signInAsGuest(page, "Host");
    const code = await hostGame(page, "Rejoin", { maxPlayers: 2 });
    const pat = await person(browser, "Pat", laptop);
    await joinByLink(pat.page, code, "Pat", "player");
    const kim = await person(browser, "Kim", laptop);
    await joinByLink(kim.page, code, "Kim", "player");
    await pat.page.getByRole("button", { name: "I'm ready" }).click();
    await kim.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    await cell(page, "Capitals", 100).click();
    await buzz(pat.page);
    await expect(dockStatus(pat.page)).toHaveText("You're answering!");

    const draft = pat.page.locator("#answer-text");
    await draft.fill("Preserve this answer");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(dockPhase(pat.page)).toHaveText("Paused");
    await expect(draft).toBeHidden();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(draft).toBeVisible();
    await expect(draft).toHaveValue("Preserve this answer");

    // Kim drops out and comes back while Pat answers: Pat keeps answering
    await kim.page.reload();
    await expect(dockPhase(kim.page)).toHaveText("Answering", { timeout: 15_000 });
    await expect(dockStatus(pat.page)).toHaveText("You're answering!");
    // ...and when she leaves on purpose and comes back
    await kim.page.getByRole("button", { name: "Game menu" }).click();
    await kim.page.getByTestId("leave-game").click();
    await expect(kim.page).toHaveURL(/\/$/);
    await kim.page.goto(`/games/${code}`);
    await expect(dockPhase(kim.page)).toHaveText("Answering", { timeout: 15_000 });
    await expect(dockStatus(pat.page)).toHaveText("You're answering!");
    await expect(page.getByTestId("judge-correct")).toBeVisible();
    await page.getByTestId("judge-wrong").click();
    await expect(dockPhase(kim.page)).toHaveText("Ready to buzz");

    // Kim leaves on purpose; the seat is free again and she can take it back
    await kim.page.getByRole("button", { name: "Game menu" }).click();
    await kim.page.getByTestId("leave-game").click();
    await expect(kim.page).toHaveURL(/\/$/);
    await kim.page.goto(`/games/${code}`);
    await expect(kim.page.getByTestId("my-role")).toHaveText("Player");

    // Someone new can also take a free seat mid-game
    await kim.page.getByRole("button", { name: "Game menu" }).click();
    await kim.page.getByTestId("leave-game").click();
    await expect(kim.page).toHaveURL(/\/$/);
    const lee = await person(browser, "Lee", laptop);
    await lee.page.goto(`/games/${code}`);
    await expect(lee.page.getByRole("button", { name: "Join as player" })).toBeVisible();
    await expect(lee.page.getByText("1/2")).toBeVisible();

    expect([...pat.errors, ...kim.errors, ...lee.errors]).toEqual([]);
    await pat.context.close();
    await kim.context.close();
    await lee.context.close();
  });

  test("a second tab takes the seat without a reconnect loop", async ({ browser, page }) => {
    await signInAsGuest(page, "Host");
    const code = await hostGame(page, "Two tabs");
    const pat = await person(browser, "Pat", laptop);
    await joinByLink(pat.page, code, "Pat", "player");

    const second = await pat.context.newPage();
    await second.goto(`/games/${code}`);
    await expect(second.getByText("You are")).toContainText("Player");
    await expect(pat.page.getByTestId("taken-over")).toBeVisible();
    await expect(pat.page.getByRole("alertdialog")).toBeVisible();
    await expect(pat.page.getByTestId("take-over")).toBeFocused();
    for (let i = 0; i < 5; i++) {
      await pat.page.keyboard.press("Tab");
      // Native dialogs allow Tab to visit browser chrome (BODY is then active),
      // but never the underlying page. Keep the browser's standard modal behavior.
      await expect
        .poll(() =>
          pat.page
            .getByTestId("taken-over")
            .evaluate(
              (dialog) =>
                dialog.matches(":modal") &&
                (document.activeElement === document.body ||
                  dialog.contains(document.activeElement)),
            ),
        )
        .toBe(true);
    }
    await pat.page.keyboard.press("Escape");
    await expect(pat.page.getByTestId("taken-over")).toBeVisible();
    // Nothing flips back by itself
    await pat.page.waitForTimeout(3_000);
    await expect(pat.page.getByTestId("taken-over")).toBeVisible();
    await expect(second.getByTestId("taken-over")).toHaveCount(0);

    await pat.page.getByTestId("take-over").click();
    await expect(pat.page.getByTestId("taken-over")).toHaveCount(0);
    await expect(second.getByTestId("taken-over")).toBeVisible();
    await expect(pat.page.getByRole("button", { name: "I'm ready" })).toBeVisible();
    await pat.context.close();
  });

  test("a wrong answer resumes the clip where it stopped", async ({ browser, page }) => {
    const host = await person(browser, "Host", laptop);
    await signInAsGuest(host.page, "Host");
    const code = await hostGame(host.page, "Resume", {
      packageId: mediaPackageId(),
      falseStarts: false,
      // Isolate playback from the random draw's asynchronous server timer.
      // Otherwise the six-second fixture can end before the answer is accepted.
      fastestPress: true,
    });
    await joinByLink(page, code, "Pat", "player");
    const sam = await person(browser, "Sam", laptop);
    await joinByLink(sam.page, code, "Sam", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await sam.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    await cell(host.page, "Media", 100).click();
    await expect(dockPhase(sam.page)).toHaveText("Ready to buzz", { timeout: 15_000 });
    await sam.page.locator("[data-testid=media-video]").evaluate((el: HTMLMediaElement) => {
      el.muted = true;
    });
    await expect
      .poll(async () => (await video(sam.page)).time, { timeout: 10_000 })
      .toBeGreaterThan(1.5);
    await buzz(page);
    await expect(dockPhase(sam.page)).toHaveText("Answering");
    await expect.poll(async () => (await video(sam.page)).paused).toBe(true);
    const stopped = (await video(sam.page)).time;
    const duration = await sam.page
      .getByTestId("media-video")
      .evaluate((el: HTMLMediaElement) => el.duration);
    expect(stopped, "the answer must interrupt the clip before it ends").toBeLessThan(duration);

    await host.page.getByTestId("judge-wrong").click();
    await expect(dockPhase(sam.page)).toHaveText("Ready to buzz");
    await expect.poll(async () => (await video(sam.page)).paused).toBe(false);
    const resumed = (await video(sam.page)).time;
    expect(resumed, "the clip goes on, it does not start over").toBeGreaterThan(stopped - 0.5);
    await host.context.close();
    await sam.context.close();
  });

  test("after the question plays, the stage says the buzzer is open", async ({ browser, page }) => {
    await signInAsGuest(page, "Host");
    const code = await hostGame(page, "Cue");
    const pat = await person(browser, "Pat", laptop);
    await joinByLink(pat.page, code, "Pat", "player");
    await pat.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    await cell(page, "Capitals", 100).click();
    await expect(pat.page.getByTestId("buzzer-cue")).toContainText("The buzzer is open", {
      timeout: 15_000,
    });
    await expect(pat.page.getByTestId("buzzer-cue-time")).toContainText("s left");
    await expect(page.getByTestId("buzzer-cue")).toContainText("Waiting for a player");
    await shot(pat.page, `fixes-cue-${test.info().project.name}`);
    await expectNoHorizontalScroll(pat.page);
    await pat.context.close();
  });
});
