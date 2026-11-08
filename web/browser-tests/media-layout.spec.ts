import { expect, test, type Page } from "@playwright/test";
import type * as Fixture from "./media-layout.fixture";

const fixturePath = "/browser-tests/media-layout.fixture.tsx";

async function mount(
  page: Page,
  name: keyof typeof Fixture.layouts,
  width: number,
  height: number,
) {
  await page.setViewportSize({ width, height });
  await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(
    async ({ name, fixturePath, width }) => {
      ((await import(fixturePath)) as typeof Fixture).mountMediaLayout(name);
      const settingsPath = "/src/features/settings/settingsStore.ts";
      (await import(settingsPath)).useSettings
        .getState()
        .update({ theme: width < 700 ? "daylight" : "midnight" });
      await document.fonts.ready;
    },
    { name, fixturePath, width },
  );
}

async function seek(page: Page, elapsedMs?: number) {
  await page.evaluate(
    async ({ elapsedMs, fixturePath }) => {
      ((await import(fixturePath)) as typeof Fixture).seekMediaLayout(elapsedMs);
    },
    { elapsedMs, fixturePath },
  );
}

const cases = [
  ["audio-caption", 1, 0],
  ["background-caption", 1, 0],
  ["background-long-text", 1, 0],
  ["three-audio", 3, 0],
  ["two-backgrounds-image", 2, 1],
  ["audio-two-images", 1, 2],
  ["three-images", 0, 3],
  ["four-images", 0, 4],
  ["one-image", 0, 1],
  ["two-videos", 0, 2],
  ["legacy-audio", 2, 0],
  ["answer-audio", 1, 0],
  ["final-audio", 1, 0],
  ["many-audios", 10, 0],
] as const;

for (const [width, height] of [
  [1440, 900],
  [375, 812],
  [320, 568],
  [812, 375],
] as const) {
  for (const theme of ["daylight", "midnight"] as const) {
    for (const name of [
      "short-text",
      "answer-text",
      "final-text",
      "audio-caption",
      "three-audio",
      "ten-audio",
    ] as const) {
      test(`${name} centers below the heading at ${width}×${height} (${theme})`, async ({
        page,
      }) => {
        await mount(page, name, width, height);
        await page.evaluate(async (theme) => {
          const path = "/src/features/settings/settingsStore.ts";
          (await import(path)).useSettings.getState().update({ theme });
        }, theme);
        const body = page.getByTestId("question-body");
        const step = page.getByTestId("content-step");
        const card = (await body.boundingBox())!;
        const area = (await step.boundingBox())!;
        expect(Math.abs(card.y + card.height / 2 - area.y - area.height / 2)).toBeLessThan(2);
        await expect(page.locator(".game-dock-content")).toBeInViewport();
        await expect(page.getByTestId("media-history")).toHaveCount(0);
        if (name.includes("audio")) {
          await expect(page.getByRole("slider")).toBeInViewport();
          const audio = page.getByTestId("question-audio-region");
          const visible = (await audio.boundingBox())!;
          expect(visible.height).toBeGreaterThan(40);
        }
        if (width === 1440 && theme === "midnight")
          await page.screenshot({ path: test.info().outputPath(`${name}-centered.png`) });
      });
    }
  }
}

