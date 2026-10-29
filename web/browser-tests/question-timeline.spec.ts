import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type * as Draft from "../src/features/package-editor/packageDraft";
import type * as Storage from "../src/features/package-editor/draftStorage";

async function openDraft(page: Page, legacy = false, mixed = false) {
  await page.goto("/");
  await page.evaluate(
    async ({ legacy, mixed }) => {
      const model = "/src/features/package-editor/packageDraft.ts";
      const storage = "/src/features/package-editor/draftStorage.ts";
      const { emptyPackage, newRound, newTheme, newQuestion } = (await import(
        model
      )) as typeof Draft;
      const { saveDraft } = (await import(storage)) as typeof Storage;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 80;
      canvas.getContext("2d")!.fillRect(0, 0, 80, 80);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((value) => resolve(value!), "image/png"),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const question = newQuestion(100, {
        text: "Main prompt",
        answerText: "Answer",
        questionFiles: [
          { occurrenceId: "image-1", md5: "image", type: "image", displayTime: 1000 },
          ...(mixed
            ? [
                { occurrenceId: "sound", md5: "sound", type: "audio" as const, displayTime: null },
                { occurrenceId: "video", md5: "video", type: "video" as const, displayTime: null },
              ]
            : []),
        ],
        ...(legacy ? { textPosition: null, textItems: undefined, mainTextFirst: undefined } : {}),
      });
      const pkg = emptyPackage("Ordered steps");
      const round = newRound("Round");
      round.themes = [newTheme("Theme", [question])];
      pkg.rounds = [round];
      await saveDraft({ id: "timeline-browser", pkg, updatedAt: 1 }, [
        { md5: "image", type: "image", name: "image.png", bytes },
        ...(mixed
          ? [
              { md5: "sound", type: "audio" as const, name: "sound.mp3", bytes },
              { md5: "video", type: "video" as const, name: "video.mp4", bytes },
            ]
          : []),
      ]);
    },
    { legacy, mixed },
  );
  await page.goto("/packages/editor/timeline-browser");
  await page.getByTestId("question-card").first().press("Control+Enter");
}

test.beforeEach(async ({ context }) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
});

test("new question keeps main text first while additional text moves between media", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDraft(page);
  const form = page.getByTestId("question-dialog");
  const timeline = form.getByTestId("question-media-fields");
  await expect(form.getByRole("region", { name: "Playback order" })).toHaveCount(0);
  await timeline.getByRole("button", { name: "Add text step" }).click();
  const textarea = timeline.getByRole("textbox", { name: "Additional text 3" });
  await textarea.fill("Second part");
  const originalBox = (await textarea.boundingBox())!;
  await page.mouse.move(
    originalBox.x + originalBox.width - 3,
    originalBox.y + originalBox.height - 3,
  );
  await page.mouse.down();
  await page.mouse.move(
    originalBox.x + originalBox.width + 250,
    originalBox.y + originalBox.height + 500,
    { steps: 8 },
  );
  await page.mouse.up();
  const resizedBox = (await textarea.boundingBox())!;
  expect(resizedBox.height).toBeGreaterThan(originalBox.height);
  expect(resizedBox.height).toBeLessThanOrEqual(240);
  expect(resizedBox.width).toBeCloseTo(originalBox.width, 0);
  const zone = timeline.getByTestId("attachment-drop-zone");
  const textCard = timeline.getByTestId("text-step-card");
  const imageCard = timeline.getByTestId("attachment-card");
  await textCard.getByRole("button", { name: "Additional text 3" }).dragTo(imageCard, {
    targetPosition: { x: 3, y: 20 },
  });
  await expect(timeline.getByRole("textbox", { name: "Additional text 2" })).toHaveValue(
    "Second part",
  );
  await expect(zone.locator('[data-testid$="-card"]').first()).toHaveAttribute(
    "data-testid",
    "text-step-card",
  );
  await imageCard.getByRole("button", { name: "Drag file 1 to reorder" }).dragTo(textCard, {
    targetPosition: { x: 3, y: 20 },
  });
  await expect(zone.locator('[data-testid$="-card"]').first()).toHaveAttribute(
    "data-testid",
    "attachment-card",
  );
  await textCard.getByRole("button", { name: "Additional text 3" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("ArrowLeft");
  await expect(timeline.getByRole("textbox", { name: "Additional text 2" })).toHaveValue(
    "Second part",
  );
  await textCard.getByRole("button", { name: "Additional text 2" }).click();
  await page.keyboard.press("ArrowLeft");
  await expect(form).toBeVisible();
  await expect(textCard.getByRole("button", { name: "Additional text 2" })).toBeFocused();
  await expect(form.getByTestId("question-save")).toBeVisible();
  await expect(form.getByRole("button", { name: "Discard changes" })).toHaveCount(0);
  const handle = (await textCard.getByRole("button", { name: "Additional text 2" }).boundingBox())!;
  const target = (await imageCard.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
  await expect(textCard).toHaveAttribute("data-timeline-dragging", "true");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(form.getByTestId("question-save")).toBeVisible();
  await expect(form.getByRole("button", { name: "Discard changes" })).toHaveCount(0);
  await expect(zone.locator('[data-testid$="-card"]').first()).toHaveAttribute(
    "data-testid",
    "text-step-card",
  );
  await expect(form.getByTestId("media-editor")).toHaveCount(0);
  await expect(imageCard).toHaveCount(1);
  const dir = process.env.OQ_TIMELINE_SCREENSHOTS;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await timeline.scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    if (dir) {
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, `timeline-${width}.png`) });
    }
  }
  await form.getByTestId("question-save").click();
  await expect(form).toBeHidden();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const model = "/src/features/package-editor/packageDraft.ts";
        const storage = "/src/features/package-editor/draftStorage.ts";
        const { toUploadQuestion } = (await import(model)) as typeof Draft;
        const { loadDraft } = (await import(storage)) as typeof Storage;
        const q = (await loadDraft("timeline-browser"))!.pkg.rounds[0]!.themes[0]!.questions[0]!;
        const saved = toUploadQuestion(q, 0, false);
        return {
          textOrder: saved.textOrder,
          textItems: saved.textItems,
          imageOrder: saved.questionFiles?.[0]?.order,
        };
      }),
    )
    .toEqual({ textOrder: 0, textItems: [{ order: 1, text: "Second part" }], imageOrder: 2 });
  await page.getByTestId("question-card").first().press("Control+Enter");
  await expect(form.getByRole("textbox", { name: "Additional text 2" })).toHaveValue("Second part");
});

