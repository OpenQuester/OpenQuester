import { expect, test } from "@playwright/test";

import {
  buzz,
  cell,
  chipScore,
  dockPhase,
  dockStatus,
  expectPhase,
  hostGame,
  joinByLink,
  person,
  shot,
  signInAsGuest,
} from "./support/game";

const laptop = { viewport: { width: 1280, height: 800 } };

test("only the no-risk picker answers; giving up reveals it without losing points or chat badges", async ({
  browser,
  page,
}) => {
  const host = await person(browser, "Host", laptop);
  const kim = await person(browser, "Kim", laptop);
  await signInAsGuest(host.page, "Host");
  const code = await hostGame(host.page, "No-risk give up");
  await joinByLink(page, code, "Pat", "player");
  await joinByLink(kim.page, code, "Kim", "player");
  await page.getByRole("button", { name: "I'm ready" }).click();
  await kim.page.getByRole("button", { name: "I'm ready" }).click();
  await expectPhase([page, kim.page, host.page], "Choosing");
  const picker = (await cell(page, "Capitals", 300).isEnabled()) ? page : kim.page;
  const other = picker === page ? kim.page : page;
  await cell(picker, "Capitals", 300).click();
  await expectPhase([picker, other], "Ready to buzz");
  await expect(other.getByTestId("buzz")).toHaveCount(0);
  await expect(other.getByTestId("dock-info")).toContainText("Not your turn");
  await buzz(picker);
  await picker.getByRole("button", { name: "Give up", exact: true }).click();
  await expectPhase([page, kim.page, host.page], "Answer");
  await expect(page.getByTestId("answer-reveal")).toContainText("Istanbul");
  await expect.poll(() => chipScore(host.page, "Pat")).toBe("0");
  await expect.poll(() => chipScore(host.page, "Kim")).toBe("0");
  await expect(page.getByTestId("open-chat").getByLabel(/unread/i)).toHaveCount(0);
  await host.page.getByTestId("continue").click();
  await expectPhase([page, kim.page], "Choosing");

  // Real showman actions produce system entries, which must stay badge-free.
  await host.page.getByRole("button", { name: "Pause", exact: true }).click();
  await expectPhase([page], "Paused");
  await host.page.getByRole("button", { name: "Resume", exact: true }).click();
  await expectPhase([page], "Choosing");
  await expect(page.getByTestId("open-chat").getByLabel(/unread/i)).toHaveCount(0);
  await host.page.getByTestId("open-chat").click();
  await expect(host.page.getByTestId("chat-log")).toHaveCount(2);
  await host.page.getByLabel("Message", { exact: true }).fill("Next question!");
  await host.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("open-chat").getByLabel(/unread/i)).toHaveText("1");
  await page.getByTestId("open-chat").click();
  await expect(page.getByTestId("chat-panel")).toContainText("Next question!");
  await expect(page.getByTestId("open-chat").getByLabel(/unread/i)).toHaveCount(0);
  await shot(page, `system-chat-${test.info().project.name}`);
  expect(host.errors).toEqual([]);
  expect(kim.errors).toEqual([]);
  await host.context.close();
  await kim.context.close();
});

function allPlayPackageId(): number {
  const id = Number(process.env.OQ_E2E_ALL_PLAY_PACKAGE_ID);
  if (!id) throw new Error("OQ_E2E_ALL_PLAY_PACKAGE_ID missing: global setup did not seed it");
  return id;
}

test.describe("everyone answers", () => {
  test("no-risk and stake for everyone: all players answer, the showman judges each", async ({
    browser,
    page,
  }) => {
    const host = await person(browser, "Host", laptop);
    await signInAsGuest(host.page, "Host");
    const code = await hostGame(host.page, "Everyone", { packageId: allPlayPackageId() });
    await joinByLink(page, code, "Pat", "player");
    const kim = await person(browser, "Kim", laptop);
    await joinByLink(kim.page, code, "Kim", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await kim.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    // ── No risk for everyone ───────────────────────────────────────────────
    await cell(host.page, "Everyone", 100).click();
    await expectPhase([page, kim.page, host.page], "Everyone answers");
    await expect(page.getByTestId("buzz")).toHaveCount(0);
    await page.getByLabel("Your answer").fill("Mars");
    await page.getByTestId("final-submit").click();
    await expect(dockStatus(page)).toHaveText("Answer locked in");
    await kim.page.getByLabel("Your answer").fill("Venus");
    await kim.page.keyboard.press("Enter");

    await expectPhase([page, host.page], "Everyone · review");
    const answers = host.page.getByTestId("all-play-answer");
    await expect(answers).toHaveCount(2);
    await shot(host.page, `everyone-review-${test.info().project.name}`);
    await answers.filter({ hasText: "Mars" }).getByTestId("all-play-correct").click();
    await answers.filter({ hasText: "Venus" }).getByTestId("all-play-wrong").click();
    await expectPhase([page, kim.page], "Answer");
    await expect(page.getByTestId("answer-reveal")).toContainText(
      "Also accepted: The red planet Mars",
    );
    await expect(page.getByTestId("answer-credits")).toContainText("Source: NASA");
    await expect.poll(() => chipScore(host.page, "Pat")).toBe("200");
    await expect.poll(() => chipScore(host.page, "Kim")).toBe("0");
    await host.page.getByTestId("continue").click();
    await expectPhase([page, kim.page], "Choosing");

    // ── Stake for everyone ─────────────────────────────────────────────────
    await cell(host.page, "Everyone", 200).click();
    await expectPhase([page, kim.page], "Everyone · stakes");
    await page.getByTestId("bid-submit").click();
    await expect(dockStatus(page)).toHaveText("Stake placed");
    await kim.page.getByTestId("bid-submit").click();

    await expectPhase([page, kim.page], "Everyone answers");
    await page.getByLabel("Your answer").fill("Au");
    await page.getByTestId("final-submit").click();
    await kim.page.getByLabel("Your answer").fill("Ag");
    await kim.page.getByTestId("final-submit").click();

    await expectPhase([host.page], "Everyone · review");
    await answers.filter({ hasText: "Au" }).getByTestId("all-play-correct").click();
    await answers.filter({ hasText: "Ag" }).getByTestId("all-play-wrong").click();
    await expectPhase([page, kim.page], "Answer");
    await expect.poll(() => chipScore(host.page, "Kim")).not.toBe("0");
    await host.page.getByTestId("continue").click();
    await expectPhase([page, kim.page], "Choosing");

    // ── Number answer, checked by the game ──────────────────────────────────
    await cell(host.page, "Everyone", 300).click();
    await expect(host.page.getByTestId("showman-number")).toContainText("1969 ± 1");
    const patBefore = await chipScore(host.page, "Pat");
    await buzz(page);
    await expect(dockPhase(page)).toHaveText("Answering");
    await page.getByLabel("Your answer").fill("1970");
    await page.keyboard.press("Enter");
    await expectPhase([page, kim.page], "Answer");
    await expect.poll(() => chipScore(host.page, "Pat")).not.toBe(patBefore);

    await host.context.close();
    await kim.context.close();
  });
});