for (const [width, height] of [
  [320, 640],
  [375, 884],
  [820, 900],
  [1440, 900],
  [844, 390],
]) {
  for (const [name, audioCount, visuals] of cases) {
    test(`${name} keeps the canvas and dock reachable at ${width}×${height}`, async ({ page }) => {
      await mount(page, name, width!, height!);
      const cards = page.locator(".audio-player");
      await expect(cards).toHaveCount(audioCount);
      const media = page.getByTestId("question-media-region");
      const hasVideo = name === "two-videos";
      await expect(page.getByRole("slider")).toHaveCount(audioCount || hasVideo ? 1 : 0);
      const body = page.getByTestId("question-body");
      const copy = page.getByTestId("question-text-scroll");
      const audio = page.getByTestId("question-audio-region");
      const dock = page.locator(".game-dock-content");
      await expect(body).toBeVisible();
      if (name !== "one-image") await expect(copy).toBeVisible();
      if (audioCount) {
        await expect(audio).toBeVisible();
        expect((await audio.boundingBox())!.y).toBeGreaterThanOrEqual(
          (await copy.boundingBox())!.y,
        );
        expect((await page.getByRole("slider").boundingBox())!.y).toBeGreaterThan(
          (await audio.boundingBox())!.y,
        );
      }
      if (visuals) {
        const grid = media.getByTestId("visual-grid");
        await expect(grid).toHaveAttribute("data-count", String(visuals));
        for (const frame of await grid.locator(".question-media-frame").all()) {
          const bounds = (await frame.boundingBox())!;
          expect(bounds.height).toBeGreaterThan(8);
          expect(bounds.width).toBeGreaterThan(70);
        }
        if ((width! < 700 || (width! < 1000 && height! < 480)) && visuals > 1) {
          const [first, second] = await grid.locator(".question-visual-cell").all();
          expect((await first!.boundingBox())!.x).toBe((await second!.boundingBox())!.x);
        }
        if (width === 1440 && visuals === 3) {
          const [first, second, third] = await grid.locator(".question-visual-cell").all();
          expect((await first!.boundingBox())!.y).toBe((await second!.boundingBox())!.y);
          expect((await third!.boundingBox())!.width).toBeGreaterThan(
            (await first!.boundingBox())!.width,
          );
        }
      }
      if (name === "many-audios") {
        expect(await audio.evaluate((node) => node.scrollHeight)).toBeGreaterThan(
          await audio.evaluate((node) => node.clientHeight),
        );
        expect(await copy.evaluate((node) => node.scrollHeight)).toBeGreaterThan(
          await copy.evaluate((node) => node.clientHeight),
        );
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(dock).toBeInViewport();
      await expect(page.getByTestId("content-steps")).toHaveCount(0);
      if (name === "background-caption") {
        const before = await cards.elementHandle();
        await seek(page);
        await expect(cards.getByRole("status")).toHaveCount(0);
        await expect
          .poll(() => cards.locator("audio").evaluate((el: HTMLAudioElement) => el.paused))
          .toBe(true);
        expect(await cards.evaluate((el, original) => el === original, before)).toBe(true);
        await expect(page.getByTestId("content-replay")).toBeEnabled();
      }
    });
  }
}

for (const [width, height] of [
  [320, 568],
  [812, 375],
] as const) {
  for (const layout of ["many-audios", "audio-two-videos"] as const) {
    test(`${layout} keeps one entire audio card and controls visible at ${width}×${height}`, async ({
      page,
    }) => {
      await mount(page, layout, width, height);
      if (layout === "many-audios") {
        await seek(page);
        await expect(page.getByTestId("content-replay")).toBeInViewport({ ratio: 1 });
      } else {
        const video = page.getByTestId("media-video").first();
        await expect(video).toBeInViewport({ ratio: 0.9 });
        expect((await video.boundingBox())!.height).toBeGreaterThanOrEqual(64);
      }
      await expect(page.locator(".audio-player").first()).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("slider")).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId("dock")).toBeInViewport({ ratio: 1 });
      const copy = page.getByTestId("question-text-scroll");
      expect((await copy.boundingBox())!.height).toBeGreaterThanOrEqual(20);
      if (layout === "many-audios") {
        const audio = page.getByTestId("question-audio-region");
        expect(await copy.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
        expect(await audio.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      }
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollHeight <= innerHeight &&
            document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}

test("the max mixed timeline keeps expansion and blocked-audio recovery reachable on a short phone", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return this instanceof HTMLAudioElement && !this.muted
        ? Promise.reject(new DOMException("needs user input", "NotAllowedError"))
        : play.call(this);
    };
  });
  await mount(page, "max-mixed-timeline", 320, 568);
  // The previous image remains on the stage while the next group's audio starts.
  await seek(page, 600_000);
  await expect(page.getByTestId("content-step-label")).toHaveText("Part 2 of 30");
  const frame = page.getByTestId("visual-grid").getByTestId("media-frame");
  expect((await frame.boundingBox())!.height).toBeGreaterThanOrEqual(64);
  const expand = page.getByRole("button", { name: "Expand media" });
  await expect(expand).toBeInViewport({ ratio: 1 });
  await expand.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(expand).toBeFocused();
  const sound = page.getByTestId("enable-sound");
  await sound.scrollIntoViewIfNeeded();
  await expect(sound).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("slider")).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId("dock")).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(568);
});

