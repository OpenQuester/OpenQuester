import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import type { OqPackage } from "../src/api/types";
import type { GameStore } from "../src/game/store";

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
  await expect(picker.getByRole("button", { name: "Pass", exact: true })).toHaveCount(0);
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
  await host.page.locator("header").getByRole("button", { name: "Resume", exact: true }).click();
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

test("an imported SIQ script resumes at its second answer after reconnect", async ({
  browser,
  page,
}) => {
  const host = await person(browser, "Host", laptop);
  let packageId: number | undefined;
  let code: string | undefined;
  try {
    expect((await host.page.request.post("/v1/dev/login/990033")).ok()).toBe(true);
    await host.page.goto("/packages/editor");
    const xml = readFileSync(
      new URL("../src/features/upload/fixtures/siq/script-two-asks.xml", import.meta.url),
      "utf8",
    )
      .replace('name="Script continuation"', `name="Script reconnect ${Date.now()}"`)
      .replace('<param name="duration">2</param>', '<param name="duration">45</param>');
    await host.page.getByTestId("import-file").setInputFiles({
      name: "two-asks.siq",
      mimeType: "application/zip",
      buffer: Buffer.from(zipSync({ "content.xml": strToU8(xml) })),
    });
    await expect(host.page.getByTestId("round-board")).toBeVisible();
    await host.page.getByTestId("publish").click();
    const created = host.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/v1/packages",
    );
    await host.page.getByTestId("publish-confirm").click();
    const response = await created;
    expect(response.ok()).toBe(true);
    packageId = (await response.json()).id as number;
    await expect(host.page.getByTestId("publish-done")).toBeVisible();

    code = await hostGame(host.page, "Script reconnect", { packageId });
    await joinByLink(page, code, "Pat", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await expectPhase([page, host.page], "Choosing");
    await cell(host.page, "Cell theme", 100).click();
    const answer = page.getByLabel("Your answer");
    await expect(page.getByText("First prompt", { exact: true })).toBeVisible();
    await expect(answer).toBeEditable();
    await answer.fill("42");
    await answer.press("Enter");
    await expect(page.getByText("Second prompt", { exact: true })).toBeVisible();
    await expect(answer).toBeEditable();
    await expect.poll(() => chipScore(host.page, "Pat")).toBe("100");
    await page.reload();
    await expect(page.getByText("Second prompt", { exact: true })).toBeVisible();
    await expect(page.getByText("First prompt", { exact: true })).toHaveCount(0);
    await expect(answer).toBeEditable();
    await answer.fill("42");
    await answer.press("Enter");
    await expect(page.getByTestId("answer-reveal")).toContainText("42");
    await expect.poll(() => chipScore(host.page, "Pat")).toBe("200");
    expect(host.errors).toEqual([]);
  } finally {
    if (code) await host.page.request.delete(`/v1/games/${code}`);
    if (packageId) await host.page.request.delete(`/v1/packages/${packageId}`);
    await host.context.close();
  }
});

