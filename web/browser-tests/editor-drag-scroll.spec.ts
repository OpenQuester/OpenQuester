import { expect, test } from "@playwright/test";
import type * as Drafts from "../src/features/package-editor/draftStorage";
import type * as Model from "../src/features/package-editor/packageDraft";

test("dragging scrolls the board and outline and can drop across rounds", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 700 });
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(async () => {
    const modelPath = "/src/features/package-editor/packageDraft.ts";
    const storagePath = "/src/features/package-editor/draftStorage.ts";
    const { emptyPackage, newQuestion, newRound, newTheme } = (await import(
      modelPath
    )) as typeof Model;
    const { saveDraft } = (await import(storagePath)) as typeof Drafts;
    const pkg = emptyPackage("Scroll test");
    pkg.rounds = Array.from({ length: 12 }, (_, i) => {
      const round = newRound(`Round ${i + 1}`);
      round.themes = Array.from({ length: i === 0 ? 12 : 1 }, (_, j) =>
        newTheme(`Theme ${i + 1}-${j + 1}`, [newQuestion(100, { text: "Question" })]),
      );
      return round;
    });
    await saveDraft({ id: "drag-scroll", pkg, updatedAt: Date.now() });
  });
  await page.goto("/packages/editor/drag-scroll");
  await expect(
    page.locator("header").getByRole("button", { name: "Package details" }),
  ).toBeHidden();
  await expect(
    page.getByTestId("outline").getByRole("button", { name: "Package details" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 700 });
  await expect(
    page.locator("header").getByRole("button", { name: "Package details" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 700 });
  const main = page.locator("main#main");
  const rows = page.getByTestId("theme-row");
  await expect(rows).toHaveCount(12);
  const handle = rows.first().locator('[draggable="true"]').first();
  const start = (await handle.boundingBox())!;
  const area = (await main.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y + 12, { steps: 5 });
  await page.mouse.move(area.x + area.width / 2, area.y + area.height - 12, { steps: 12 });
  await expect
    .poll(() => main.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop), {
      timeout: 15_000,
    })
    .toBeLessThanOrEqual(2);
  await page.mouse.move(area.x + area.width / 2, area.y + 8, { steps: 12 });
  await expect
    .poll(() => main.evaluate((el) => el.scrollTop), { timeout: 15_000 })
    .toBeLessThanOrEqual(2);
  await page.mouse.move(area.x + area.width / 2, area.y + area.height - 12, { steps: 12 });
  await expect
    .poll(() => main.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop), {
      timeout: 15_000,
    })
    .toBeLessThanOrEqual(2);
  const last = rows.last();
  const target = (await last.boundingBox())!;
  await page.mouse.move(target.x + 25, target.y + target.height - 8, { steps: 5 });
  await page.mouse.up();
  await expect(rows.last().getByRole("textbox", { name: "Theme name" })).toHaveValue("Theme 1-1");

  await main.evaluate((el) => (el.scrollTop = 0));
  const question = rows.first().getByTestId("question-card").first();
  const source = (await question.boundingBox())!;
  const outline = page.locator("aside[data-editor-scroll]");
  const side = (await outline.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + 10, source.y + 10, { steps: 5 });
  await page.mouse.move(side.x + side.width / 2, side.y + side.height - 12, { steps: 12 });
  await expect
    .poll(() => outline.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop), {
      timeout: 15_000,
    })
    .toBeLessThanOrEqual(2);
  await page.mouse.move(side.x + side.width / 2, side.y + 8, { steps: 12 });
  await expect
    .poll(() => outline.evaluate((el) => el.scrollTop), { timeout: 15_000 })
    .toBeLessThanOrEqual(2);
  await page.mouse.move(side.x + side.width / 2, side.y + side.height - 12, { steps: 12 });
  await expect
    .poll(() => outline.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop), {
      timeout: 15_000,
    })
    .toBeLessThanOrEqual(2);
  const destination = page.getByTestId("outline").getByRole("button", { name: /12 · Round 12/ });
  const box = (await destination.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText("Moved to Theme 12-1")).toBeVisible();
});
