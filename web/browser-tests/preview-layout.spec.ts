import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type * as Drafts from "../src/features/package-editor/draftStorage";
import type * as Model from "../src/features/package-editor/packageDraft";

async function openQuestion(page: Page, valid: boolean) {
  await page.goto("/");
  await page.evaluate(async (valid) => {
    const modelPath = "/src/features/package-editor/packageDraft.ts";
    const storagePath = "/src/features/package-editor/draftStorage.ts";
    const { emptyPackage, newQuestion, newRound, newTheme } = (await import(
      modelPath
    )) as typeof Model;
    const { saveDraft } = (await import(storagePath)) as typeof Drafts;
    const pkg = emptyPackage("Preview layout");
    const round = newRound("Round 1");
    round.themes = [
      newTheme("Theme", [
        newQuestion(
          valid ? 100 : null,
          valid
            ? { text: "Example question", answerText: "Answer" }
            : { answerType: "number", answerNumber: null },
        ),
      ]),
    ];
    pkg.rounds = [round];
    await saveDraft({ id: "preview-layout", pkg, updatedAt: Date.now() });
  }, valid);
  await page.goto("/packages/editor/preview-layout");
  await page.getByTestId("question-card").first().press("Control+Enter");
  await page
    .getByTestId("question-dialog")
    .getByRole("button", { name: "Preview", exact: true })
    .click();
}

test.beforeEach(async ({ context }) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
});

test("incomplete preview lists every issue in a centered panel and returns to editing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openQuestion(page, false);
  const dialog = page.getByRole("dialog", { name: "Interactive game preview" });
  const alert = dialog.getByRole("alert");
  await expect(alert.getByRole("heading")).toHaveText("This question is not finished yet.");
  await expect(alert.getByRole("listitem")).toHaveCount(3);
  const heading = (await alert.getByRole("heading").boundingBox())!;
  const body = (await dialog.locator(".overflow-y-auto").first().boundingBox())!;
  expect(Math.abs(heading.x + heading.width / 2 - (body.x + body.width / 2))).toBeLessThan(2);
  const group = (await alert.getByRole("list").boundingBox())!;
  const button = (await alert.getByRole("button", { name: "Return to editing" }).boundingBox())!;
  const middle = (heading.y + button.y + button.height) / 2;
  expect(Math.abs(middle - (body.y + body.height / 2))).toBeLessThan(5);
  expect(group.y).toBeGreaterThan(heading.y);
  if (process.env.OQ_PREVIEW_LAYOUT_SCREENSHOTS) {
    mkdirSync(process.env.OQ_PREVIEW_LAYOUT_SCREENSHOTS, { recursive: true });
    await page.screenshot({
      path: join(process.env.OQ_PREVIEW_LAYOUT_SCREENSHOTS, "invalid-desktop.png"),
    });
  }
  await alert.getByRole("button", { name: "Return to editing" }).click();
  await expect(page.getByLabel("Question text")).toBeFocused();
});

test("preview controls sit beside players on desktop and wrap without overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openQuestion(page, true);
  const dialog = page.getByRole("dialog", { name: "Interactive game preview" });
  const game = dialog.getByTestId("question-playtest");
  const chips = game.getByRole("list", { name: "Scores" });
  const controls = game.getByRole("group", { name: "Simulation controls" });
  const c = (await chips.boundingBox())!,
    t = (await controls.boundingBox())!;
  expect(t.x).toBeGreaterThan(c.x + c.width - 2);
  expect(Math.abs(c.y + c.height / 2 - (t.y + t.height / 2))).toBeLessThan(2);
  const header = await dialog.locator(":scope > div").first().boundingBox();
  expect(header!.height).toBeLessThanOrEqual(56);
  if (process.env.OQ_PREVIEW_LAYOUT_SCREENSHOTS) {
    mkdirSync(process.env.OQ_PREVIEW_LAYOUT_SCREENSHOTS, { recursive: true });
    await page.screenshot({
      path: join(process.env.OQ_PREVIEW_LAYOUT_SCREENSHOTS, "preview-desktop.png"),
    });
  }
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect(controls.getByRole("button", { name: "Restart" })).toBeVisible();
    await expect(chips).toBeVisible();
    if (process.env.OQ_PREVIEW_LAYOUT_SCREENSHOTS) {
      await page.screenshot({
        path: join(process.env.OQ_PREVIEW_LAYOUT_SCREENSHOTS, `preview-${width}.png`),
      });
    }
  }
});
