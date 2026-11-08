import { expect, test, type Page } from "@playwright/test";
import type * as Fixture from "./content-replay.fixture";

async function mount(
  page: Page,
  mode: Parameters<typeof Fixture.mount>[0],
  role: Parameters<typeof Fixture.mount>[1] = "player",
  audio?: Parameters<typeof Fixture.mount>[2],
) {
  await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(
    async ({ mode, role, audio }) => {
      const path = "/browser-tests/content-replay.fixture.tsx";
      ((await import(path)) as typeof Fixture).mount(mode, role, audio);
    },
    { mode, role, audio },
  );
}

for (const width of [375, 820, 1440]) {
  test(`replay appears in the shared control row without moving its top edge at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 884 });
    await mount(page, "mixed", width === 1440 ? "showman" : "player");
    await page.evaluate(async (width) => {
      const path = "/src/features/settings/settingsStore.ts";
      const { useSettings } = await import(path);
      useSettings
        .getState()
        .update({ language: "uk", theme: width === 375 ? "daylight" : "midnight" });
      await document.fonts.ready;
    }, width);
    const replay = page.getByTestId("content-replay");
    const controls = page.getByTestId("content-controls");
    const media = page.getByTestId("media-video");
    await expect(media).toBeVisible();
    await expect(replay).toHaveCount(0);
    const before = (await media.boundingBox())!;
    const beforeControls = (await controls.boundingBox())!;
    await expect(replay).toBeEnabled();
    const after = (await media.boundingBox())!;
    const slider = (await page.getByRole("slider").boundingBox())!;
    const button = (await replay.boundingBox())!;
    expect(after.y).toBeCloseTo(before.y, 0);
    expect((await controls.boundingBox())!.height).toBeCloseTo(beforeControls.height, 0);
    expect(button.x).toBeGreaterThan(slider.x + slider.width);
    expect(button.y + button.height / 2).toBeCloseTo(slider.y + slider.height / 2, 0);
    expect(button.x + button.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath("replay-beside-volume.png") });
    await replay.click();
    await expect(replay).toHaveCount(0);
    await expect(page.getByTestId("media-video")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("text-only replay uses the same reserved row without a volume slider", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mount(page, "text");
  const controls = page.getByTestId("content-controls");
  const before = (await controls.boundingBox())!;
  await expect(page.getByTestId("content-replay")).toBeEnabled();
  const after = (await controls.boundingBox())!;
  expect(after.height).toBeCloseTo(before.height, 0);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("text-replay.png") });
  await page.getByTestId("content-replay").click();
  await expect(page.getByTestId("question-text")).toHaveText("Clue 1");
});

for (const width of [375, 1440]) {
  test(`choice replay keeps its media and text in the prompt column at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 884 });
    await mount(page, "choice");
    const replay = page.getByTestId("content-replay");
    await expect(replay).toBeEnabled();
    const prompt = (await page.locator(".choice-prompt").boundingBox())!;
    for (const element of [page.getByTestId("question-media-region"), replay]) {
      const box = (await element.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(prompt.x);
      expect(box.x + box.width).toBeLessThanOrEqual(prompt.x + prompt.width + 1);
    }
    await expect(page.getByTestId("question-text-scroll")).toBeVisible();
    await expect(replay).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("choice-replay.png") });
  });
}

