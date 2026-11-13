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
  const clip = mixed
    ? [...readFileSync(new URL("../e2e/fixtures/clip.webm", import.meta.url))]
    : [];
  await page.evaluate(async (clip) => {
    const model = "/src/features/package-editor/packageDraft.ts";
    const storage = "/src/features/package-editor/draftStorage.ts";
    const { emptyPackage, newRound, newTheme, newQuestion } = (await import(model)) as typeof Draft;
    const { saveDraft } = (await import(storage)) as typeof Storage;
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const drawing = canvas.getContext("2d")!;
    drawing.fillStyle = "#3477b8";
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const question = newQuestion(100, {
      text: "Main prompt",
      answerText: "Answer",
      questionFiles: [
        { occurrenceId: "image-1", md5: "image", type: "image", displayTime: 1000 },
        ...(clip.length
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
      ...(clip.length
        ? [
            {
              md5: "sound",
              type: "audio" as const,
              name: "sound.webm",
              bytes: new Uint8Array(clip),
            },
            {
              md5: "video",
              type: "video" as const,
              name: "video.webm",
              bytes: new Uint8Array(clip),
            },
          ]
        : []),
    ]);
  }, clip);
  await page.goto("/packages/editor/timeline-browser");
  await page.getByTestId("question-card").first().press("Control+Enter");
}

test.beforeEach(async ({ context }) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
});

async function changeLanguage(page: Page, language: string) {
  await page.evaluate(async (language) => {
    const module = "/src/i18n/index.ts";
    const { i18n } = await import(module);
    await i18n.changeLanguage(language);
    await document.fonts.ready;
  }, language);
}

async function screenshot(page: Page, name: string) {
  const dir = process.env.OQ_TIMELINE_SCREENSHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), animations: "disabled" });
}

