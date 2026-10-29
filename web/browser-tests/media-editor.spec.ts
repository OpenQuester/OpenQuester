import { expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type * as Drafts from "../src/features/package-editor/draftStorage";
import type * as Model from "../src/features/package-editor/packageDraft";
import type * as Archive from "../src/features/upload/archive";
import type * as Process from "../src/features/package-editor/media-editor/processMedia";
import type * as Edits from "../src/features/package-editor/media-editor/mediaEdits";
import type * as Bunny from "mediabunny";
import type * as Media from "../src/features/package-editor/packageMedia";
import type * as Oq from "../src/features/upload/oq";

test.setTimeout(90_000);
test.beforeEach(async ({ context, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
});

function tone() {
  const rate = 48000,
    seconds = 4,
    data = Buffer.alloc(44 + rate * seconds * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(data.length - 44, 40);
  for (let i = 0; i < rate * seconds; i++)
    data.writeInt16LE(Math.round(Math.sin((i * 440 * Math.PI * 2) / rate) * 20000), 44 + i * 2);
  return data;
}

async function seed(
  page: Page,
  shared = false,
  remote = false,
  size = { width: 400, height: 240 },
  final = false,
  legacyCaption = false,
) {
  const result = await page.evaluate(
    async ({ shared, remote, size, final, legacyCaption }) => {
      const d = "/src/features/package-editor/draftStorage.ts",
        m = "/src/features/package-editor/packageDraft.ts",
        a = "/src/features/upload/archive.ts";
      const { saveDraft } = (await import(d)) as typeof Drafts;
      const { emptyPackage, newRound, newTheme, newQuestion } = (await import(m)) as typeof Model;
      const { md5Hex } = (await import(a)) as typeof Archive;
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(size.width / 400, size.height / 240);
      const gradient = ctx.createLinearGradient(40, 20, 360, 220);
      gradient.addColorStop(0, "#2dd4bf");
      gradient.addColorStop(1, "#2563eb");
      ctx.fillStyle = gradient;
      ctx.fillRect(40, 20, 320, 200);
      ctx.fillStyle = "white";
      ctx.font = "bold 48px sans-serif";
      ctx.fillText("QUIZ", 126, 137);
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
      const bytes = new Uint8Array(await blob.arrayBuffer()),
        md5 = md5Hex(bytes);
      const pkg = emptyPackage("Media editor browser verification"),
        round = newRound("Round one", final ? "final" : "simple");
      const media = { md5, type: "image" as const, displayTime: 4500, waitForFinish: false };
      round.themes = [
        newTheme("Media", [
          newQuestion(final ? null : 100, {
            text: "Name this artwork",
            answerText: "Quiz",
            questionFiles: [media],
            ...(legacyCaption
              ? { mainTextFirst: undefined, textItems: undefined, textPosition: null }
              : {}),
          }),
          ...(shared
            ? [
                newQuestion(200, {
                  text: "Shared original",
                  answerText: "Quiz",
                  questionFiles: [media],
                }),
              ]
            : []),
        ]),
      ];
      pkg.rounds = [round];
      const id = crypto.randomUUID();
      await saveDraft({ id, pkg, updatedAt: Date.now() }, [
        {
          md5,
          type: "image",
          name: md5,
          displayName: "quiz.png",
          bytes: remote ? new Uint8Array() : bytes,
          ...(remote ? { url: "/source-image" } : {}),
        },
      ]);
      return { id, md5, bytes: [...bytes] };
    },
    { shared, remote, size, final, legacyCaption },
  );
  await page.goto(`/packages/editor/${result.id}`);
  await page.getByTestId("question-card").first().press("Control+Enter");
  await expect(page.getByTestId("question-dialog")).toBeVisible();
  return result;
}

async function readDraft(page: Page, id: string) {
  return page.evaluate(async (id) => {
    const path = "/src/features/package-editor/draftStorage.ts";
    const { loadDraft, loadMedia } = (await import(path)) as typeof Drafts;
    const draft = (await loadDraft(id))!;
    const questions = draft.pkg.rounds[0]!.themes[0]!.questions;
    const files = await loadMedia(questions.flatMap((q) => q.questionFiles.map((f) => f.md5)));
    return { questions, files: [...files.values()].map((f) => ({ ...f, bytes: [...f.bytes] })) };
  }, id);
}

async function screenshots(page: Page, state: string) {
  for (const [name, width, height] of [
    ["desktop", 1864, 884],
    ["tablet", 820, 1180],
    ["phone", 375, 812],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId("media-editor")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), {
        message: `${state} overflows at ${width}px`,
      })
      .toBe(false);
    const footer = page.getByTestId("media-editor").locator("footer");
    await expect(footer).toBeInViewport();
    if (name === "desktop") await expectNoEditorScroll(page);
    else {
      const aside = page.getByTestId("media-editor").locator("aside");
      if (await aside.count()) {
        const overlaps = await aside.evaluate((el) => {
          const previous = el.previousElementSibling!;
          return el.getBoundingClientRect().top < previous.getBoundingClientRect().bottom - 1;
        });
        expect(overlaps, `${state} preview overlaps settings at ${width}px`).toBe(false);
      }
      await page
        .getByTestId("media-editor")
        .locator(":scope > div")
        .evaluate((el) => {
          el.scrollTop = 0;
        });
    }
    const dir = process.env.OQ_MEDIA_SCREENSHOTS;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, `${state}-${name}.png`) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function expectNoEditorScroll(page: Page) {
  await expect
    .poll(() =>
      page
        .getByTestId("media-editor")
        .evaluate((root) =>
          [root, ...root.querySelectorAll<HTMLElement>("*")]
            .filter(
              (el) =>
                ["auto", "scroll"].includes(getComputedStyle(el).overflowY) &&
                el.scrollHeight > el.clientHeight + 2,
            )
            .map((el) => el.tagName + "." + el.className),
        ),
    )
    .toEqual([]);
}

test("reviewed image bytes persist, originals collect, and Undo restores them", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  const source = await seed(page);
  const form = page.getByTestId("question-dialog");
  await form.locator("#qf-answer-type").selectOption("point");
  await form.getByTestId("point-picker").press("Enter");
  await expect(form.getByTestId("point-target")).toHaveCount(1);
  await form.getByRole("button", { name: "Edit", exact: true }).first().click();
  const editor = page.getByTestId("media-editor");
  await editor.getByRole("button", { name: "Rotate right", exact: true }).click();
  await editor.getByLabel("Output quality").selectOption("small");
  await editor.getByLabel("Output quality").selectOption("high");
  await expect(editor.getByRole("button", { name: "Save media", exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await screenshots(page, "image");
  await editor.getByRole("button", { name: "Save media", exact: true }).click();
  await expect(form.getByTestId("point-target")).toHaveCount(0);
  await expect(form.getByRole("button", { name: "Edit", exact: true }).first()).toBeFocused();
  // The form owns the result until Save question.
  expect((await readDraft(page, source.id)).questions[0]!.questionFiles[0]!.md5).toBe(source.md5);
  await page.getByTestId("question-save").click();
  await expect
    .poll(async () => (await readDraft(page, source.id)).questions[0]!.questionFiles[0]!.md5)
    .not.toBe(source.md5);
  const saved = await readDraft(page, source.id),
    result = saved.files[0]!;
  expect(result.preserveEncoding).toBe(true);
  expect(saved.questions[0]!.questionFiles[0]).toMatchObject({
    displayTime: 4500,
    waitForFinish: false,
  });
  const verified = await page.evaluate(
    async ({ bytes, oldHash }) => {
      const p = "/src/features/package-editor/media-editor/processMedia.ts",
        m = "/src/features/package-editor/media-editor/mediaEdits.ts",
        d = "/src/features/package-editor/draftStorage.ts";
      const { encodeEditedImage } = (await import(p)) as typeof Process;
      const { initialImageEdits } = (await import(m)) as typeof Edits;
      const { loadMedia } = (await import(d)) as typeof Drafts;
      const out = await encodeEditedImage(
        { md5: oldHash, type: "image", name: "quiz.png", bytes: new Uint8Array(bytes) },
        "image/png",
        { ...initialImageEdits(), rotation: 90, quality: "high", qualityChanged: true },
        new AbortController().signal,
      );
      const bitmap = await createImageBitmap(new Blob([out.bytes as BlobPart]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
        ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const alpha = ctx.getImageData(0, 0, 1, 1).data[3];
      const dimensions = [bitmap.width, bitmap.height];
      bitmap.close();
      return {
        md5: out.md5,
        dimensions,
        alpha,
        oldStored: (await loadMedia([oldHash])).has(oldHash),
      };
    },
    { bytes: source.bytes, oldHash: source.md5 },
  );
  expect(result.md5).toBe(verified.md5); // Last quality choice, not a stale preview.
  expect(verified.dimensions).toEqual([240, 400]);
  expect(verified.alpha).toBe(0);
  expect(verified.oldStored).toBe(false);
  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await expect
    .poll(async () => (await readDraft(page, source.id)).questions[0]!.questionFiles[0]!.md5)
    .toBe(source.md5);
  expect((await readDraft(page, source.id)).files[0]!.bytes).toEqual(source.bytes);
  await page.getByRole("button", { name: /^Redo/ }).first().click();
  await expect.poll(async () => (await readDraft(page, source.id)).files[0]!.md5).toBe(result.md5);
  await page.reload();
  expect((await readDraft(page, source.id)).files[0]!.bytes).toEqual(result.bytes);
  expect(failures).toEqual([]);
});

test("replacement is scoped to one occurrence, and discarding staged changes is safe", async ({
  page,
}) => {
  const source = await seed(page, true);
  const form = page.getByTestId("question-dialog");
  await form.getByRole("button", { name: "Edit", exact: true }).first().click();
  const editor = page.getByTestId("media-editor");
  await editor.getByRole("button", { name: "Rotate left", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Save media", exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await editor.getByRole("button", { name: "Discard changes", exact: true }).click();
  expect((await readDraft(page, source.id)).files).toHaveLength(1);
  await form.getByRole("button", { name: "Edit", exact: true }).first().click();
  await editor.getByRole("button", { name: "Rotate right", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Save media", exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await editor.getByRole("button", { name: "Save media", exact: true }).click();
  await page.getByTestId("question-save").click();
  await expect.poll(async () => (await readDraft(page, source.id)).files.length).toBe(2);
  const result = await readDraft(page, source.id);
  expect(result.questions[0]!.questionFiles[0]!.md5).not.toBe(source.md5);
  expect(result.questions[1]!.questionFiles[0]!.md5).toBe(source.md5);
});

test("video and audio controls export real trimmed tracks and linear fades", async ({ page }) => {
  const video = [...readFileSync("e2e/fixtures/clip.webm")],
    audio = [...tone()];
  const result = await page.evaluate(
    async ({ video, audio }) => {
      const p = "/src/features/package-editor/media-editor/processMedia.ts",
        b = "/browser-tests/mediabunny.ts";
      const { encodeEditedAudioVideo } = (await import(p)) as typeof Process;
      const { Input, ALL_FORMATS, BlobSource, AudioSampleSink } = (await import(b)) as typeof Bunny;
      const open = (bytes: Uint8Array) =>
        new Input({ formats: ALL_FORMATS, source: new BlobSource(new Blob([bytes as BlobPart])) });
      const input = open(new Uint8Array(video)),
        duration = await input.computeDuration();
      input.dispose();
      const end = Math.min(duration, 1.2);
      const v = await encodeEditedAudioVideo(
        { md5: "source", type: "video", name: "clip.webm", bytes: new Uint8Array(video) },
        "video/webm",
        { kind: "video", start: 0.2, end, mute: true, fadeIn: 0, fadeOut: 0 },
        () => {},
        new AbortController().signal,
      );
      const vi = open(v.bytes),
        tracks = await vi.getTracks(),
        vDuration = await vi.computeDuration();
      const hasSound = (await vi.getPrimaryAudioTrack()) !== null;
      vi.dispose();
      const a = await encodeEditedAudioVideo(
        { md5: "sound", type: "audio", name: "tone.wav", bytes: new Uint8Array(audio) },
        "audio/wav",
        { kind: "audio", start: 1, end: 3, mute: false, fadeIn: 1.5, fadeOut: 0.5 },
        () => {},
        new AbortController().signal,
      );
      const ai = open(a.bytes),
        at = (await ai.getPrimaryAudioTrack())!,
        sink = new AudioSampleSink(at);
      const sums = [0, 0, 0, 0, 0],
        counts = [0, 0, 0, 0, 0],
        centers = [0.05, 0.25, 1, 1.75, 1.95];
      for await (const sample of sink.samples()) {
        const buffer = sample.toAudioBuffer(),
          channel = buffer.getChannelData(0);
        for (let i = 0; i < channel.length; i++) {
          const time = sample.timestamp + i / buffer.sampleRate;
          for (let j = 0; j < centers.length; j++)
            if (Math.abs(time - centers[j]!) < 0.02) {
              sums[j]! += channel[i]! ** 2;
              counts[j]!++;
            }
        }
        sample.close();
      }
      const aDuration = await ai.computeDuration();
      ai.dispose();
      return {
        hasSound,
        tracks: tracks.length,
        vDuration,
        expectedVideo: end - 0.2,
        aDuration,
        rms: sums.map((v, i) => Math.sqrt(v / counts[i]!)),
        names: [v.name, a.name],
      };
    },
    { video, audio },
  );
  expect(result.hasSound).toBe(false);
  expect(result.tracks).toBe(1);
  // This fixture is 15 fps: a cut can round to the adjacent frame boundary.
  expect(Math.abs(result.vDuration - result.expectedVideo)).toBeLessThan(0.08);
  expect(result.aDuration).toBeCloseTo(2, 1);
  expect(result.rms[0]! / result.rms[2]!).toBeCloseTo(0.05, 1);
  expect(result.rms[1]! / result.rms[2]!).toBeCloseTo(0.25, 1);
  expect(result.rms[3]! / result.rms[2]!).toBeCloseTo(0.75, 1);
  expect(result.rms[4]! / result.rms[2]!).toBeCloseTo(0.15, 1);
  expect(result.names[0]).toMatch(/\.webm$/);
  expect(result.names[1]).toMatch(/\.m4a$/);
});

test("mixed ten-file queue, audio/video preview, unsupported and failed downloads stay recoverable", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  const source = await seed(page);
  const form = page.getByTestId("question-dialog");
  await form
    .locator('input[type="file"]')
    .first()
    .setInputFiles([
      { name: "sound.wav", mimeType: "audio/wav", buffer: tone() },
      {
        name: "video.webm",
        mimeType: "video/webm",
        buffer: readFileSync("e2e/fixtures/clip.webm"),
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        name: `image-${i}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(source.bytes),
      })),
    ]);
  const editor = page.getByTestId("media-editor");
  await expect(editor.getByLabel("End time (min:sec)")).toHaveValue("0:04.00");
  await editor.getByLabel("Start time (min:sec)").fill("");
  await expect(editor.getByRole("button", { name: "Save and next" })).toBeDisabled();
  await editor.getByLabel("Start time (min:sec)").fill("0:01.00");
  await editor.getByLabel("End time (min:sec)").fill("0:03.00");
  await editor.getByLabel("Fade-in duration in seconds").fill("0.5");
  await editor.getByLabel("Fade-out duration in seconds").fill("0.5");
  await editor.getByRole("button", { name: "Play preview" }).click();
  await expect
    .poll(() => editor.locator("audio").evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(1);
  await editor.getByRole("button", { name: "Pause preview" }).click();
  await editor.locator("audio").evaluate(async (el: HTMLAudioElement) => {
    const seeked = new Promise<void>((resolve) =>
      el.addEventListener("seeked", () => resolve(), { once: true }),
    );
    el.currentTime = 1;
    await seeked;
  });
  await screenshots(page, "audio");
  await editor.getByRole("button", { name: "Save and next" }).click();
  await expect(editor.getByText("File 2 of 10")).toBeVisible();
  await expect(editor.getByLabel("End time (min:sec)")).toBeVisible();
  await screenshots(page, "video");
  await editor.getByRole("button", { name: "Use unchanged" }).click();
  await expect(editor.getByText("File 3 of 10")).toBeVisible();
  await screenshots(page, "batch");
  await editor.getByRole("button", { name: "Add remaining unchanged" }).click();
  await expect(editor).toBeHidden();
  await page.getByTestId("question-save").click();
  await expect
    .poll(async () => (await readDraft(page, source.id)).questions[0]!.questionFiles.length)
    .toBe(11);
  await page.getByTestId("question-card").first().press("Control+Enter");
  await form
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("broken image"),
    });
  await expect(editor.getByRole("alert")).toBeVisible();
  await screenshots(page, "failure");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await readDraft(page, source.id)).questions[0]!.questionFiles).toHaveLength(11);
  expect(failures).toEqual([]);
});

test("opening media editing pauses retained question previews without losing the draft", async ({
  page,
}) => {
  await seed(page);
  const form = page.getByTestId("question-dialog");
  await form
    .locator('input[type="file"]')
    .first()
    .setInputFiles([
      { name: "sound.wav", mimeType: "audio/wav", buffer: tone() },
      {
        name: "video.webm",
        mimeType: "video/webm",
        buffer: readFileSync("e2e/fixtures/clip.webm"),
      },
    ]);
  const editor = page.getByTestId("media-editor");
  await editor.getByRole("button", { name: "Add remaining unchanged" }).click();
  await expect(editor).toBeHidden();
  const question = form.getByLabel("Question text", { exact: true });
  await question.fill("Unsaved question draft");
  const questionElement = await question.elementHandle();
  await expect(form.locator("audio").first()).toBeAttached();
  await expect(form.locator("video").first()).toBeVisible();
  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const cards = form.getByTestId("attachment-card");
    const audioCard = cards.filter({ has: page.locator("audio") }).first();
    const videoCard = cards.filter({ has: page.locator("video") }).first();
    expect((await audioCard.boundingBox())!.height).toBeLessThan(
      (await videoCard.boundingBox())!.height,
    );
  }
  const originals = await form.locator("audio, video").elementHandles();
  for (const original of originals) {
    await original.evaluate(async (element) => {
      const media = element as HTMLMediaElement;
      media.muted = true;
      media.loop = true;
      await media.play();
    });
    await expect.poll(() => original.evaluate((el) => (el as HTMLMediaElement).paused)).toBe(false);
  }

  await form.getByRole("button", { name: "Edit", exact: true }).nth(1).click();
  await expect(editor).toBeVisible();
  for (const original of originals)
    await expect.poll(() => original.evaluate((el) => (el as HTMLMediaElement).paused)).toBe(true);
  await editor.getByRole("button", { name: "Play preview" }).click();
  await expect
    .poll(() => editor.locator("audio").evaluate((el: HTMLAudioElement) => el.paused))
    .toBe(false);
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(question).toHaveValue("Unsaved question draft");
  expect(await questionElement!.evaluate((el) => el.isConnected)).toBe(true);
  for (const original of originals)
    expect(await original.evaluate((el) => el.isConnected && (el as HTMLMediaElement).paused)).toBe(
      true,
    );
});

test("editor video retains working controls in fullscreen", async ({ page }) => {
  await seed(page);
  const form = page.getByTestId("question-dialog");
  await form
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "video.webm",
      mimeType: "video/webm",
      buffer: readFileSync("e2e/fixtures/clip.webm"),
    });
  await page.getByTestId("media-editor").getByRole("button", { name: "Use unchanged" }).click();
  const player = form
    .locator(".editor-media-player")
    .filter({ has: page.locator("video") })
    .first();
  await expect(player.getByRole("slider", { name: "Seek" })).toBeEnabled();
  const assertLayout = async (target: typeof player) => {
    const video = (await target.locator("video").boundingBox())!;
    const fullscreen = (await target.getByRole("button", { name: "Fullscreen" }).boundingBox())!;
    const play = (await target.getByRole("button", { name: "Play", exact: true }).boundingBox())!;
    const seek = (await target.getByRole("slider", { name: "Seek" }).boundingBox())!;
    const mute = (await target.getByRole("button", { name: "Mute", exact: true }).boundingBox())!;
    const volume = (await target.getByRole("slider", { name: "Volume" }).boundingBox())!;
    const bounds = (await target.boundingBox())!;
    expect(fullscreen.x).toBeGreaterThanOrEqual(video.x);
    expect(fullscreen.x + fullscreen.width).toBeLessThanOrEqual(video.x + video.width + 1);
    expect(fullscreen.y + fullscreen.height).toBeLessThanOrEqual(video.y + video.height + 1);
    expect(seek.y).toBeGreaterThanOrEqual(play.y + play.height);
    expect(mute.y).toBeGreaterThanOrEqual(seek.y + seek.height);
    expect(volume.x + volume.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(seek.width).toBeGreaterThan(bounds.width - 20);
  };
  const dir = process.env.OQ_MEDIA_SCREENSHOTS;
  for (const width of [1304, 1366]) {
    await page.setViewportSize({ width, height: 884 });
    await assertLayout(player);
    if (dir) {
      mkdirSync(dir, { recursive: true });
      await player.screenshot({ path: join(dir, `editor-card-${width}.png`) });
    }
  }
  await player.getByRole("button", { name: "Fullscreen" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.fullscreenElement?.classList.contains("editor-media-player")),
    )
    .toBe(true);
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await expect(player.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await player.getByRole("button", { name: "Pause", exact: true }).click();
  await player.getByRole("slider", { name: "Seek" }).fill("0.5");
  await expect
    .poll(() => player.locator("video").evaluate((media: HTMLVideoElement) => media.currentTime))
    .toBeCloseTo(0.5, 1);
  await player.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(player.getByRole("button", { name: "Unmute", exact: true })).toBeVisible();
  await player.getByRole("button", { name: "Unmute", exact: true }).click();
  const volume = player.getByRole("slider", { name: "Volume" });
  expect((await volume.boundingBox())!.width).toBeLessThanOrEqual(112);
  await volume.focus();
  await volume.press("Home");
  await expect(volume).toHaveValue("0");
  await player.getByRole("button", { name: "Unmute", exact: true }).click();
  await expect(volume).toHaveValue("1");
  await expect(player.getByRole("button", { name: "Mute", exact: true })).toBeVisible();
  if (dir) {
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, "editor-fullscreen.png") });
  }
  await player.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(player.getByRole("button", { name: "Fullscreen" })).toBeFocused();
  await page.getByTestId("question-save").click();
  const inspector = page
    .locator("aside")
    .locator(".editor-media-player")
    .filter({ has: page.locator("video") })
    .first();
  await expect(inspector).toBeVisible();
  await assertLayout(inspector);
  if (dir) await inspector.screenshot({ path: join(dir, "editor-inspector.png") });
});

test("inspector resizing stays bounded and falls back to the editor when space is limited", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByTestId("question-dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  const card = page.getByTestId("question-card").first();
  await card.click();
  const inspector = page.getByTestId("inspector");
  const handle = page.locator('[role="separator"][aria-controls="package-editor-inspector"]');
  await expect(handle).toHaveAccessibleName("Resize question inspector");
  const expectWidth = async (width: number) => {
    await expect(handle).toHaveAttribute("aria-valuenow", String(width));
    await expect.poll(async () => (await inspector.boundingBox())?.width).toBe(width);
  };
  await expectWidth(360);
  await handle.focus();
  await handle.press("End");
  await expectWidth(600);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(handle).toHaveAttribute("aria-valuemax", "528");
  await expectWidth(528);
  expect((await page.locator("#main").boundingBox())!.width).toBeGreaterThanOrEqual(480);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectWidth(600);
  await handle.press("Home");
  await expectWidth(320);
  await handle.press("ArrowLeft");
  await expectWidth(336);
  await handle.press("ArrowRight");
  await expectWidth(320);
  const handleBox = (await handle.boundingBox())!;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 - 80, handleBox.y + handleBox.height / 2);
  await page.mouse.up();
  await expectWidth(400);
  const dragBox = (await handle.boundingBox())!;
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2 - 20, dragBox.y + dragBox.height / 2);
  await expectWidth(420);
  await handle.dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await page.mouse.move(dragBox.x + dragBox.width / 2 - 80, dragBox.y + dragBox.height / 2);
  await page.mouse.up();
  await expectWidth(420);
  await inspector.getByRole("button", { name: "Close", exact: true }).click();
  await expect(inspector).toHaveCount(0);
  await card.click();
  await expectWidth(420);
  await page.setViewportSize({ width: 1279, height: 900 });
  await expect(inspector).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectWidth(420);
  await page.evaluate(async () => {
    const path = "/src/i18n/index.ts";
    const { i18n } = await import(path);
    await i18n.changeLanguage("ru");
  });
  await handle.press("Home");
  await expect
    .poll(() => inspector.evaluate((element) => element.scrollWidth - element.clientWidth))
    .toBe(0);
  const remove = inspector.getByRole("button", { name: "Удалить" });
  const removeBox = (await remove.boundingBox())!;
  const inspectorBox = (await inspector.boundingBox())!;
  expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(inspectorBox.x + inspectorBox.width);
  await page.locator("#main").evaluate((element) => {
    element.parentElement!.style.width = "1000px";
  });
  await expect(inspector).toHaveCount(0);
  await card.click();
  await expect(page.getByTestId("question-dialog")).toBeVisible();
});

test("video attachment actions are compact and removal stays staged", async ({ page }) => {
  const source = await seed(page);
  const form = page.getByTestId("question-dialog");
  await form
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "video.webm",
      mimeType: "video/webm",
      buffer: readFileSync("e2e/fixtures/clip.webm"),
    });
  await page.getByTestId("media-editor").getByRole("button", { name: "Use unchanged" }).click();
  await page.getByTestId("question-save").click();
  await expect
    .poll(async () => (await readDraft(page, source.id)).questions[0]!.questionFiles.length)
    .toBe(2);
  await page.getByTestId("question-card").first().press("Control+Enter");
  const card = form.getByTestId("attachment-card").filter({ has: page.locator("video") });
  const edit = card.getByRole("button", { name: "Edit", exact: true });
  const remove = card.getByRole("button", { name: "Remove file" });
  for (const width of [1304, 1366, 375]) {
    await page.setViewportSize({ width, height: 884 });
    await card.scrollIntoViewIfNeeded();
    const editBox = (await edit.boundingBox())!;
    const removeBox = (await remove.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    expect(
      Math.abs(editBox.y + editBox.height / 2 - (removeBox.y + removeBox.height / 2)),
    ).toBeLessThan(2);
    expect(removeBox.x).toBeGreaterThanOrEqual(editBox.x + editBox.width);
    expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    const dir = process.env.OQ_ITEM2_SCREENSHOTS;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      await card.screenshot({ path: join(dir, `video-card-${width}.png`) });
    }
  }
  await page.evaluate(async () => {
    const path = "/src/i18n/index.ts";
    const { i18n } = await import(path);
    await i18n.changeLanguage("uk");
  });
  const ukrainianEdit = card.getByRole("button", { name: "Редагувати", exact: true });
  const ukrainianRemove = card.getByRole("button", { name: "Прибрати файл" });
  const ukEditBox = (await ukrainianEdit.boundingBox())!;
  const ukRemoveBox = (await ukrainianRemove.boundingBox())!;
  const ukCardBox = (await card.boundingBox())!;
  expect(ukRemoveBox.width).toBeGreaterThanOrEqual(44);
  expect(ukRemoveBox.height).toBeGreaterThanOrEqual(44);
  expect(ukRemoveBox.x + ukRemoveBox.width).toBeLessThanOrEqual(ukCardBox.x + ukCardBox.width);
  expect(
    Math.abs(ukEditBox.y + ukEditBox.height / 2 - (ukRemoveBox.y + ukRemoveBox.height / 2)),
  ).toBeLessThan(2);
  await page.evaluate(async () => {
    const path = "/src/i18n/index.ts";
    const { i18n } = await import(path);
    await i18n.changeLanguage("en");
  });
  await expect(card.getByRole("img", { name: "Video" })).toHaveCount(0);
  await remove.focus();
  await expect(remove).toBeFocused();
  await remove.press("Enter");
  await expect(card).toHaveCount(0);
  expect((await readDraft(page, source.id)).questions[0]!.questionFiles).toHaveLength(2);
  await page.getByTestId("question-save").click();
  await expect
    .poll(async () => (await readDraft(page, source.id)).questions[0]!.questionFiles.length)
    .toBe(1);
});

test("closing nested preview restores focus without scrolling the question form", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 375, height: 812 });
  const form = page.getByTestId("question-dialog");
  const body = form.getByTestId("question-form-body");
  const opener = form.getByRole("button", { name: "Preview", exact: true });
  await opener.focus();
  const bounds = (await body.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
  const before = await body.evaluate((node) => node.scrollTop);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Interactive game preview" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  expect(await body.evaluate((node) => node.scrollTop)).toBe(before);
});

test("local playtest uses unsaved content, separates roles, and leaves the form mounted", async ({
  page,
}) => {
  // A legacy caption is now shown as the first step in the editor preview.
  const source = await seed(page, false, false, { width: 1200, height: 900 }, false, true);
  const calls: string[] = [];
  const form = page.getByTestId("question-dialog");
  const unsaved = "Unsaved interactive question";
  await form.getByLabel("Question text").fill(unsaved);
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Interactive game preview" });
  const game = preview.getByTestId("question-playtest");
  await expect(game).toBeVisible();
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/v1/")) calls.push(request.url());
  });
  const controls = game.getByRole("group", { name: "Simulation controls" });
  await expect(game.getByTestId("question-text")).toHaveText(unsaved);
  await controls.getByRole("button", { name: "Pause", exact: true }).click();
  const dir = process.env.OQ_MEDIA_SCREENSHOTS;
  for (const width of [375, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
      .toBe(false);
    await expect(game.getByRole("list", { name: "Scores" })).toBeVisible();
  }
  await expect(game.getByTestId("question-text")).toHaveText(unsaved);
  const question = game.getByRole("region", { name: "Question" });
  const stage = question.locator("../..");
  const media = game.getByTestId("content-stage").locator("img");
  const text = game.getByTestId("question-text");
  const dock = game.getByTestId("dock");
  const scroller = preview.locator(".overflow-y-auto").first();
  await expect(media).toHaveCount(0);
  const checkLayout = async (contents: Array<typeof text>) => {
    for (const [width, height] of [
      [1366, 884],
      [1296, 700],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const content of [...contents, dock]) {
        const box = (await content.boundingBox())!;
        const stageBox = (await stage.boundingBox())!;
        const dockBox = (await dock.boundingBox())!;
        expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(dockBox.y + 1);
        if (content !== dock) {
          expect(box.y).toBeGreaterThanOrEqual(stageBox.y);
          expect(box.y + box.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + 1);
        }
        for (const edge of ["start", "end"] as const) {
          await content.evaluate(
            (element, block) => element.scrollIntoView({ block, behavior: "instant" }),
            edge,
          );
          const visibleBox = (await content.boundingBox())!;
          const scrollBox = (await scroller.boundingBox())!;
          const edgeY = edge === "start" ? visibleBox.y : visibleBox.y + visibleBox.height;
          expect(edgeY).toBeGreaterThanOrEqual(scrollBox.y - 3);
          expect(edgeY).toBeLessThanOrEqual(scrollBox.y + scrollBox.height + 3);
        }
      }
    }
  };
  await checkLayout([text]);

  if (dir) {
    await page.setViewportSize({ width: 375, height: 900 });
    await game.getByTestId("question-text").scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(dir, "playtest-question-375.png"), animations: "disabled" });
    await page.setViewportSize({ width: 1920, height: 900 });
  }
  await controls.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(media).toBeVisible();
  await controls.getByRole("button", { name: "Pause", exact: true }).click();
  await checkLayout([media]);
  await controls.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(game.getByTestId("showman-panel")).toHaveCount(0);
  await controls.getByLabel("View as").selectOption("1");
  await expect(game.getByTestId("showman-panel")).toContainText("Quiz");
  await controls.getByLabel("View as").selectOption("2");
  await expect(game.getByTestId("dock-phase")).toHaveText("Ready to buzz");
  await controls.getByRole("button", { name: "Continue", exact: true }).click();
  await game.focus();
  await page.keyboard.press("Space");
  await expect(game.getByTestId("dock-phase")).toHaveText("Answering");
  const answer = game.getByRole("textbox", { name: "Your answer" });
  await answer.fill("Test answer");
  await game.getByRole("button", { name: "Send", exact: true }).click();
  await controls.getByLabel("View as").selectOption("1");
  await expect(game.getByTestId("showman-panel")).toContainText("Test answer");
  await game.focus();
  await page.keyboard.press("c");
  await expect(game.getByTestId("answer-reveal")).toContainText("Quiz");
  await expect(game.getByRole("button", { name: /report/i })).toHaveCount(0);
  await controls.getByRole("button", { name: "Restart" }).click();
  await controls.getByRole("button", { name: "Continue", exact: true }).click();
  await controls.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(game.getByTestId("dock-status")).toHaveText("Buzzer is open");
  await game.focus();
  await page.keyboard.press("Space");
  await expect(game.getByTestId("dock-phase")).toHaveText("Answering");
  await controls.getByLabel("View as").selectOption("1");
  await controls.getByLabel("View as").focus();
  await page.keyboard.press("w");
  await expect(game.getByTestId("dock-phase")).toHaveText("Answering");
  await game.focus();
  await page.keyboard.press("w");
  await expect(game.getByTestId("dock-phase")).toHaveText("Ready to buzz");
  expect(calls).toEqual([]);
  expect((await readDraft(page, source.id)).questions[0]!.text).toBe("Name this artwork");
  await page.keyboard.press("Escape");
  await expect(form.getByLabel("Question text")).toHaveValue(unsaved);
});

test("mobile playtest presents the real point picker and local final input", async ({ page }) => {
  const source = await seed(page, false, false, undefined, true);
  await page.setViewportSize({ width: 375, height: 900 });
  const form = page.getByTestId("question-dialog");
  await form.locator("#qf-answer-type").selectOption("point");
  const target = form.getByTestId("point-picker");
  await expect(target.locator("img")).toBeVisible();
  await target.click();
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const game = page.getByTestId("question-playtest");
  await expect(game).toBeVisible();
  await expect(game.getByRole("button", { name: /kept for the preview question/i })).toBeDisabled();
  expect((await readDraft(page, source.id)).questions[0]!.answerPoint).toBeNull();
  const dir = process.env.OQ_MEDIA_SCREENSHOTS;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, "playtest-final-375.png"), animations: "disabled" });
  }
  const controls = game.getByRole("group", { name: "Simulation controls" });
  await controls.getByRole("button", { name: "Test settings" }).click();
  const view = controls.getByLabel("View as");
  await view.selectOption({ label: "Showman" });
  await game.getByTestId("final-theme").filter({ hasText: "Test theme 1" }).click();
  await game.getByTestId("final-theme").filter({ hasText: "Test theme 2" }).click();
  for (const player of ["Player 1", "Player 2", "Player 3"]) {
    await view.selectOption({ label: player });
    await game.getByRole("textbox", { name: "Your bid" }).fill("100");
    await game.getByRole("button", { name: "Place bid" }).click();
  }
  await view.selectOption({ label: "Player 1" });
  await expect(game.getByTestId("question-text")).toHaveText("Name this artwork");
  await expect(game.getByTestId("dock-info")).toHaveText("Watch the question first.");
  await expect(game.getByTestId("point-picker")).toHaveCount(0);
  const picker = game.getByTestId("point-picker").filter({ visible: true });
  await expect(picker).toBeVisible({ timeout: 10_000 });
  if (dir) {
    await picker.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(dir, "playtest-final-point-375.png"),
      animations: "disabled",
    });
  }
  await picker.click();
  await expect(game.getByText("Switch View as to a player who can act.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(form).toBeVisible();
});

test("mobile regular point playtest uses the gameplay picker", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 375, height: 900 });
  const form = page.getByTestId("question-dialog");
  await form.locator("#qf-answer-type").selectOption("point");
  await form.getByTestId("point-picker").click();
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const game = page.getByTestId("question-playtest");
  await expect(game).toBeVisible();
  const controls = game.getByRole("group", { name: "Simulation controls" });
  const next = controls.getByRole("button", { name: "Continue", exact: true });
  await expect(game.getByTestId("question-text")).toHaveText("Name this artwork");
  await next.click();
  await expect(game.getByTestId("content-stage").locator("img")).toBeVisible();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(game.getByTestId("dock-status")).toHaveText("Buzzer is open");
  await game.getByTestId("buzz").click();
  const picker = game.getByTestId("point-picker").filter({ visible: true });
  await expect(picker).toBeVisible();
  const dir = process.env.OQ_MEDIA_SCREENSHOTS;
  if (dir) {
    await picker.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(dir, "playtest-point-375.png"), animations: "disabled" });
  }
  await picker.click();
  await expect(game.getByTestId("answer-reveal")).toBeVisible();
});

test("playtest pauses parent media, isolates volume, and releases its own media on close", async ({
  page,
}) => {
  const source = await seed(page);
  await page.goto("/");
  const videoBytes = [...readFileSync("e2e/fixtures/clip.webm")];
  await page.evaluate(
    async ({ id, videoBytes }) => {
      const d = "/src/features/package-editor/draftStorage.ts",
        a = "/src/features/upload/archive.ts";
      const { loadDraft, saveDraft } = (await import(d)) as typeof Drafts;
      const { md5Hex } = (await import(a)) as typeof Archive;
      const draft = (await loadDraft(id))!;
      const bytes = new Uint8Array(videoBytes),
        md5 = md5Hex(bytes);
      draft.pkg.rounds[0]!.themes[0]!.questions[0]!.questionFiles = [
        { md5, type: "video", displayTime: null },
      ];
      await saveDraft(draft, [{ md5, type: "video", name: `${md5}.webm`, bytes }]);
    },
    { id: source.id, videoBytes },
  );
  await page.goto(`/packages/editor/${source.id}`);
  await page.getByTestId("question-card").first().press("Control+Enter");
  const form = page.getByTestId("question-dialog"),
    parentVideo = form.locator("video").first();
  await form.getByRole("button", { name: "Play", exact: true }).first().click();
  await expect.poll(() => parentVideo.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
  const settingsBefore = await page.evaluate(() => localStorage.getItem("oq.settings"));
  await page.evaluate(() => {
    const state = window as Window & { playtestUrls?: { created: string[]; revoked: string[] } };
    state.playtestUrls = { created: [], revoked: [] };
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      state.playtestUrls!.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      state.playtestUrls!.revoked.push(url);
      revoke(url);
    };
  });
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const game = page.getByTestId("question-playtest");
  await expect(game).toBeVisible();
  await expect.poll(() => parentVideo.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  const video = game.getByTestId("media-video"),
    handle = await video.elementHandle();
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0.1);
  await game.getByRole("slider", { name: "Volume" }).fill("25");
  expect(await page.evaluate(() => localStorage.getItem("oq.settings"))).toBe(settingsBefore);
  await game.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  await game.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
  await game.getByRole("button", { name: "Restart", exact: true }).click();
  expect(await handle!.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  await page.keyboard.press("Escape");
  const urls = await page.evaluate(
    () =>
      (window as Window & { playtestUrls?: { created: string[]; revoked: string[] } })
        .playtestUrls!,
  );
  expect(urls.created.length).toBeGreaterThan(0);
  expect(urls.created.every((url) => urls.revoked.includes(url))).toBe(true);
  await expect(form.getByRole("button", { name: "Preview", exact: true })).toBeFocused();
});

test("playtest keyboard input and invalid-field return stay inside the editor", async ({
  page,
}) => {
  await seed(page);
  const form = page.getByTestId("question-dialog");
  await form.locator("#qf-answer-type").selectOption("number");
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Interactive game preview" });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Return to editing" }).focus();
  await page.keyboard.press("Enter");
  await expect(form.locator("#qf-number")).toBeFocused();
  await form.locator("#qf-number").fill("42");
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const game = page.getByTestId("question-playtest");
  await expect(game).toBeVisible();
  const next = game
    .getByRole("group", { name: "Simulation controls" })
    .getByRole("button", { name: "Continue", exact: true });
  await expect(game.getByTestId("question-text")).toHaveText("Name this artwork");
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(game.getByTestId("content-stage").locator("img")).toBeVisible();
  await page.keyboard.press("Control+Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(form.locator("#qf-number")).toHaveValue("42");
});

test("remote download failure does not replace a published attachment", async ({ page }) => {
  await page.route("**/source-image", (r) => r.fulfill({ status: 503, body: "Unavailable" }));
  const source = await seed(page, false, true);
  await page
    .getByTestId("question-dialog")
    .getByRole("button", { name: "Edit", exact: true })
    .first()
    .click();
  const editor = page.getByTestId("media-editor");
  await expect(editor.getByRole("alert")).toContainText("could not be loaded");
  await editor.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("could not be loaded");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await readDraft(page, source.id)).questions[0]!.questionFiles[0]!.md5).toBe(source.md5);
});

test("drawing tools, blur, local undo and archive re-import retain the accepted composition", async ({
  page,
}) => {
  const source = await seed(page);
  const form = page.getByTestId("question-dialog");
  await form.getByRole("button", { name: "Edit", exact: true }).first().click();
  const editor = page.getByTestId("media-editor"),
    canvas = editor.locator("canvas");
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  const select = editor.getByRole("button", { name: "Select / move", exact: true });
  const orangePixels = () =>
    canvas.evaluate((el: HTMLCanvasElement) => {
      const data = el.getContext("2d")!.getImageData(0, 0, el.width, el.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4)
        if (
          data[i]! > 245 &&
          data[i + 1]! > 90 &&
          data[i + 1]! < 230 &&
          data[i + 2]! < 130 &&
          data[i + 3]! > 200
        )
          count++;
      return count;
    });
  await expect(editor.getByLabel("Drawing color")).toHaveCount(0);
  await expect(editor.getByLabel("Stroke width")).toHaveCount(0);
  await editor.getByRole("heading", { name: "Edit media", exact: true }).focus();
  await page.keyboard.press("1");
  await expect(select).toBeFocused();
  await editor.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("2");
  await expect(editor.getByRole("button", { name: "Crop", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(editor.getByRole("button", { name: "Crop", exact: true })).toBeFocused();
  await page.keyboard.press("1");
  await expect(select).toHaveAttribute("aria-pressed", "true");
  await expect(select).toBeFocused();
  for (const [i, tool] of ["Pen", "Arrow", "Rectangle", "Text", "Blur area"].entries()) {
    const button = editor.getByRole("button", { name: tool, exact: true });
    await expect(button.locator("kbd")).toHaveText(String(i + 3));
    await expect(button).toHaveAttribute("aria-keyshortcuts", String(i + 3));
    await canvas.press(String(i + 3));
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toBeFocused();
    if (tool === "Text") {
      await editor.getByLabel("Text", { exact: true }).pressSequentially("1234567");
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(editor.getByLabel("Text", { exact: true })).toHaveValue("1234567");
    }
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * (0.2 + i * 0.1));
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * (0.3 + i * 0.1), {
      steps: 5,
    });
    await expect.poll(orangePixels).toBe(0);
    await page.mouse.up();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(editor.getByLabel("Selected annotation").locator("option:checked")).toHaveText(
      `${i + 1}. ${tool}`,
    );
    await expect.poll(orangePixels).toBeGreaterThan(0);
  }
  await canvas.click({ position: { x: 4, y: 4 } });
  await expect(editor.getByLabel("Drawing color")).toHaveCount(0);
  await expect(editor.getByLabel("Stroke width")).toHaveCount(0);
  await expect(editor.getByLabel("Selected annotation").locator("option")).toHaveCount(6);
  await editor.getByRole("button", { name: "Undo media change" }).click();
  await expect(editor.getByLabel("Selected annotation").locator("option")).toHaveCount(5);
  await editor.getByRole("button", { name: "Redo", exact: true }).click();
  await editor.getByLabel("Whole-image blur", { exact: false }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(editor.getByTestId("media-save")).toBeEnabled({ timeout: 30000 });
  await screenshots(page, "drawing");
  await editor.getByTestId("media-save").click();
  await page.getByTestId("question-save").click();
  await expect
    .poll(async () => (await readDraft(page, source.id)).files[0]!.md5)
    .not.toBe(source.md5);
  const archive = await page.evaluate(async (id) => {
    const d = "/src/features/package-editor/draftStorage.ts",
      m = "/src/features/package-editor/packageMedia.ts",
      a = "/src/features/upload/archive.ts",
      o = "/src/features/upload/oq.ts";
    const { loadDraft, loadMedia } = (await import(d)) as typeof Drafts;
    const { exportOq } = (await import(m)) as typeof Media;
    const { readZip, md5Hex } = (await import(a)) as typeof Archive;
    const { parseOq } = (await import(o)) as typeof Oq;
    const draft = (await loadDraft(id))!,
      hash = draft.pkg.rounds[0]!.themes[0]!.questions[0]!.questionFiles[0]!.md5;
    const files = await loadMedia([hash]),
      exported = await exportOq(draft.pkg, files);
    const parsed = await parseOq(await readZip(new Uint8Array(await exported.arrayBuffer())));
    const bitmap = await createImageBitmap(new Blob([parsed.files.get(hash)!.bytes as BlobPart]));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
      ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i]! > 170 && pixels[i + 1]! < 140 && pixels[i + 2]! < 140) red++;
    return { hash, imported: md5Hex(parsed.files.get(hash)!.bytes), red };
  }, source.id);
  expect(archive.imported).toBe(archive.hash);
  expect(archive.red).toBeGreaterThan(100);
});

test("aborted encodes reject and the same source can immediately be retried", async ({ page }) => {
  const source = await seed(page);
  const result = await page.evaluate(async ({ bytes, md5 }) => {
    const p = "/src/features/package-editor/media-editor/processMedia.ts",
      m = "/src/features/package-editor/media-editor/mediaEdits.ts";
    const { encodeEditedImage } = (await import(p)) as typeof Process;
    const { initialImageEdits } = (await import(m)) as typeof Edits;
    const file = { md5, type: "image" as const, name: "image.png", bytes: new Uint8Array(bytes) };
    const edits = { ...initialImageEdits(), rotation: 90 },
      controller = new AbortController();
    const job = encodeEditedImage(file, "image/png", edits, controller.signal).then(
      () => "wrong-success",
      (e: Error) => e.name,
    );
    controller.abort();
    const error = await job,
      retried = await encodeEditedImage(file, "image/png", edits, new AbortController().signal);
    return { error, hash: retried.md5 };
  }, source);
  expect(result.error).toBe("AbortError");
  expect(result.hash).not.toBe(source.md5);
});

test("choice images and logos use their owning form's save and discard behavior", async ({
  page,
}) => {
  const source = await seed(page);
  const form = page.getByTestId("question-dialog"),
    editor = page.getByTestId("media-editor");
  await form.getByRole("button", { name: /^Choice/ }).click();
  const option = form.getByRole("button", { name: "Option A image", exact: true }).locator("..");
  await option.locator('input[type="file"]').setInputFiles({
    name: "choice.png",
    mimeType: "image/png",
    buffer: Buffer.from(source.bytes),
  });
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  await editor.getByRole("button", { name: "Rotate right", exact: true }).click();
  await expect(editor.getByTestId("media-save")).toBeEnabled({ timeout: 30000 });
  await editor.getByTestId("media-save").click();
  await expect(option.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.getByTestId("question-save").click();
  await expect
    .poll(async () => (await readDraft(page, source.id)).questions[0]!.options[0]?.file?.md5)
    .not.toBeUndefined();
  const choiceHash = (await readDraft(page, source.id)).questions[0]!.options[0]!.file!.md5;
  expect(choiceHash).not.toBe(source.md5);
  await page
    .getByTestId("outline")
    .getByRole("button", { name: "Package details", exact: true })
    .click();
  const details = page.getByRole("dialog");
  await details
    .locator('input[type="file"]')
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(source.bytes) });
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  await editor.getByTestId("media-save").click();
  await details.getByRole("button", { name: "Cancel", exact: true }).click();
  await details.getByRole("button", { name: "Discard changes", exact: true }).click();
  const logo = await page.evaluate(async (id) => {
    const d = "/src/features/package-editor/draftStorage.ts";
    return (await ((await import(d)) as typeof Drafts).loadDraft(id))!.pkg.logo;
  }, source.id);
  expect(logo).toBeNull();
  await page
    .getByTestId("outline")
    .getByRole("button", { name: "Package details", exact: true })
    .click();
  await details
    .locator('input[type="file"]')
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(source.bytes) });
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  await editor.getByTestId("media-save").click();
  await details.getByRole("button", { name: "Save package details" }).click();
  await expect(details).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const d = "/src/features/package-editor/draftStorage.ts";
        return (await ((await import(d)) as typeof Drafts).loadDraft(id))!.pkg.logo?.md5;
      }, source.id),
    )
    .toBe(source.md5);
});

test("desktop controls fit, zoom changes scale, and rotated crop survives export", async ({
  page,
}) => {
  const source = await seed(page);
  await page.setViewportSize({ width: 1864, height: 884 });
  const form = page.getByTestId("question-dialog");
  await form.locator("#qf-answer-type").selectOption("point");
  await form.getByTestId("point-picker").press("Enter");
  await form.getByRole("button", { name: "Edit", exact: true }).first().click();
  const editor = page.getByTestId("media-editor"),
    canvas = editor.locator("canvas");
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  await expectNoEditorScroll(page);
  expect((await editor.locator("aside").boundingBox())!.width).toBe(288);
  const left = (await editor
    .getByRole("button", { name: "Rotate left", exact: true })
    .boundingBox())!;
  const right = (await editor
    .getByRole("button", { name: "Rotate right", exact: true })
    .boundingBox())!;
  expect(left.y).toBe(right.y);
  const initial = (await canvas.boundingBox())!;
  await editor.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect((await canvas.boundingBox())!.width).toBeCloseTo(initial.width * 1.25, 0);
  await editor.getByRole("button", { name: "Zoom out", exact: true }).click();
  expect((await canvas.boundingBox())!.width).toBeCloseTo(initial.width, 0);
  await editor.getByRole("button", { name: "Fit to preview", exact: true }).click();
  await editor.getByRole("button", { name: "Rotate right", exact: true }).click();
  await editor.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Control+z");
  await expect.poll(() => canvas.getAttribute("width")).toBe("400");
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => canvas.getAttribute("width")).toBe("240");
  expect(await editor.getByRole("button", { name: "Undo media change" }).innerText()).toBe("");
  await editor.getByRole("button", { name: "Crop", exact: true }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7, { steps: 4 });
  await page.mouse.up();
  await expect(editor.getByTestId("media-save")).toBeDisabled();
  await expect(editor.getByLabel("Left (%)")).toHaveValue("10");
  await expect(editor.getByLabel("Width (%)")).toHaveValue("60");
  await screenshots(page, "crop-selection");
  await page.setViewportSize({ width: 1864, height: 884 });
  await editor.getByRole("button", { name: "Apply crop", exact: true }).click();
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  await expect(canvas).toHaveAttribute("width", "144");
  await expect(canvas).toHaveAttribute("height", "240");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused();
  await expect(editor.locator("footer")).toContainText("Discard this media edit?");
  await screenshots(page, "discard-confirmation");
  await editor.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await editor.getByTestId("media-save").click();
  await expect(form.getByTestId("point-target")).toHaveCount(0);
  await page.getByTestId("question-save").click();
  await expect
    .poll(async () => (await readDraft(page, source.id)).files[0]!.md5)
    .not.toBe(source.md5);
  const cropped = await page.evaluate(
    async ({ id, originalBytes }) => {
      const d = "/src/features/package-editor/draftStorage.ts",
        m = "/src/features/package-editor/packageMedia.ts",
        a = "/src/features/upload/archive.ts",
        o = "/src/features/upload/oq.ts";
      const { loadDraft, loadMedia } = (await import(d)) as typeof Drafts;
      const { exportOq } = (await import(m)) as typeof Media;
      const { readZip, md5Hex } = (await import(a)) as typeof Archive;
      const { parseOq } = (await import(o)) as typeof Oq;
      const draft = (await loadDraft(id))!,
        hash = draft.pkg.rounds[0]!.themes[0]!.questions[0]!.questionFiles[0]!.md5;
      const archive = await exportOq(draft.pkg, await loadMedia([hash]));
      const parsed = await parseOq(await readZip(new Uint8Array(await archive.arrayBuffer())));
      const bytes = parsed.files.get(hash)!.bytes,
        image = await createImageBitmap(new Blob([bytes as BlobPart]));
      const canvas = new OffscreenCanvas(image.width, image.height),
        ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      image.close();
      const original = await createImageBitmap(new Blob([new Uint8Array(originalBytes)]));
      const reference = new OffscreenCanvas(original.width, original.height),
        sourceContext = reference.getContext("2d")!;
      sourceContext.drawImage(original, 0, 0);
      original.close();
      return {
        size: [canvas.width, canvas.height],
        alpha: ctx.getImageData(72, 120, 1, 1).data[3],
        hash,
        imported: md5Hex(bytes),
        pixel: [...ctx.getImageData(14, 24, 1, 1).data],
        // Crop (10%,20%,60%,60%), rotated clockwise: output (14,24) maps to source (64,177).
        expectedPixel: [...sourceContext.getImageData(64, 177, 1, 1).data],
      };
    },
    { id: source.id, originalBytes: source.bytes },
  );
  expect(cropped.size).toEqual([144, 240]);
  expect(cropped.alpha).toBe(255);
  expect(cropped.hash).toBe(cropped.imported);
  for (let i = 0; i < 4; i++)
    expect(Math.abs(cropped.pixel[i]! - cropped.expectedPixel[i]!)).toBeLessThan(12);
});

test("fade lengths share the whole fragment and the edited fade has priority", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1864, height: 884 });
  await page
    .getByTestId("question-dialog")
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "sound.wav", mimeType: "audio/wav", buffer: tone() });
  const editor = page.getByTestId("media-editor");
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  await expect(editor.getByRole("checkbox")).toHaveCount(0);
  const envelope = editor.getByTestId("fade-envelope");
  await expect(envelope).toHaveCount(0);
  await editor.getByLabel("End time (min:sec)").fill("0:03.41");
  await editor.getByLabel("Fade-in duration in seconds").fill("0.5");
  await editor.getByLabel("Fade-out duration in seconds").fill("0.5");
  const fadeIn = editor.getByLabel("Fade-in duration in seconds"),
    fadeOut = editor.getByLabel("Fade-out duration in seconds");
  await fadeOut.fill("0");
  await fadeOut.pressSequentially(".25");
  await expect(fadeOut).toHaveValue("0.25");
  await fadeOut.fill("0.5");
  await fadeOut.blur();
  await fadeIn.fill("3");
  await fadeIn.blur();
  await expect(fadeOut).toHaveValue("0.41");
  await expect(envelope).toBeVisible();
  const points = (await envelope.locator("polyline").getAttribute("points"))!
    .split(" ")
    .map((p) => p.split(",").map(Number));
  expect(points[0]).toEqual([0, 90]);
  expect(points.at(-1)![0]).toBeCloseTo(3.41);
  expect(points.at(-1)![1]).toBe(90);
  expect(points.some(([at, y]) => Math.abs(at! - 3) < 0.001 && y === 10)).toBe(true);
  await fadeOut.fill("2.9");
  await fadeOut.blur();
  await expect(fadeIn).toHaveValue("0.51");
  await fadeIn.fill("3.41");
  await fadeIn.blur();
  await expect(fadeOut).toHaveValue("0");
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  await editor.getByLabel("Fade-out duration in seconds").fill("0.5");
  await expect(fadeIn).toHaveValue("2.91");
  await expectNoEditorScroll(page);
  await page.evaluate(() => {
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      override createGain() {
        const gain = super.createGain();
        (window as unknown as { testFadeGain: GainNode }).testFadeGain = gain;
        return gain;
      }
    };
  });
  await editor.getByRole("button", { name: "Play preview" }).click();
  await expect
    .poll(() => editor.locator("audio").evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.1);
  await editor.getByRole("button", { name: "Pause preview" }).click();
  await editor.locator("audio").evaluate(async (el: HTMLAudioElement) => {
    const seeked = new Promise<void>((r) =>
      el.addEventListener("seeked", () => r(), { once: true }),
    );
    el.currentTime = 1;
    await seeked;
  });
  const gain = () =>
    page.evaluate(() => (window as unknown as { testFadeGain: GainNode }).testFadeGain.gain.value);
  await expect.poll(gain).toBeCloseTo(1 / 2.91, 3);
  await fadeIn.fill("3.41");
  await fadeIn.blur();
  await expect.poll(gain).toBeCloseTo(1 / 3.41, 3);
  await editor.getByLabel("Start time (min:sec)").fill("0:00.50");
  await editor.getByLabel("Start time (min:sec)").blur();
  await expect.poll(gain).toBeCloseTo(0.5 / 2.91, 3);
  await editor.getByLabel("Fade-out duration in seconds").fill("0.5");
  await screenshots(page, "full-fade");
  await fadeIn.fill("0");
  await fadeOut.fill("0");
  await expect(envelope).toHaveCount(0);
});

test("EXIF orientation is respected, and SVG stays unchanged", async ({ page }) => {
  const source = await seed(page);
  const dimensions = await page.evaluate(async () => {
    const p = "/src/features/package-editor/media-editor/processMedia.ts",
      m = "/src/features/package-editor/media-editor/mediaEdits.ts";
    const { encodeEditedImage } = (await import(p)) as typeof Process;
    const { initialImageEdits } = (await import(m)) as typeof Edits;
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 50;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 100, 50);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg")),
      jpeg = new Uint8Array(await blob.arrayBuffer());
    const exif = new Uint8Array([
      255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0,
      0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const bytes = new Uint8Array(jpeg.length + exif.length);
    bytes.set(jpeg.subarray(0, 2));
    bytes.set(exif, 2);
    bytes.set(jpeg.subarray(2), 2 + exif.length);
    const out = await encodeEditedImage(
      { md5: "exif", type: "image", name: "oriented.jpg", bytes },
      "image/jpeg",
      { ...initialImageEdits(), qualityChanged: true },
      new AbortController().signal,
    );
    const bitmap = await createImageBitmap(new Blob([out.bytes as BlobPart]));
    const size = [bitmap.width, bitmap.height];
    bitmap.close();
    return size;
  });
  expect(dimensions).toEqual([50, 100]);
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>',
  );
  await page
    .getByTestId("question-dialog")
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "vector.svg", mimeType: "image/svg+xml", buffer: svg });
  const editor = page.getByTestId("media-editor");
  await expect(editor).toContainText("Animated images and SVG are kept unchanged");
  await expect(editor.getByTestId("media-save")).toBeDisabled();
  await editor.getByRole("button", { name: "Use unchanged" }).click();
  await page.getByTestId("question-save").click();
  await expect.poll(async () => (await readDraft(page, source.id)).files.length).toBe(2);
  expect(
    (await readDraft(page, source.id)).files.some((f) => Buffer.from(f.bytes).equals(svg)),
  ).toBe(true);
});

for (const kind of ["audio", "video"] as const) {
  test(
    kind + " timeline seeks, resumes and cuts on either side without empty selections",
    async ({ page }) => {
      const source = await seed(page);
      await page.setViewportSize({ width: 1625, height: 884 });
      await page
        .getByTestId("question-dialog")
        .locator('input[type="file"]')
        .first()
        .setInputFiles(
          kind === "audio"
            ? { name: "sound.wav", mimeType: "audio/wav", buffer: tone() }
            : {
                name: "video.webm",
                mimeType: "video/webm",
                buffer: readFileSync("e2e/fixtures/clip.webm"),
              },
        );
      const editor = page.getByTestId("media-editor"),
        timeline = editor.getByTestId("media-timeline");
      const left = editor.getByRole("button", { name: "Trim everything left of the playhead" });
      const right = editor.getByRole("button", { name: "Trim everything right of the playhead" });
      const start = editor.getByLabel("Start time (min:sec)"),
        end = editor.getByLabel("End time (min:sec)");
      const player = editor.locator(kind),
        position = () => player.evaluate((el: HTMLMediaElement) => el.currentTime);
      await expect(editor.getByTestId("media-save")).toBeEnabled();
      await expect(editor.locator('input[type="range"]')).toHaveCount(0);
      await expect(editor.getByRole("slider")).toHaveCount(1);
      if (kind === "video") {
        const mute = editor.getByRole("button", { name: "Remove audio", exact: true });
        await expect(editor.getByRole("checkbox")).toHaveCount(0);
        await expect(mute).toHaveAttribute("aria-pressed", "false");
        await mute.click();
        await expect(mute).toHaveAttribute("aria-pressed", "true");
        await expect(player).toHaveJSProperty("muted", true);
        await expect(mute).toHaveAttribute("title", "Restore audio");
        await editor.getByRole("button", { name: "Undo media change" }).click();
        await expect(player).toHaveJSProperty("muted", false);
      }
      if (kind === "audio") {
        await expect(editor.getByRole("img", { name: "Audio waveform" })).toHaveCount(1);
        expect((await timeline.boundingBox())!.height).toBeLessThanOrEqual(160);
      }
      const duration = Number(await timeline.getAttribute("aria-valuemax"));
      const seekFraction = async (fraction: number) => {
        const box = (await timeline.boundingBox())!;
        await timeline.click({ position: { x: box.width * fraction, y: box.height / 2 } });
        await expect.poll(position).toBeCloseTo(duration * fraction, 1);
      };
      await expect(left).toBeDisabled();
      await expect(right).toBeDisabled();
      await seekFraction(0.25);
      await left.click();
      await expect(start).not.toHaveValue("0:00.00");
      await expect(right).toBeDisabled(); // start and end cannot share the cursor.
      const previousStart = await start.inputValue();
      await seekFraction(0.75);
      await right.click();
      await expect(left).toBeDisabled();
      const previousEnd = await end.inputValue();
      await editor.getByRole("button", { name: "Undo media change" }).click();
      await expect(end).not.toHaveValue(previousEnd);
      await editor.getByRole("button", { name: "Redo", exact: true }).click();
      await expect(end).toHaveValue(previousEnd);
      await seekFraction(0.5);
      const from = await position();
      const play = editor.getByRole("button", { name: "Play preview", exact: true });
      expect(await play.innerText()).toBe("");
      await play.click();
      await expect.poll(position).toBeGreaterThan(from + 0.05);
      await editor.getByRole("button", { name: "Pause preview", exact: true }).click();
      const paused = await position();
      await timeline.focus();
      await timeline.press("Space");
      await expect.poll(position).toBeGreaterThan(paused);
      await timeline.press("Space");
      await expect(player).toHaveJSProperty("paused", true);
      // Both excluded regions stay seekable, allowing a cut to be extended again.
      await timeline.press("Home");
      await expect.poll(position).toBe(0);
      await left.click();
      await expect(start).toHaveValue("0:00.00");
      await timeline.press("End");
      await expect.poll(position).toBeCloseTo(duration, 5);
      await right.click();
      await expect(end).not.toHaveValue(previousEnd);
      await timeline.press("Home");
      await timeline.press("ArrowRight");
      await expect.poll(position).toBeCloseTo(0.1, 2);
      await timeline.press("Shift+ArrowRight");
      await expect.poll(position).toBeCloseTo(1.1, 2);
      const box = (await timeline.boundingBox())!;
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 6 });
      await page.mouse.up();
      await expect.poll(position).toBeCloseTo(duration * 0.6, 1);
      await right.click();
      await expect(end).not.toHaveValue(previousEnd);
      await expect(start).not.toHaveValue(previousStart);
      await expect(editor.getByTestId("media-save")).toBeEnabled();
      await expectNoEditorScroll(page);
      await screenshots(page, kind + "-timeline");
      // Play from a cursor beyond the retained interval restarts at its beginning and stops at its end.
      await timeline.press("End");
      await play.click();
      await expect.poll(position).toBeLessThan(duration * 0.6);
      await expect(player).toHaveJSProperty("paused", true, { timeout: 10000 });
      await expect.poll(position).toBeCloseTo(Math.round(duration * 0.6 * 100) / 100, 2);
      if (kind === "video") {
        await editor.getByRole("button", { name: "Remove audio", exact: true }).click();
        await screenshots(page, "video-muted");
        await editor.getByTestId("media-save").click();
        await page.getByTestId("question-save").click();
        await expect.poll(async () => (await readDraft(page, source.id)).files.length).toBe(2);
        const output = (await readDraft(page, source.id)).files.find((f) => f.type === "video")!;
        const hasAudio = await page.evaluate(async (bytes) => {
          const b = "/browser-tests/mediabunny.ts";
          const { Input, ALL_FORMATS, BlobSource } = (await import(b)) as typeof Bunny;
          const input = new Input({
            formats: ALL_FORMATS,
            source: new BlobSource(new Blob([new Uint8Array(bytes)])),
          });
          const audio = await input.getPrimaryAudioTrack();
          input.dispose();
          return !!audio;
        }, output.bytes);
        expect(hasAudio).toBe(false);
      }
    },
  );
}

test("degree input keeps crop, drawing and transparent export aligned at arbitrary angles", async ({
  page,
}) => {
  const source = await seed(page);
  await page.setViewportSize({ width: 1625, height: 884 });
  await page
    .getByTestId("question-dialog")
    .getByRole("button", { name: "Edit", exact: true })
    .first()
    .click();
  const editor = page.getByTestId("media-editor"),
    canvas = editor.locator("canvas");
  const rotation = editor.getByLabel("Rotation (degrees)");
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  await rotation.fill("12.5");
  await rotation.blur();
  await expect(editor.getByRole("button", { name: "Select / move", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await rotation.fill("-45");
  await editor.getByRole("button", { name: "Rotate right", exact: true }).click();
  await expect(rotation).toHaveValue("45");
  await editor.getByRole("button", { name: "Rotate left", exact: true }).click();
  await expect(rotation).toHaveValue("-45");
  await rotation.fill("45");
  await rotation.blur();
  await canvas.press("2");
  for (const [label, value] of [
    ["Left (%)", "25"],
    ["Top (%)", "25"],
    ["Width (%)", "50"],
    ["Height (%)", "50"],
  ])
    await editor.getByLabel(label!).fill(value!);
  await editor.getByRole("button", { name: "Apply crop", exact: true }).click();
  await expect(canvas).toHaveAttribute("width", "226");
  await expect(canvas).toHaveAttribute("height", "226");
  await canvas.press("3");
  // Empty corners introduced by rotation must not place marks on the image edge.
  await canvas.click({ position: { x: 4, y: 4 } });
  await expect(editor.getByLabel("Selected annotation")).toHaveCount(0);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 5 });
  await page.mouse.up();
  await expect(editor.getByTestId("media-save")).toBeEnabled();
  await screenshots(page, "free-rotation");
  await editor.getByTestId("media-save").click();
  await page.getByTestId("question-save").click();
  await expect
    .poll(async () => (await readDraft(page, source.id)).files[0]!.md5)
    .not.toBe(source.md5);
  const output = (await readDraft(page, source.id)).files[0]!;
  const pixels = await page.evaluate(async (bytes) => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
    const canvas = new OffscreenCanvas(image.width, image.height),
      ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    image.close();
    return {
      size: [canvas.width, canvas.height],
      corners: [
        [3, 3],
        [222, 3],
        [3, 222],
        [222, 222],
      ].map(([x, y]) => ctx.getImageData(x!, y!, 1, 1).data[3]),
      center: [...ctx.getImageData(113, 113, 1, 1).data],
      background: ctx.getImageData(113, 90, 1, 1).data[3],
    };
  }, output.bytes);
  expect(pixels.size).toEqual([226, 226]);
  expect(pixels.corners).toEqual([0, 0, 0, 0]);
  expect(pixels.center[0]).toBeGreaterThan(170);
  expect(pixels.center[1]).toBeLessThan(130);
  expect(pixels.center[3]).toBe(255);
  expect(pixels.background).toBe(255);
});

test("picture target stays circular and clicks match the displayed image across aspect ratios", async ({
  page,
}) => {
  for (const [shape, width, height] of [
    ["landscape", 900, 300],
    ["portrait", 180, 900],
    ["square", 400, 400],
  ] as const) {
    await seed(page, false, false, { width, height });
    const form = page.getByTestId("question-dialog");
    await form.locator("#qf-answer-type").selectOption("point");
    await form.locator("#qf-radius").fill("7");
    const picker = form.getByTestId("point-picker"),
      target = form.getByTestId("point-target");
    const settingsInput = form.locator("#qf-radius");
    const originalPicker = await picker.elementHandle();
    for (const [device, w, h] of [
      ["desktop", 1625, 884],
      ["tablet", 820, 1180],
      ["phone", 375, 812],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await picker.scrollIntoViewIfNeeded();
      expect(
        await picker.evaluate((element, original) => element === original, originalPicker),
      ).toBe(true);
      await expect(settingsInput).toHaveValue("7");
      const image = picker.locator("img");
      await expect
        .poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
        .toBe(true);
      const bounds = (await image.boundingBox())!,
        container = (await picker.boundingBox())!;
      expect(container.width).toBeCloseTo(bounds.width, 0);
      expect(container.height).toBeCloseTo(bounds.height, 0);
      await picker.click({ position: { x: bounds.width * 0.62, y: bounds.height * 0.4 } });
      const circle = (await target.boundingBox())!;
      expect(circle.width).toBeCloseTo(circle.height, 1);
      expect(circle.width).toBeCloseTo(Math.max(bounds.width, bounds.height) * 0.084, 0);
      // Native mouse events round their client coordinates to whole CSS pixels.
      expect(Math.abs(circle.x + circle.width / 2 - (bounds.x + bounds.width * 0.62))).toBeLessThan(
        1,
      );
      expect(
        Math.abs(circle.y + circle.height / 2 - (bounds.y + bounds.height * 0.4)),
      ).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      const dir = process.env.OQ_MEDIA_SCREENSHOTS;
      if (dir) {
        mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: join(dir, "point-" + shape + "-" + device + ".png") });
      }
    }
  }
});

test("point radius reaches 60 percent of the larger image dimension", async ({ page }) => {
  await seed(page, false, false, { width: 400, height: 240 });
  const form = page.getByTestId("question-dialog");
  await form.getByLabel("How players answer").selectOption("point");
  await form.getByTestId("point-picker").click();
  const slider = form.getByRole("slider", { name: "Answer radius" });
  await expect(slider).toBeEnabled();
  await slider.fill("100");
  await expect(form.getByText("100% · 240 px radius")).toBeVisible();
  const dir = process.env.OQ_MEDIA_SCREENSHOTS;
  for (const width of [375, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await form.getByText("100% · 240 px radius").scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    if (dir) {
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, `point-radius-${width}.png`) });
    }
  }
});

test("secret playtest starts its media sequence after transfer", async ({ page }) => {
  const { id } = await seed(page);
  await page.goto("/");
  await page.evaluate(
    async ({ id, video }) => {
      const path = "/src/features/package-editor/draftStorage.ts";
      const { loadDraft, saveDraft } = (await import(path)) as typeof Drafts;
      const draft = (await loadDraft(id))!;
      const question = draft.pkg.rounds[0]!.themes[0]!.questions[0]!;
      question.type = "secret";
      const file = question.questionFiles[0]!;
      const archivePath = "/src/features/upload/archive.ts";
      const { md5Hex } = (await import(archivePath)) as typeof Archive;
      const bytes = new Uint8Array(video);
      const md5 = md5Hex(bytes);
      question.questionFiles = [
        ...Array.from({ length: 2 }, () => ({ ...file, displayTime: 3000, waitForFinish: true })),
        { md5, type: "video", displayTime: null, waitForFinish: true },
      ];
      await saveDraft(draft, [{ md5, type: "video", name: "clip.webm", bytes }]);
    },
    { id, video: [...readFileSync("e2e/fixtures/clip.webm")] },
  );
  await page.goto(`/packages/editor/${id}`);
  await page.getByTestId("question-card").first().press("Control+Enter");
  await page
    .getByTestId("question-dialog")
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  const game = page.getByTestId("question-playtest");
  await game.getByRole("radio", { name: /Player 2/ }).click();
  await game.getByTestId("secret-give").click();
  await expect(game.getByText("Part 1 of 4")).toBeVisible();
  await expect(game.getByTestId("question-text")).toHaveText("Name this artwork");
  await expect(game.getByText("Part 2 of 4")).toBeVisible({ timeout: 6000 });
  await expect(game.getByTestId("content-stage").locator("img")).toBeVisible();
  await expect(game.getByText("Part 3 of 4")).toBeVisible({ timeout: 6000 });
  await expect(game.getByTestId("content-stage").locator("img")).toBeVisible();
  await expect(game.getByText("Part 4 of 4")).toBeVisible({ timeout: 6000 });
  await expect
    .poll(() =>
      game.getByTestId("media-video").evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(0);
});

test("all-play preview waits for real stakes then starts the question automatically", async ({
  page,
}) => {
  await seed(page);
  const form = page.getByTestId("question-dialog");
  await form.getByRole("button", { name: /^Stake / }).click();
  await form.getByLabel("Everyone bids and answers").check();
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const game = page.getByTestId("question-playtest");
  const controls = game.getByRole("group", { name: "Simulation controls" });
  const view = controls.getByLabel("View as");
  await expect(game.getByTestId("dock-phase")).toHaveText("Everyone · stakes");
  for (const player of ["Player 1", "Player 2", "Player 3"]) {
    await view.selectOption({ label: player });
    await game.getByTestId("bid-submit").click();
  }
  await expect(game.getByTestId("question-text")).toHaveText("Name this artwork");
  await expect(game.getByTestId("dock-phase")).toHaveText("Everyone answers");
});

test("no-risk all-play preview starts without Continue", async ({ page }) => {
  await seed(page);
  const form = page.getByTestId("question-dialog");
  await form.getByRole("button", { name: /^No risk / }).click();
  await form.getByLabel("Everyone plays it").check();
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const game = page.getByTestId("question-playtest");
  await expect(game.getByTestId("question-text")).toHaveText("Name this artwork");
  await expect(game.getByTestId("dock-phase")).toHaveText("Everyone answers");
});