test("mixed image, audio, video and text cards keep the grip clear of media controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDraft(page, false, true);
  const form = page.getByTestId("question-dialog");
  await form.getByRole("button", { name: "Add text step" }).click();
  const cards = form.getByTestId("attachment-card");
  await expect(cards).toHaveCount(3);
  for (const index of [1, 2]) {
    const card = cards.nth(index);
    const player = (await card.locator(".editor-media-player").boundingBox())!;
    const grip = (await card
      .getByRole("button", { name: `Drag file ${index + 1} to reorder` })
      .boundingBox())!;
    expect(grip.y).toBeGreaterThanOrEqual(player.y + player.height);
  }
  const dir = process.env.OQ_TIMELINE_SCREENSHOTS;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await form.getByTestId("question-media-fields").scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(dir, `timeline-mixed-${width}.png`) });
    }
  }
});

test("touch drag reorders text among media without opening a menu", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openDraft(page);
  const form = page.getByTestId("question-dialog");
  await form.getByRole("button", { name: "Add text step" }).click();
  const text = form.getByTestId("text-step-card");
  const image = form.getByTestId("attachment-card");
  await text.scrollIntoViewIfNeeded();
  await image.scrollIntoViewIfNeeded();
  const handle = (await text.getByRole("button", { name: "Additional text 3" }).boundingBox())!;
  const target = (await image.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const point = (x: number, y: number) => [{ x, y }];
  const startX = handle.x + handle.width / 2,
    startY = handle.y + handle.height / 2;
  const endX = target.x + target.width / 2,
    endY = target.y + 10;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: point(startX, startY),
  });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: point(startX + ((endX - startX) * i) / 6, startY + ((endY - startY) * i) / 6),
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(
    form.getByTestId("attachment-drop-zone").locator('[data-testid$="-card"]').first(),
  ).toHaveAttribute("data-testid", "text-step-card");
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("legacy caption becomes main-first only after an explicit save", async ({ page }) => {
  await openDraft(page, true);
  const form = page.getByTestId("question-dialog");
  await expect(form.getByText("Shown first, before the media and other text steps.")).toBeVisible();
  await expect(form.getByTestId("text-step-card")).toHaveCount(0);
  await expect(form.getByRole("checkbox", { name: /main text/i })).toHaveCount(0);
  await form.getByRole("button", { name: "Close", exact: true }).click();
  await expect(form).toBeHidden();
  const original = await page.evaluate(async () => {
    const storage = "/src/features/package-editor/draftStorage.ts";
    const { loadDraft } = (await import(storage)) as typeof Storage;
    return (await loadDraft("timeline-browser"))!.pkg.rounds[0]!.themes[0]!.questions[0]!;
  });
  expect(original.textPosition).toBeNull();
  expect(original.mainTextFirst).toBeUndefined();
  await page.getByTestId("question-card").first().press("Control+Enter");
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Interactive game preview" });
  const game = preview.getByTestId("question-playtest");
  await expect(game).toBeVisible();
  await game.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(game.getByTestId("question-text")).toHaveText("Main prompt");
  await expect(game.getByTestId("content-stage").locator("img")).toHaveCount(0);
  await preview.getByRole("button", { name: "Close", exact: true }).click();
  await form.getByTestId("question-save").click();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const storage = "/src/features/package-editor/draftStorage.ts";
        const { loadDraft } = (await import(storage)) as typeof Storage;
        return (await loadDraft("timeline-browser"))!.pkg.rounds[0]!.themes[0]!.questions[0]!
          .textPosition;
      }),
    )
    .toBe(0);
  const saved = await page.evaluate(async () => {
    const model = "/src/features/package-editor/packageDraft.ts";
    const storage = "/src/features/package-editor/draftStorage.ts";
    const { toUploadQuestion } = (await import(model)) as typeof Draft;
    const { loadDraft } = (await import(storage)) as typeof Storage;
    return toUploadQuestion(
      (await loadDraft("timeline-browser"))!.pkg.rounds[0]!.themes[0]!.questions[0]!,
      0,
      false,
    );
  });
  expect(saved.textOrder).toBe(0);
  expect(saved.textItems).toEqual([]);
});