test("five visuals queue with a neutral frame during the first audio, then enable local history", async ({
  page,
}) => {
  await mount(page, "queue-five", 375, 812);
  const history = page.getByTestId("media-history");
  const thumbs = history.getByRole("button");
  await expect(thumbs).toHaveCount(5);
  for (const thumb of await thumbs.all()) await expect(thumb).toBeDisabled();
  await expect(page.getByTestId("visual-placeholder")).toBeVisible();
  await expect(page.getByTestId("media-video")).toHaveCount(0);
  await expect(page.getByTestId("media-audio")).toHaveCount(1);
  await expect(history.locator("audio, video")).toHaveCount(0);

  await seek(page, 60_001);
  await expect(thumbs.first()).toHaveAttribute("data-future", "true");
  const video = page.getByTestId("media-video");
  await expect(video).toHaveCount(1);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
  const element = await video.elementHandle();
  const expand = page.getByRole("button", { name: "Expand media" });
  await expand.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(expand).toBeFocused();
  expect(await video.evaluate((node, original) => node === original, element)).toBe(true);

  await seek(page);
  await expect(thumbs.first()).toBeEnabled();
  await thumbs.first().click();
  await expect(video).toHaveCount(1);
  const replayed = await video.elementHandle();
  await thumbs.nth(1).click();
  expect(await video.evaluate((node, original) => node === original, replayed)).toBe(false);
  await thumbs.last().click();
  await expect(video).toHaveCount(0);
  const replay = page.getByTestId("content-replay");
  await replay.click();
  await expect(thumbs.first()).toBeDisabled();
  await expect(page.getByTestId("visual-placeholder")).toBeVisible();
});

test("renders seven visual thumbnails and three cards for a ten-file group without starting hidden sound", async ({
  page,
}) => {
  await mount(page, "mixed-ten", 820, 900);
  const history = page.getByTestId("media-history");
  await expect(history.getByRole("button")).toHaveCount(7);
  await expect(history.locator(".question-thumbnail-type")).toHaveCount(7);
  await expect(page.locator(".audio-player")).toHaveCount(3);
  await expect(page.getByText("Audio 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("media-audio")).toHaveCount(1);
  await expect(page.getByTestId("media-video")).toHaveCount(0);
  await expect(page.getByRole("slider")).toHaveCount(1);
  await seek(page, 180_001);
  await expect(page.getByTestId("media-video")).toHaveCount(1);
  expect(
    await page
      .getByTestId("media-audio")
      .evaluateAll((nodes) => nodes.every((node) => (node as HTMLAudioElement).paused)),
  ).toBe(true);
});

test("keeps 30 progress segments stable and only the current ten thumbnails after completion", async ({
  page,
}) => {
  await mount(page, "max-timeline", 320, 640);
  const progress = page.getByTestId("content-steps");
  const history = page.getByTestId("media-history");
  const thumbs = history.getByRole("button");
  await expect(progress.locator(".question-step-segments > span")).toHaveCount(30);
  await expect(thumbs).toHaveCount(10);
  const before = await progress.boundingBox();
  await seek(page, 600_001);
  await expect(page.getByTestId("content-step-label")).toHaveText("Part 2 of 30");
  await expect(thumbs).toHaveCount(10);
  expect(await progress.boundingBox()).toEqual(before);
  await seek(page);
  await expect(page.getByTestId("content-step-label")).toHaveText("Part 30 of 30");
  await expect(thumbs).toHaveCount(10);
  await expect(thumbs.first()).toBeEnabled();
  await expect(history.locator("video, audio, .question-thumbnail-type")).toHaveCount(0);
  expect(await progress.boundingBox()).toEqual(before);
});

test("renders final answer files on the public reveal clock without a one-file thumbnail strip", async ({
  page,
}) => {
  await mount(page, "final-reveal", 375, 812);
  await expect(page.getByTestId("answer-reveal")).toContainText("The final answer");
  await expect(page.getByTestId("media-audio")).toHaveCount(1);
  await expect(page.getByTestId("visual-grid")).toHaveAttribute("data-count", "1");
  await expect(page.getByTestId("media-history")).toHaveCount(0);
  await seek(page);
  await expect(page.getByTestId("media-history")).toHaveCount(0);
  await expect(page.getByTestId("content-replay")).toBeEnabled();
});

test("starts each long text step at the top and keeps the current reading position on rerender", async ({
  page,
}) => {
  await mount(page, "long-steps", 375, 812);
  const text = page.getByTestId("question-text-scroll");
  const clue = page.getByTestId("question-text");
  const scrollToEnd = () =>
    text.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
  await expect(clue).toHaveText(/^A1 /);
  const scroll = await scrollToEnd();
  expect(scroll).toBeGreaterThan(100);
  await seek(page, 5000);
  await expect.poll(() => text.evaluate((element) => element.scrollTop)).toBe(scroll);

  await seek(page, 15001);
  await expect(clue).toHaveText(/^B1 /);
  expect(await text.evaluate((element) => element.scrollTop)).toBe(0);
  await seek(page);
  await expect(page.getByTestId("content-replay")).toBeEnabled();
  expect(await scrollToEnd()).toBeGreaterThan(100);
  await page.getByTestId("content-replay").click();
  await expect(clue).toHaveText(/^A1 /);
  expect(await text.evaluate((element) => element.scrollTop)).toBe(0);
});
