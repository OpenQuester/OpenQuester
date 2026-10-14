import { expect, test, type Page } from "@playwright/test";

import {
  buzz,
  cell,
  dockPhase,
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

/** What is on the stage: the step label and which kinds of content show. */
async function stage(page: Page) {
  return {
    label: await page.getByTestId("content-step-label").textContent(),
    text: await page.getByTestId("content-step").getByTestId("question-text").count(),
    video: await page.getByTestId("content-step").getByTestId("media-video").count(),
    image: await page.getByTestId("content-step").locator("img").count(),
  };
}

test.describe("question content sequence", () => {
  test("text, then the clip, then the picture, one at a time for everyone", async ({
    browser,
    page,
  }) => {
    const host = await person(browser, "Host", laptop);
    await signInAsGuest(host.page, "Host");
    const code = await hostGame(host.page, "Sequence", { packageId: mediaPackageId() });
    await joinByLink(page, code, "Pat", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    await cell(host.page, "Media", 400).click();
    await expect(dockPhase(page)).toHaveText("Ready to buzz", { timeout: 15_000 });

    // Part 1: only the text.
    for (const p of [page, host.page]) {
      await expect(p.getByTestId("content-step-label")).toHaveText("Part 1 of 3");
      expect(await stage(p)).toMatchObject({ text: 1, video: 0, image: 0 });
    }
    await shot(page, `sequence-text-${test.info().project.name}`);

    // Part 2: the clip replaces the text and plays by itself.
    for (const p of [page, host.page]) {
      await expect(p.getByTestId("content-step-label")).toHaveText("Part 2 of 3", {
        timeout: 10_000,
      });
      expect(await stage(p)).toMatchObject({ text: 0, video: 1, image: 0 });
    }
    await page.locator("[data-testid=media-video]").evaluate((el: HTMLMediaElement) => {
      el.muted = true;
    });
    await expect
      .poll(() =>
        page.locator("[data-testid=media-video]").evaluate((el: HTMLMediaElement) => el.paused),
      )
      .toBe(false);
    await shot(page, `sequence-video-${test.info().project.name}`);

    // Part 3: after the clip's real length, the picture.
    for (const p of [page, host.page]) {
      await expect(p.getByTestId("content-step-label")).toHaveText("Part 3 of 3", {
        timeout: 15_000,
      });
      expect(await stage(p)).toMatchObject({ text: 0, video: 0, image: 1 });
    }

    // After the last part the question text comes back as a reminder.
    await expect(page.getByTestId("question-recap")).toContainText("name the colour", {
      timeout: 10_000,
    });
    await shot(page, `sequence-end-${test.info().project.name}`);
    await host.context.close();
  });

  test("buzzing freezes the sequence and a wrong answer resumes it", async ({ browser, page }) => {
    const host = await person(browser, "Host", laptop);
    await signInAsGuest(host.page, "Host");
    // Buzzing mid-sequence needs false starts off: otherwise the buzzer only
    // opens once the whole sequence has played.
    const code = await hostGame(host.page, "Sequence buzz", {
      packageId: mediaPackageId(),
      falseStarts: false,
    });
    await joinByLink(page, code, "Pat", "player");
    const sam = await person(browser, "Sam", laptop);
    await joinByLink(sam.page, code, "Sam", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await sam.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    await cell(host.page, "Media", 400).click();
    await expect(page.getByTestId("content-step-label")).toHaveText("Part 2 of 3", {
      timeout: 20_000,
    });
    await buzz(page);
    await expect(dockPhase(page)).toHaveText("Answering");
    // While Pat answers, nobody moves on to the picture.
    await sam.page.waitForTimeout(8_000);
    await expect(sam.page.getByTestId("content-step-label")).toHaveText("Part 2 of 3");

    await host.page.getByTestId("judge-wrong").click();
    await expect(dockPhase(sam.page)).toHaveText("Ready to buzz");
    await expect(sam.page.getByTestId("content-step-label")).toHaveText("Part 3 of 3", {
      timeout: 15_000,
    });
    await host.context.close();
    await sam.context.close();
  });

  test("pressing before the sequence ends is a false start", async ({ browser, page }) => {
    const host = await person(browser, "Host", laptop);
    await signInAsGuest(host.page, "Host");
    const code = await hostGame(host.page, "False start", { packageId: mediaPackageId() });
    await joinByLink(page, code, "Pat", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    await cell(host.page, "Media", 400).click();
    await expect(page.getByTestId("content-step-label")).toHaveText("Part 1 of 3", {
      timeout: 15_000,
    });
    const button = page.getByTestId("buzz");
    await expect(button).toHaveText(/Wait for it/);
    await button.click();
    await expect(page.getByTestId("dock-info")).toContainText("Too early!");
    await expect(dockPhase(page)).toHaveText("Ready to buzz");
    await shot(page, `false-start-${test.info().project.name}`);

    // Once the sequence has played the buzzer opens and the press counts.
    await buzz(page);
    await expect(dockPhase(page)).toHaveText("Answering");
    await host.context.close();
  });
});