test("pauses completed audio without a status caption and restarts the full presentation", async ({
  page,
}) => {
  await mount(page, "audio");
  const audio = page.getByTestId("media-audio");
  const replay = page.getByTestId("content-replay");
  await expect(replay).toBeEnabled();
  await expect(page.getByText("Finished", { exact: true })).toHaveCount(0);
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  expect(await audio.evaluate((el: HTMLAudioElement) => el.ended)).toBe(false);
  await replay.click();
  await expect(page.getByText("Audio", { exact: true })).toBeVisible();
  expect(await audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeLessThan(0.5);
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
});

for (const width of [375, 820, 1440]) {
  for (const theme of ["daylight", "midnight"] as const) {
    test(`audio card remains and shares one volume through completion and replay at ${width} (${theme})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 884 });
      await mount(page, "audio", "player", {
        placement: theme === "daylight" ? "screen" : "background",
        waitForFinish: false,
        durationMs: 2000,
      });
      await page.evaluate(async (theme) => {
        const path = "/src/features/settings/settingsStore.ts";
        const { useSettings } = await import(path);
        useSettings.getState().update({ theme });
        await document.fonts.ready;
      }, theme);

      const audio = page.getByTestId("media-audio");
      const card = page.getByTestId("media-frame");
      const slider = page.getByRole("slider");
      const replay = page.getByTestId("content-replay");
      const before = (await card.boundingBox())!;
      const volume = (await slider.boundingBox())!;
      const stage = (await page.getByTestId("content-stage").boundingBox())!;
      const player = await audio.elementHandle();
      await expect(replay).toHaveCount(0);
      expect(before.x + before.width / 2).toBeCloseTo(stage.x + stage.width / 2, 0);
      expect(before.y).toBeGreaterThan(stage.y);
      expect(volume.y).toBeGreaterThan(before.y + before.height);
      await expect(replay).toBeEnabled();
      expect(await audio.evaluate((el, first) => el === first, player)).toBe(true);
      await expect(card.getByText("Audio", { exact: true })).toBeVisible();
      await expect(card.getByRole("status")).toHaveCount(0);
      await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
      expect((await replay.boundingBox())!.x).toBeGreaterThan(
        (await slider.boundingBox())!.x + volume.width,
      );
      expect(await card.boundingBox()).toEqual(before);
      expect((await slider.boundingBox())!.width).toBe(volume.width);
      await replay.click();
      await expect(replay).toHaveCount(0);
      expect(await audio.evaluate((el, first) => el === first, player)).toBe(false);
      expect(await card.boundingBox()).toEqual(before);
      expect((await slider.boundingBox())!.width).toBe(volume.width);
    });
  }
}

for (const [mode, role] of [
  ["question", "player"],
  ["question", "showman"],
  ["question", "spectator"],
  ["answer", "showman"],
  ["final", "player"],
  ["playtest", "player"],
] as const) {
  test(`replays the whole ${mode} presentation locally as ${role}`, async ({ page }) => {
    await mount(page, mode, role);
    const video = page.getByTestId("media-video");
    await expect(video).toBeVisible({ timeout: 10000 });
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.ended), { timeout: 8000 })
      .toBe(true);
    await expect(page.getByTestId("content-replay")).toHaveCount(0);
    await expect(page.getByTestId("media-replay")).toHaveCount(0);
    const replay = page.getByTestId("content-replay");
    await expect(replay).toBeEnabled({ timeout: 8000 });
    await replay.click();
    await expect(page.getByTestId("content-step")).toHaveAttribute("data-step", "1");
    await expect(video).toBeVisible();
    expect(await video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeLessThan(1);
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
    await expect(replay).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath("replay.png") });
    if (mode === "question" && role === "player") {
      await page.evaluate(async () => {
        const path = "/browser-tests/content-replay.fixture.tsx";
        ((await import(path)) as typeof Fixture).pause(true);
      });
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
      const drift = await video.evaluate(async (el: HTMLVideoElement) => {
        const start = el.currentTime;
        const at = performance.now();
        while (performance.now() - at < 300) await new Promise(requestAnimationFrame);
        return Math.abs(el.currentTime - start);
      });
      expect(drift).toBeLessThan(0.05);
      await page.evaluate(async () => {
        const path = "/browser-tests/content-replay.fixture.tsx";
        const fixture = (await import(path)) as typeof Fixture;
        fixture.observeReplaySteps();
        fixture.pause(false);
      });
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
      await expect
        .poll(
          () =>
            page.evaluate(async () => {
              const path = "/browser-tests/content-replay.fixture.tsx";
              return ((await import(path)) as typeof Fixture).replaySteps;
            }),
          { timeout: 10000 },
        )
        .toEqual([
          { step: 1, text: "" },
          { step: 2, text: "Middle clue" },
          { step: 3, text: "" },
        ]);
      await expect(page.getByTestId("content-step")).toHaveAttribute("data-step", "3");
      expect(await video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeLessThan(1);
      await expect(replay).toBeEnabled();
      const commands = await page.evaluate(async () => {
        const path = "/browser-tests/content-replay.fixture.tsx";
        return ((await import(path)) as typeof Fixture).sent;
      });
      expect(commands).toEqual([]);
    }
  });
}

for (const [width, theme, reduced] of [
  [1440, "midnight", false],
  [375, "daylight", false],
  [820, "midnight", true],
] as const) {
  test(`dismisses the warning notice naturally at ${width}, reduced motion ${reduced}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.addInitScript(
      ({ theme, reduced }) =>
        localStorage.setItem(
          "oq.settings",
          JSON.stringify({ language: "en", theme, reduceMotion: reduced }),
        ),
      { theme, reduced },
    );
    await page.clock.install();
    await page.goto("/?notice=deleted");
    const notice = page.getByTestId("home-notice");
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("status")).toHaveClass(/bg-warning-surface/);
    await page.screenshot({ path: test.info().outputPath("notice.png") });
    await page.clock.fastForward(30000);
    if (!reduced) {
      const samples = await notice.evaluate(async (el) => {
        const values: number[] = [];
        for (let i = 0; i < 10; i++) {
          await new Promise(requestAnimationFrame);
          values.push(Number(getComputedStyle(el).opacity));
        }
        return values;
      });
      expect(samples.some((v) => v > 0 && v < 1)).toBe(true);
    }
    await expect(notice).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await page.reload();
    await expect(notice).toHaveCount(0);
    await page.goto("/?notice=kicked#retained");
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Close" }).click();
    if (width === 375) await page.evaluate(() => scrollTo(0, 300));
    await expect(notice).toHaveCount(0);
    await expect(page).toHaveURL(/\/#retained$/);
    if (width === 375) expect(await page.evaluate(() => scrollY)).toBeGreaterThan(50);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