test.describe("everyone answers", () => {
  test("normal for everyone keeps board 100, scores actual 500 and rejoins a private answer", async ({
    browser,
    page,
  }) => {
    const host = await person(browser, "Host", laptop);
    const kim = await person(browser, "Kim", laptop);
    try {
      await signInAsGuest(host.page, "Host");
      const code = await hostGame(host.page, "Normal everyone", { packageId: allPlayPackageId() });
      await joinByLink(page, code, "Pat", "player");
      await joinByLink(kim.page, code, "Kim", "player");
      await page.getByRole("button", { name: "I'm ready" }).click();
      await kim.page.getByRole("button", { name: "I'm ready" }).click();
      await expectPhase([page, kim.page, host.page], "Choosing");
      await expect(cell(page, "Normal for everyone", 100)).toBeVisible();
      await cell(host.page, "Normal for everyone", 100).click();
      await expectPhase([page, kim.page, host.page], "Everyone answers");
      for (const player of [page, kim.page]) {
        await expect(player.getByTestId("buzz")).toHaveCount(0);
        await expect(player.getByTestId("bid-submit")).toHaveCount(0);
        await expect(player.getByTestId("dock")).toContainText("+500 / −500");
      }
      await page.getByLabel("Your answer").fill("Mars");
      await page.getByTestId("final-submit").click();
      await expect(dockStatus(page)).toHaveText("Answer locked in");
      await page.reload();
      await expectPhase([page], "Everyone answers");
      await expect(dockStatus(page)).toHaveText("Answer locked in");
      await expect(page.getByTestId("dock")).toContainText("+500 / −500");
      await expect(kim.page.getByTestId("all-play-answer")).toHaveCount(0);
      await kim.page.getByLabel("Your answer").fill("Venus");
      await kim.page.getByTestId("final-submit").click();
      await expectPhase([host.page, page, kim.page], "Everyone · review");
      const answers = host.page.getByTestId("all-play-answer");
      await answers.filter({ hasText: "Mars" }).getByTestId("all-play-correct").click();
      await answers.filter({ hasText: "Venus" }).getByTestId("all-play-wrong").click();
      await expectPhase([page, kim.page], "Answer");
      await expect.poll(() => chipScore(host.page, "Pat")).toBe("500");
      await expect.poll(() => chipScore(host.page, "Kim")).toBe("−500");
      await host.page.getByTestId("continue").click();
      await expectPhase([page, kim.page], "Choosing");
      const played = page.getByRole("button", {
        name: "Normal for everyone, 100, already played",
        exact: true,
      });
      await expect(played).toBeDisabled();
      await expect(played).toHaveText("100");
      expect(host.errors).toEqual([]);
      expect(kim.errors).toEqual([]);
    } finally {
      await host.context.close();
      await kim.context.close();
    }
  });

  test("normal for everyone select scores actual 500 by option identity after SIQ publication", async ({
    browser,
    page,
  }, info) => {
    const host = await person(browser, "Host", laptop);
    const kim = await person(browser, "Kim", laptop);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let packageId: number | undefined;
    let code: string | undefined;
    try {
      expect((await host.page.request.post("/v1/dev/login/990032")).ok()).toBe(true);
      await host.page.goto("/packages/editor");
      const xml = readFileSync(
        new URL("../src/features/upload/fixtures/siq/select.xml", import.meta.url),
        "utf8",
      )
        .replace('name="Select fixture"', `name="SIQ everyone selects ${Date.now()}"`)
        .replace('price="300" type="stake"', 'price="100" type="forAll"');
      await host.page.getByTestId("import-file").setInputFiles({
        name: "everyone-selects.siq",
        mimeType: "application/zip",
        buffer: Buffer.from(zipSync({ "content.xml": strToU8(xml) })),
      });
      await expect(host.page.getByTestId("round-board")).toBeVisible();
      await host.page.reload();
      await expect(host.page.getByTestId("question-card")).toHaveCount(1);
      await host.page.getByTestId("question-card").dblclick();
      await host.page
        .getByTestId("question-dialog")
        .getByRole("textbox", { name: "Actual price" })
        .fill("500");
      await host.page.getByTestId("question-save").click();

      await host.page.getByTestId("publish").click();
      const created = host.page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/v1/packages",
      );
      await host.page.getByTestId("publish-confirm").click();
      const response = await created;
      expect(response.ok()).toBe(true);
      packageId = (await response.json()).id as number;
      await expect(host.page.getByTestId("publish-done")).toBeVisible({ timeout: 30_000 });
      const storedResponse = await host.page.request.get(`/v1/packages/${packageId}`);
      expect(storedResponse.ok()).toBe(true);
      const stored = (await storedResponse.json()) as OqPackage;
      const question = stored.rounds[0]!.themes[0]!.questions[0]!;
      expect(question).toMatchObject({
        type: "simple",
        subType: "forEveryone",
        price: 100,
        realPrice: 500,
        answerType: "select",
        answerText: "Chosen",
        correctChoiceOrder: 2,
        selectSource: { rightLabels: ["C", "B"] },
      });
      expect(
        question.answers
          ?.slice()
          .sort((a, b) => a.order - b.order)
          .map(({ order, sourceLabel, text }) => [order, sourceLabel, text]),
      ).toEqual([
        [0, "A", "Same"],
        [1, "B", "Same"],
        [2, "C", "Chosen"],
      ]);

      let invalidChoiceSent = false;
      let refused = false;
      if (info.project.name === "desktop") {
        await page.routeWebSocket(/\/socket\.io\//, (client) => {
          const server = client.connectToServer();
          const prefix = "42/games,";
          client.onMessage((message) => {
            if (
              !invalidChoiceSent &&
              typeof message === "string" &&
              message.startsWith(prefix + '["all-play-answer",')
            ) {
              const [event, answer] = JSON.parse(message.slice(prefix.length)) as [
                string,
                { choiceOrder: number },
              ];
              invalidChoiceSent = true;
              server.send(prefix + JSON.stringify([event, { ...answer, choiceOrder: 999 }]));
              return;
            }
            server.send(message);
          });
          server.onMessage((message) => {
            if (
              invalidChoiceSent &&
              typeof message === "string" &&
              message.startsWith(prefix + '["error",')
            ) {
              refused = true;
            }
            client.send(message);
          });
        });
      }
      code = await hostGame(host.page, "Everyone selects", { packageId });
      await joinByLink(page, code, "Pat", "player");
      await joinByLink(kim.page, code, "Kim", "player");
      for (const player of [page, kim.page]) {
        await player.getByRole("button", { name: "I'm ready" }).click();
      }
      await expectPhase([page, kim.page, host.page], "Choosing");
      await cell(host.page, "T", 100).click();
      await expectPhase([page, kim.page], "Everyone answers");
      await expect(page.getByTestId("dock")).toContainText("+500 / −500");
      const playerOptionsTab = page.getByRole("tab", { name: /Answer options/ });
      if (await playerOptionsTab.isVisible()) await playerOptionsTab.click();
      const choices = page.getByRole("list", { name: "Answer options", exact: true });
      await expect(choices.locator("kbd")).toHaveText(["A", "B", "C"]);
      const chosen = choices.getByRole("button", { name: "Chosen", exact: true });
      if (info.project.name === "desktop") {
        await expect(chosen).toBeEnabled();
        await chosen.press("Enter");
        await expect.poll(() => refused).toBe(true);
        await expect(chosen).toBeEnabled();
        await chosen.press("Enter");
      } else {
        await chosen.click();
      }
      await expect(dockStatus(page)).toHaveText("Answer locked in");
      await page.reload();
      await expect(dockStatus(page)).toHaveText("Answer locked in");
      const rejoined = await page.evaluate(
        () =>
          (window as unknown as { __oqGame: { getState(): GameStore } }).__oqGame.getState().session
            ?.state,
      );
      expect(rejoined?.currentQuestion).not.toHaveProperty("correctChoiceOrder");
      expect(rejoined?.currentQuestion).not.toHaveProperty("selectSource");
      const submitted = rejoined?.allPlay?.entries.filter((entry) => entry.submitted);
      expect(submitted).toHaveLength(1);
      expect(submitted?.[0]).not.toHaveProperty("choiceOrder");
      const observerOptionsTab = kim.page.getByRole("tab", { name: /Answer options/ });
      if (await observerOptionsTab.isVisible()) await observerOptionsTab.click();
      const wrongOptions = kim.page.getByRole("button", { name: "Same", exact: true });
      await expect(wrongOptions).toHaveCount(2);
      await wrongOptions.nth(1).click();
      await expectPhase([page, kim.page, host.page], "Answer");
      await expect(page.getByTestId("answer-reveal")).toContainText("Chosen");
      await expect.poll(() => chipScore(host.page, "Pat")).toBe("500");
      await expect.poll(() => chipScore(host.page, "Kim")).toBe("−500");
      expect([...errors, ...host.errors, ...kim.errors]).toEqual([]);
    } finally {
      if (code) await host.page.request.delete(`/v1/games/${code}`);
      if (packageId) await host.page.request.delete(`/v1/packages/${packageId}`);
      await host.context.close();
      await kim.context.close();
    }
  });

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
