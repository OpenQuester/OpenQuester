import { expect, test } from "@playwright/test";
import type * as Fixture from "./select.fixture";

for (const viewport of [
  { width: 1366, height: 884 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]) {
  test(`30 select options stay reachable in all-play and final at ${viewport.width}px`, async ({
    page,
    context,
  }, info) => {
    await page.setViewportSize(viewport);
    await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/");
    for (const final of [false, true]) {
      await page.evaluate(async (final) => {
        const path = "/browser-tests/select.fixture.tsx";
        ((await import(path)) as typeof Fixture).mountSelect(final);
      }, final);
      const tab = page.getByRole("tab", { name: /Answer options/ });
      if (await tab.isVisible()) await tab.click();
      await expect(
        page.getByText(
          final ? "Choose an option · bid 100" : "Choose an option — everyone answers this one",
          { exact: true },
        ),
      ).toBeVisible();
      const last = page.getByRole("button", { name: "Option 30", exact: true });
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeVisible();
      await last.focus();
      await page.keyboard.press("Enter");
      await expect(last).toBeDisabled();
      const actions = () =>
        page.evaluate(async () => {
          const path = "/browser-tests/select.fixture.tsx";
          return ((await import(path)) as typeof Fixture).actions();
        });
      expect(await actions()).toEqual([
        {
          event: final ? "final-answer-submit" : "all-play-answer",
          payload: { answerText: "Option 30", choiceOrder: 29 },
        },
      ]);
      await page.evaluate(async () => {
        const path = "/browser-tests/select.fixture.tsx";
        ((await import(path)) as typeof Fixture).retrySelect();
      });
      await last.click();
      expect(await actions()).toHaveLength(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`${final ? "final" : "all-play"}-${viewport.width}.png`),
      });
    }
  });
}

test("option audio plays through existing controls without submitting", async ({
  page,
  context,
}) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/browser-tests/select.fixture.tsx";
    ((await import(path)) as typeof Fixture).mountSelect(true, true);
  });
  const play = page.getByRole("button", { name: "Play", exact: true }).first();
  await play.scrollIntoViewIfNeeded();
  await play.click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .first()
        .evaluate((el: HTMLAudioElement) => el.currentTime),
    )
    .toBeGreaterThan(0);
  const actions = await page.evaluate(async () => {
    const path = "/browser-tests/select.fixture.tsx";
    return ((await import(path)) as typeof Fixture).actions();
  });
  expect(actions).toEqual([]);
  await page.getByRole("button", { name: "Option 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Option 1", exact: true })).toBeDisabled();
});

test("a final select without answerFiles shows its correct option after review", async ({
  page,
  context,
}) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/browser-tests/select.fixture.tsx";
    const fixture = (await import(path)) as typeof Fixture;
    fixture.mountSelect(true, true);
  });
  await expect(page.getByRole("button", { name: "Option 1", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = "/browser-tests/select.fixture.tsx";
    ((await import(path)) as typeof Fixture).revealSelect();
  });
  await expect(page.getByTestId("answer-reveal")).toBeVisible();
  await expect(
    page.getByTestId("answer-reveal").getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Option 1", exact: true })).toHaveCount(0);
});

for (const final of [false, true]) {
  test(`phone video options keep the last play, seek and selection reachable: final=${final}`, async ({
    page,
    context,
  }, info) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/");
    await page.evaluate(async (final) => {
      const path = "/browser-tests/select.fixture.tsx";
      ((await import(path)) as typeof Fixture).mountSelect(final, "video");
    }, final);
    const tab = page.getByRole("tab", { name: /Answer options/ });
    if (await tab.isVisible()) await tab.click();
    const card = page.locator(".choice-card").last();
    const video = card.locator("video");
    const play = card.getByRole("button", { name: "Play", exact: true });
    const seek = card.getByRole("slider", { name: "Seek", exact: true });
    await play.scrollIntoViewIfNeeded();
    await expect(play).toBeInViewport();
    await expect(seek).toBeEnabled();
    const bounds = await card.boundingBox();
    const controls = await Promise.all([play.boundingBox(), seek.boundingBox()]);
    await page.screenshot({
      path: info.outputPath(`phone-video-${final ? "final" : "all-play"}.png`),
    });
    for (const control of controls) {
      expect(control!.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(control!.x + control!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
      expect(control!.y).toBeGreaterThanOrEqual(bounds!.y);
      expect(control!.y + control!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
    }
    // Real Playwright pointer input also verifies hit targets are not intercepted by another card.
    await play.click();
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(0);
    await card.getByRole("button", { name: "Pause", exact: true }).click();
    const before = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    const seekBox = (await seek.boundingBox())!;
    await seek.click({ position: { x: seekBox.width * 0.75, y: seekBox.height / 2 } });
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(before + 0.5);
    const decoded = await video.evaluate((el: HTMLVideoElement) => ({
      width: el.videoWidth,
      frames: el.getVideoPlaybackQuality().totalVideoFrames,
    }));
    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.frames).toBeGreaterThan(0);
    await page.screenshot({
      path: info.outputPath(`phone-video-${final ? "final" : "all-play"}-seeked.png`),
    });
    expect(
      await page.evaluate(async () => {
        const path = "/browser-tests/select.fixture.tsx";
        return ((await import(path)) as typeof Fixture).actions();
      }),
    ).toEqual([]);
    const pick = card.getByRole("button", { name: "Option 9", exact: true });
    // The option header is the selection target; video/transport occupy their own sibling target.
    await pick.click({ position: { x: 40, y: 18 } });
    expect(
      await page.evaluate(async () => {
        const path = "/browser-tests/select.fixture.tsx";
        return ((await import(path)) as typeof Fixture).actions();
      }),
    ).toEqual([
      {
        event: final ? "final-answer-submit" : "all-play-answer",
        payload: { answerText: "Option 9", choiceOrder: 8 },
      },
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
