import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import type * as CreateDraft from "../src/features/package-editor/createDraft";
import type * as Draft from "../src/features/package-editor/packageDraft";
import type * as Storage from "../src/features/package-editor/draftStorage";
import type * as PackageMedia from "../src/features/package-editor/packageMedia";
import type * as Limits from "../src/features/upload/contentLimits";
import type * as Upload from "../src/features/upload/upload";

async function openDraft(page: Page, mixed = false) {
  await page.goto("/");
  await page.evaluate(async (mixed) => {
    const model = "/src/features/package-editor/packageDraft.ts";
    const storage = "/src/features/package-editor/draftStorage.ts";
    const { emptyPackage, newRound, newTheme, newQuestion } = (await import(model)) as typeof Draft;
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
  }, mixed);
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
  await timeline.getByRole("textbox", { name: "Additional text 3" }).fill("Second part");
  await timeline.scrollIntoViewIfNeeded();
  const zone = timeline.getByTestId("attachment-drop-zone");
  const textCard = timeline.getByTestId("text-step-card");
  const imageCard = timeline.getByTestId("attachment-card");
  await textCard.getByRole("button", { name: "Additional text 3" }).dragTo(imageCard, {
    targetPosition: { x: 3, y: 20 },
    scroll: "none",
    steps: 8,
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
    scroll: "none",
    steps: 8,
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

test("native drag reorders a resized text step after scrolling the form", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await openDraft(page);
  const form = page.getByTestId("question-dialog");
  const body = form.getByTestId("question-form-body");
  const timeline = form.getByTestId("question-media-fields");
  await timeline.getByRole("button", { name: "Add text step" }).click();
  const textarea = timeline.getByRole("textbox", { name: "Additional text 3" });
  await textarea.fill("Second part");
  await textarea.scrollIntoViewIfNeeded();
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

  const textCard = timeline.getByTestId("text-step-card");
  const imageCard = timeline.getByTestId("attachment-card");
  const grip = textCard.getByRole("button", { name: "Additional text 3" });
  await grip.evaluate((button) => button.scrollIntoView({ block: "center" }));
  await grip.hover({ scroll: "none" });
  const handle = (await grip.boundingBox())!;
  const pane = (await body.boundingBox())!;
  const target = { x: 3, y: 20 };
  expect((await imageCard.boundingBox())!.y + target.y).toBeLessThan(pane.y);

  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 10, handle.y + handle.height / 2);
  await expect(textCard).toHaveAttribute("data-timeline-dragging", "true");

  // Drag at the top edge until Chromium scrolls the image into reach.
  const centerX = pane.x + pane.width / 2;
  await page.mouse.move(centerX, pane.y + 4);
  await expect.poll(async () => (await imageCard.boundingBox())!.y).toBeGreaterThan(pane.y + 60);
  await page.mouse.move(centerX, pane.y + pane.height / 2);

  // Enter the target, then move again to deliver dragover before releasing.
  await imageCard.hover({ position: target, scroll: "none" });
  await imageCard.hover({ position: target, scroll: "none" });
  await page.mouse.up();
  await expect(timeline.getByRole("textbox", { name: "Additional text 2" })).toHaveValue(
    "Second part",
  );
  await expect(imageCard).toHaveCount(1);
});

test("mixed image, audio, video and text cards keep the grip clear of media controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDraft(page, true);
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

const importedTimelines = [
  {
    name: "caption with 30 groups of 10",
    textOrder: null,
    textItems: undefined,
    fileOrders: Array.from({ length: 300 }, (_, index) => index),
    filesPerGroup: 10,
    steps: 30,
  },
  {
    name: "caption with an additional text step",
    textOrder: null,
    textItems: [{ order: 1, text: "Additional clue" }],
    fileOrders: [0, 2],
    filesPerGroup: 1,
    steps: 3,
  },
  {
    name: "main text after the first image",
    textOrder: 1,
    textItems: [],
    fileOrders: [0, 2],
    filesPerGroup: 1,
    steps: 3,
  },
];

for (const fixture of importedTimelines) {
  test(`preserves imported ${fixture.name} through editing, preview and export`, async ({
    page,
  }) => {
    const image = readFileSync(new URL("../public/icons/icon-192.png", import.meta.url));
    const md5 = createHash("md5").update(image).digest("hex");
    const question = {
      type: "simple",
      price: 100,
      text: "Main prompt",
      textOrder: fixture.textOrder,
      textItems: fixture.textItems,
      answerText: "Answer",
      questionFiles: fixture.fileOrders.map((order, index) => ({
        order,
        displayTime: 5000,
        waitForFinish: (index + 1) % fixture.filesPerGroup === 0,
        file: { md5, type: "image" },
      })),
    };
    const archive = zipSync({
      "content.json": strToU8(
        JSON.stringify({
          title: fixture.name,
          rounds: [{ name: "Round", themes: [{ name: "Theme", questions: [question] }] }],
        }),
      ),
      [`files/${md5}`]: image,
    });
    await page.goto("/");
    const id = await page.evaluate(async (bytes) => {
      const uploadPath = "/src/features/upload/upload.ts";
      const draftPath = "/src/features/package-editor/createDraft.ts";
      const { readPackageFile } = (await import(uploadPath)) as typeof Upload;
      const { draftFromParsed } = (await import(draftPath)) as typeof CreateDraft;
      return draftFromParsed(
        await readPackageFile(new File([new Uint8Array(bytes)], "timeline.oq")),
      );
    }, Array.from(archive));
    await page.goto(`/packages/editor/${id}`);
    const card = page.getByTestId("question-card").first();
    await card.press("Control+Enter");
    const form = page.getByTestId("question-dialog");
    await expect(
      form.getByText(
        fixture.textOrder == null
          ? "Shown alongside the question content."
          : "Shown at position 2 in the playback order.",
      ),
    ).toBeVisible();
    const previewButton = form.getByRole("button", { name: "Preview", exact: true });
    await previewButton.click();
    const preview = page.getByRole("dialog", { name: "Interactive game preview" });
    const game = preview.getByTestId("question-playtest");
    await expect(game.getByTestId("content-step-label")).toHaveText(`Part 1 of ${fixture.steps}`);
    await expect(game.getByTestId("visual-grid").getByRole("img")).toBeVisible();
    if (fixture.textOrder == null)
      await expect(game.getByTestId("question-text")).toHaveText("Main prompt");
    else await expect(game.getByTestId("question-text")).toHaveCount(0);
    if (fixture.steps === 3) {
      await game.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(game.getByTestId("content-step-label")).toHaveText("Part 2 of 3");
      await expect(game.getByTestId("question-text")).toHaveText(
        fixture.textOrder == null ? ["Additional clue", "Main prompt"] : ["Main prompt"],
      );
    }
    await preview.getByRole("button", { name: "Close", exact: true }).click();
    await form.getByTestId("question-save").click();
    await expect(form).toBeHidden();
    await card.press("Control+Enter");
    await form.locator("#qf-comment").fill("Reviewed without changing the timeline");
    await form.getByTestId("question-save").click();
    await expect(form).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(async (id) => {
          const path = "/src/features/package-editor/draftStorage.ts";
          const { loadDraft } = (await import(path)) as typeof Storage;
          return (await loadDraft(id))!.pkg.rounds[0]!.themes[0]!.questions[0]!.questionComment;
        }, id),
      )
      .toBe("Reviewed without changing the timeline");
    const exported = await page.evaluate(
      async ({ id, md5 }) => {
        const storagePath = "/src/features/package-editor/draftStorage.ts";
        const mediaPath = "/src/features/package-editor/packageMedia.ts";
        const uploadPath = "/src/features/upload/upload.ts";
        const limitsPath = "/src/features/upload/contentLimits.ts";
        const { loadDraft, loadMedia } = (await import(storagePath)) as typeof Storage;
        const { exportOq } = (await import(mediaPath)) as typeof PackageMedia;
        const { readPackageFile } = (await import(uploadPath)) as typeof Upload;
        const { questionGroupSizes } = (await import(limitsPath)) as typeof Limits;
        const blob = await exportOq((await loadDraft(id))!.pkg, await loadMedia([md5]));
        const { content } = await readPackageFile(new File([blob], "exported.oq"));
        const saved = content.rounds[0]!.themes[0]!.questions[0]!;
        return {
          textOrder: saved.textOrder,
          textItems: saved.textItems,
          fileOrders: saved.questionFiles!.map(({ order }) => order),
          groups: questionGroupSizes(saved, "question").map(({ files }) => files),
        };
      },
      { id, md5 },
    );
    expect(exported).toEqual({
      textOrder: fixture.textOrder,
      textItems: fixture.textItems,
      fileOrders: fixture.fileOrders,
      groups: fixture.steps === 30 ? Array(30).fill(10) : [1, 0, 1],
    });
    if (fixture.steps === 30) {
      await card.press("Control+Enter");
      await form.getByRole("button", { name: "Add text step" }).click();
      await form
        .getByTestId("text-step-card")
        .getByRole("textbox", { name: /Additional text/ })
        .fill("Actual step 31");
      await previewButton.click();
      await expect(preview.getByText("Question has 31 steps. Maximum 30.")).toBeVisible();
      await expect(game).toHaveCount(0);
    }
  });
}