test("media edit uses the full card width and keeps translations on one line", async ({ page }) => {
  await page.setViewportSize({ width: 1105, height: 864 });
  await openDraft(page);
  const card = page.getByTestId("attachment-card");
  for (const [language, name] of [
    ["en", "Edit"],
    ["uk", "Редагувати"],
    ["ru", "Редактировать"],
  ] as const) {
    await changeLanguage(page, language);
    const edit = card.getByRole("button", { name, exact: true });
    await expect(edit).toBeVisible();
    await expect
      .poll(() =>
        edit.evaluate((button) => {
          const label = button.querySelector("span")!;
          const fits = label.scrollWidth <= label.clientWidth;
          const scaled = getComputedStyle(label).fontSize !== getComputedStyle(button).fontSize;
          const fillsCard = button.clientWidth >= button.parentElement!.clientWidth - 18;
          return {
            fits,
            scaled,
            fillsCard,
            singleLine: getComputedStyle(label).whiteSpace === "nowrap",
          };
        }),
      )
      .toEqual({ fits: true, scaled: false, fillsCard: true, singleLine: true });
  }
  await card.scrollIntoViewIfNeeded();
  await screenshot(page, "media-edit-ru");
  await card.getByRole("button", { name: "Редактировать", exact: true }).click();
  await expect(page.getByTestId("media-editor")).toBeVisible();
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

test("question rules keep their controls and work with native keyboard navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1105, height: 864 });
  await openDraft(page);
  const form = page.getByTestId("question-dialog");
  const type = (name: string) => form.getByRole("button", { name: new RegExp(`^${name} `) });
  const everyone = form.getByRole("checkbox", { name: "Everyone answers" });
  const tooltip = form
    .getByRole("tooltip", { includeHidden: true })
    .filter({ hasText: "Everyone answers privately" });
  await expect(tooltip).toBeHidden();
  await everyone.hover();
  await expect(tooltip).toHaveCSS("transition-delay", "0.3s");
  await expect(tooltip).toBeVisible();
  await everyone.press("Space");
  await expect(everyone).toBeChecked();
  await expect(everyone).toHaveCSS("appearance", "none");
  await type("Stake").click();
  await expect(form.getByRole("checkbox", { name: "Everyone bids and answers" })).toBeChecked();
  await expect(form.getByLabel("Highest bid")).toBeVisible();
  await type("No risk").click();
  await expect(everyone).toBeChecked();
  const actual = form.getByLabel("Actual price");
  const multiplier = form.getByLabel("Price multiplier");
  const priceBox = (await actual.boundingBox())!;
  const multiplierBox = (await multiplier.boundingBox())!;
  expect(multiplierBox.y).toBe(priceBox.y);
  expect(multiplierBox.x).toBeGreaterThan(priceBox.x);
  if (process.env.OQ_TIMELINE_SCREENSHOTS) {
    await changeLanguage(page, "uk");
    await form
      .getByLabel("Множник ціни")
      .evaluate((field) => field.scrollIntoView({ block: "center" }));
    await screenshot(page, "no-risk-uk");
    await changeLanguage(page, "en");
  }

  await type("Secret").click();
  await expect(everyone).toHaveCount(0);
  const any = form.getByRole("radio", { name: "Any player", exact: true });
  await any.press("ArrowDown");
  const exceptPicker = form.getByRole("radio", { name: "Anyone but the picker" });
  await expect(exceptPicker).toBeChecked();
  await expect(exceptPicker).toHaveCSS("appearance", "none");
  const priceRule = form.getByLabel("Secret price rule");
  await expect(priceRule).toHaveCSS("background-position", /100% - 16px/);
  await expect(form.getByLabel("Prices the receiver picks from")).toBeVisible();
  await priceRule.selectOption("fixed");
  await expect(actual).toHaveValue("100");
  await priceRule.selectOption("roundExtremes");
  await expect(actual).toHaveCount(0);
  await priceRule.selectOption("range");
  await expect(form.getByLabel("Minimum")).toHaveValue("0");
  await expect(form.getByLabel("Maximum")).toHaveValue("1000");
  await priceRule.evaluate((field) => field.scrollIntoView({ block: "center" }));
  await screenshot(page, "secret-range");
  await form.getByLabel("Secret outcome").selectOption("award");
  await expect(form.getByLabel("Announcement and price chooser")).toHaveCount(0);
  await expect(form.getByLabel("Hint for the showman")).toHaveCount(0);
  await type("Hidden").click();
  await expect(everyone).toHaveCount(0);
  await expect(form.getByLabel("Hint for the showman")).toBeVisible();
  await type("Choice").click();
  const correct = form.getByRole("radio", { name: "Correct", exact: true });
  await expect(correct).toHaveCount(2);
  await correct.first().press("ArrowDown");
  await expect(correct.last()).toBeChecked();
  await expect(correct.last()).toHaveCSS("appearance", "none");
  await expect(form.getByRole("checkbox", { name: "Play audio and video together" })).toHaveCSS(
    "appearance",
    "none",
  );
  await page.emulateMedia({ forcedColors: "active" });
  await expect(correct.last()).toHaveCSS("appearance", "auto");
});

test("timing, answer notes and media groups adapt to the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1105, height: 864 });
  await openDraft(page);
  const form = page.getByTestId("question-dialog");
  const timings = form.getByTestId("question-timing-fields");
  const answer = timings.getByLabel("Time to answer");
  const text = timings.getByLabel("Text display time");
  const hint = form.getByLabel("Hint for the showman");
  const explanation = form.getByLabel("Answer explanation");
  await expect(timings.getByText("sec.", { exact: true })).toHaveCount(2);
  const top = async (field: typeof answer) => (await field.boundingBox())!.y;
  await expect.poll(async () => Math.abs((await top(answer)) - (await top(text)))).toBeLessThan(1);
  await expect
    .poll(async () => Math.abs((await top(hint)) - (await top(explanation))))
    .toBeLessThan(1);
  await expect(form.getByText(/\(optional\)/i)).toHaveCount(0);
  await expect(form.getByText(/wait for the item|only you can see/i)).toHaveCount(0);
  await expect(answer).toHaveAccessibleDescription(/press the button/);
  await expect(text).toHaveAccessibleDescription(/main text/);
  await expect(form.getByRole("textbox", { name: "Price", exact: true })).toHaveAttribute(
    "aria-required",
    "true",
  );
  const reveal = form.getByRole("textbox", { name: "Answer reveal duration" });
  const rangeError = form.getByText("Enter a duration from 2 to 30 seconds.");
  for (const value of ["1.9", "2", "30", "30.1"]) {
    await reveal.fill(value);
    await expect(rangeError).toHaveCount(value === "2" || value === "30" ? 0 : 1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await top(text)).toBeGreaterThan(await top(answer));
  expect(await top(explanation)).toBeGreaterThan(await top(hint));
  expect(await form.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(390);
  if (process.env.OQ_TIMELINE_SCREENSHOTS) {
    await changeLanguage(page, "uk");
    await timings.evaluate((fields) => fields.scrollIntoView({ block: "center" }));
    await screenshot(page, "timing-mobile-uk");
    await changeLanguage(page, "ru");
    await screenshot(page, "timing-mobile-ru");
  }
});

test("point editing uses a black outline and keeps radius changes and motion preference", async ({
  page,
}) => {
  await openDraft(page);
  const form = page.getByTestId("question-dialog");
  await form.getByLabel("How players answer").selectOption("point");
  const picker = form.getByTestId("point-picker");
  await picker.click();
  const target = picker.getByTestId("point-target");
  await expect(target).toHaveCSS("border-top-color", "rgb(0, 0, 0)");
  await expect(target).toHaveCSS("box-shadow", "none");
  await expect(target).toHaveCSS("animation-name", "pulse");
  const width = (await target.boundingBox())!.width;
  const radius = form.getByRole("slider", { name: "Answer radius" });
  await radius.press("End");
  await expect.poll(async () => (await target.boundingBox())!.width).toBeGreaterThan(width);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(target).toHaveCSS("animation-name", "none");
  if (process.env.OQ_TIMELINE_SCREENSHOTS) {
    await radius.press("Home");
    await radius.press("PageUp");
    await radius.press("PageUp");
    await picker.evaluate((field) => field.scrollIntoView({ block: "center" }));
    await screenshot(page, "point-editor");
  }
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
  await grip.evaluate((button) => button.scrollIntoView({ block: "start" }));
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
  await page.mouse.move(centerX, pane.y + 8);
  await expect
    .poll(
      async () => {
        const image = (await imageCard.boundingBox())!;
        const x = image.x + target.x;
        const y = image.y + target.y;
        if (y < pane.y + 48 || y > pane.y + pane.height - 48) return false;
        await page.mouse.move(x, y);
        await page.mouse.move(x + 1, y);
        return true;
      },
      { intervals: [16, 32, 32] },
    )
    .toBe(true);
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
  const timeline = form.getByTestId("question-media-fields");
  await timeline.getByRole("button", { name: "Add text step" }).click();
  await timeline.getByRole("textbox", { name: "Additional text 5" }).fill("Second clue");
  const cards = form.getByTestId("attachment-card");
  await expect(cards).toHaveCount(3);
  for (const card of [cards.first(), timeline.getByTestId("text-step-card")]) {
    const show = (await card.getByRole("textbox", { name: "Show sec." }).boundingBox())!;
    const remove = (await card.getByRole("button", { name: /Remove/ }).boundingBox())!;
    expect(remove.x).toBeGreaterThan(show.x + show.width);
    expect(remove.y).toBeLessThan(show.y + show.height);
    expect(remove.y + remove.height).toBeGreaterThan(show.y);
  }
  for (const index of [1, 2]) {
    const card = cards.nth(index);
    const player = (await card.locator(".editor-media-player").boundingBox())!;
    const clock = (await card.getByText(/^\d+:\d{2}\.\d{2} \/ /).boundingBox())!;
    const volume = (await card.getByRole("slider", { name: "Volume" }).boundingBox())!;
    expect(volume.x).toBeGreaterThan(clock.x + clock.width);
    expect(volume.y).toBeLessThan(clock.y + clock.height);
    expect(volume.width).toBeGreaterThanOrEqual(24);
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
      await changeLanguage(page, "uk");
      await screenshot(page, `timeline-compact-${width}`);
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
