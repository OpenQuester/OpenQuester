import { expect, test, type Page } from "@playwright/test";

import {
  buzz,
  cell,
  dockPhase,
  expectNoHorizontalScroll,
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

/** Keep the real image request pending until the readiness checks have finished. */
async function holdImages(page: Page) {
  let release!: () => void;
  let requested = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "image") {
      requested = true;
      await gate;
    }
    await route.continue();
  });
  return { release, requested: () => requested };
}

/** Seconds the media element has played, and whether it is playing now. */
function playback(page: Page, selector: string) {
  return page.locator(selector).evaluate((el: HTMLMediaElement) => ({
    time: el.currentTime,
    paused: el.paused,
    controls: el.controls,
  }));
}

test.describe("question media", () => {
  test("the timer waits until every player has the picture", async ({ browser, page }) => {
    const host = await person(browser, "Host", laptop);
    await signInAsGuest(host.page, "Host");
    const code = await hostGame(host.page, "Media sync", { packageId: mediaPackageId() });
    await joinByLink(page, code, "Pat", "player");
    const slow = await person(browser, "Slow", laptop);
    await joinByLink(slow.page, code, "Slow", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await slow.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    const images = await holdImages(slow.page);
    try {
      await cell(host.page, "Media", 200).click();
      await expect.poll(images.requested).toBe(true);
      // Preparation still owns the server phase; the local opening owns the dock copy.
      await expect(dockPhase(page)).toHaveText("Loading question");
      await expect(page.getByTestId("dock-status")).toHaveText("Opening question");
      const patCard = page.locator('[data-testid="player-chip"][data-player="Pat"] .player-card');
      const slowCard = page.locator('[data-testid="player-chip"][data-player="Slow"] .player-card');
      await expect(patCard).not.toHaveAccessibleName(/loading/i);
      await expect(slowCard).toHaveAccessibleName(/loading/i);
      await expect(page.getByTestId("timer-ring")).toContainText("1/2");
      await expect(page.getByTestId("question-text")).toHaveCount(0);
      await expect(page.getByTestId("media-frame")).toHaveCount(0);
      await expect(page.getByTestId("question-pick-waiting")).toBeVisible();
      await expect(dockPhase(page)).toHaveText("Loading question");

      images.release();
      for (const p of [page, slow.page]) {
        await expect(dockPhase(p)).toHaveText("Ready to buzz", { timeout: 15_000 });
        await expect(p.getByTestId("question-pick-transition")).toHaveCount(0);
        const img = p.getByTestId("media-frame").locator("img");
        await expect(img).toBeVisible();
        expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(
          1600,
        );
      }
      await shot(page, `media-image-${test.info().project.name}`);
      await expectNoHorizontalScroll(page);
    } finally {
      images.release();
      await slow.page.unrouteAll({ behavior: "wait" });
      await host.page.request.delete(`/v1/games/${code}`);
      await host.context.close();
      await slow.context.close();
    }
  });

  test("video plays by itself, in a frame that doesn't jump", async ({ browser, page }) => {
    const host = await person(browser, "Host", laptop);
    // The host's browser blocks sound until a tap, like after a page reload.
    await host.context.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
        if (!this.muted && !(window as { __oqTapped?: boolean }).__oqTapped)
          return Promise.reject(new DOMException("needs a tap", "NotAllowedError"));
        return play.call(this);
      };
    });
    await signInAsGuest(host.page, "Host");
    const code = await hostGame(host.page, "Video", { packageId: mediaPackageId() });
    await joinByLink(page, code, "Pat", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    await cell(host.page, "Media", 100).click();
    await expect(dockPhase(page)).toHaveText("Ready to buzz", { timeout: 15_000 });
    const frame = page.getByTestId("media-frame");
    await expect(frame).toBeVisible();
    // Layout size, not the on-screen box: the question pops in with a scale.
    const size = () =>
      frame.evaluate((el: HTMLElement) => ({ w: el.offsetWidth, h: el.offsetHeight }));
    const before = await size();
    // Everyone's video starts without anybody pressing play, and has no controls.
    for (const p of [page, host.page]) {
      await expect
        .poll(async () => (await playback(p, "[data-testid=media-video]")).paused)
        .toBe(false);
      expect((await playback(p, "[data-testid=media-video]")).controls).toBe(false);
    }
    // Blocked sound: the video still runs (muted) and one tap turns sound on.
    await expect(host.page.getByTestId("enable-sound")).toBeVisible();
    expect(
      await host.page
        .locator("[data-testid=media-video]")
        .evaluate((el: HTMLMediaElement) => el.muted),
    ).toBe(true);
    await host.page.evaluate(() => ((window as { __oqTapped?: boolean }).__oqTapped = true));
    await host.page.getByTestId("enable-sound").click();
    await expect(host.page.getByTestId("enable-sound")).toHaveCount(0);
    expect(
      await host.page
        .locator("[data-testid=media-video]")
        .evaluate((el: HTMLMediaElement) => el.muted),
    ).toBe(false);
    // Headless browsers have no sound card, so an audible video's clock stands
    // still there. Muting Pat's copy shows the frames really advance.
    await page.locator("[data-testid=media-video]").evaluate((el: HTMLMediaElement) => {
      el.muted = true;
    });
    await expect
      .poll(async () => (await playback(page, "[data-testid=media-video]")).time, {
        timeout: 10_000,
      })
      .toBeGreaterThan(0.5);
    expect(await size()).toEqual(before);
    await shot(page, `media-video-${test.info().project.name}`);

    // Buzzing stops the video for everyone while the answer is given.
    await buzz(page);
    await expect(dockPhase(page)).toHaveText("Answering");
    for (const p of [page, host.page])
      await expect
        .poll(async () => (await playback(p, "[data-testid=media-video]")).paused)
        .toBe(true);
    await host.context.close();
  });

  test("two players follow the server queue and can replay independently", async ({
    browser,
    page,
  }) => {
    const host = await person(browser, "Host", laptop);
    const second = await person(browser, "Alex", laptop);
    let code: string | undefined;
    try {
      await signInAsGuest(host.page, "Host");
      code = await hostGame(host.page, "Queued media", { packageId: mediaPackageId() });
      await joinByLink(page, code, "Pat", "player");
      await joinByLink(second.page, code, "Alex", "player");
      const players = [page, second.page];
      await Promise.all(
        players.map((client) => client.getByRole("button", { name: "I'm ready" }).click()),
      );
      await expect(dockPhase(page)).toHaveText("Choosing");
      await cell(host.page, "Media", 500).click();

      const videos = players.map((client) => client.getByTestId("media-video"));
      const histories = players.map((client) =>
        client.getByTestId("media-history").getByRole("button"),
      );
      await Promise.all(
        players.map(async (client, index) => {
          await expect(videos[index]!).toBeVisible();
          await videos[index]!.evaluate((node: HTMLVideoElement) => {
            node.muted = true;
          });
          await expect(histories[index]!).toHaveCount(5);
          await expect(histories[index]!.first()).toBeDisabled();
          await expect(client.getByTestId("buzz")).toHaveAttribute("data-early", /.*/);
        }),
      );
      const times = await Promise.all(
        videos.map((video) => video.evaluate((node: HTMLVideoElement) => node.currentTime)),
      );
      expect(Math.abs(times[0]! - times[1]!)).toBeLessThan(0.6);

      await Promise.all(
        players.map(async (client, index) => {
          await expect(histories[index]!.first()).toBeEnabled();
          await expect(videos[index]!).toHaveCount(0);
          await expect(client.getByTestId("buzz")).not.toHaveAttribute("data-early", /.*/);
        }),
      );
      await histories[0]!.first().click();
      await expect(videos[0]!).toBeVisible();
      expect(await videos[0]!.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeLessThan(
        1,
      );
      await expect(videos[1]!).toHaveCount(0);
      await expect(page.getByTestId("buzz")).not.toHaveAttribute("data-early", /.*/);
    } finally {
      if (code) await host.page.request.delete(`/v1/games/${code}`);
      await Promise.all([host.context.close(), second.context.close()]);
    }
  });

  test("both players see the first short clip with warm media and rejoin the running queue", async ({
    browser,
    page,
  }) => {
    test.skip(test.info().project.name !== "desktop", "one real two-client run is enough");
    const host = await person(browser, "Host", laptop);
    const second = await person(browser, "Alex", laptop);
    let code: string | undefined;
    try {
      await signInAsGuest(host.page, "Host");
      code = await hostGame(host.page, "Short opening clip", { packageId: mediaPackageId() });
      await Promise.all([
        joinByLink(page, code, "Pat", "player"),
        joinByLink(second.page, code, "Alex", "player"),
      ]);
      const players = [page, second.page];
      await Promise.all(
        players.map((client) => client.getByRole("button", { name: "I'm ready" }).click()),
      );
      await expect(dockPhase(page)).toHaveText("Choosing");
      await cell(host.page, "Media", 100).click();
      // Play the same asset in both browser contexts before selecting the queue.
      await Promise.all(
        players.map((client) =>
          expect
            .poll(async () => (await playback(client, "[data-testid=media-video]")).paused)
            .toBe(false),
        ),
      );
      await host.page.getByRole("button", { name: "Nobody knows — reveal the answer" }).click();
      await host.page.getByTestId("continue").click();
      await expect(dockPhase(page)).toHaveText("Choosing");

      const firstPlays = players.map((client) =>
        client.evaluate(
          () =>
            new Promise<{ epoch: number; position: number; opening: boolean } | null>((resolve) => {
              const capture = (event: Event) => {
                const video = event.target;
                if (!(video instanceof HTMLVideoElement) || video.dataset.testid !== "media-video")
                  return;
                document.removeEventListener("playing", capture, true);
                resolve({
                  epoch: Date.now(),
                  position: video.currentTime,
                  opening: !!document.querySelector('[data-testid="question-pick-transition"]'),
                });
              };
              document.addEventListener("playing", capture, true);
              setTimeout(() => {
                document.removeEventListener("playing", capture, true);
                resolve(null);
              }, 5000);
            }),
        ),
      );
      await cell(host.page, "Media", 600).click();
      const starts = await Promise.all(firstPlays);
      for (const start of starts) {
        expect(start).not.toBeNull();
        expect(start!.position).toBeLessThan(0.2);
        expect(start!.opening).toBe(false);
      }
      expect(Math.abs(starts[0]!.epoch - starts[1]!.epoch)).toBeLessThan(250);

      const activeImage = (client: Page) =>
        client.getByTestId("media-history").getByRole("button").nth(1);
      await Promise.all(
        players.map((client) =>
          expect(activeImage(client)).toHaveAttribute("aria-pressed", "true"),
        ),
      );
      await second.page.reload();
      await expect(activeImage(second.page)).toHaveAttribute("aria-pressed", "true");
      await expect(activeImage(page)).toHaveAttribute("aria-pressed", "true");
      await expect(second.page.getByTestId("question-pick-transition")).toHaveCount(0);
      await expect(second.page.getByTestId("media-video")).toHaveCount(0);
    } finally {
      if (code) await host.page.request.delete(`/v1/games/${code}`);
      await Promise.all([host.context.close(), second.context.close()]);
    }
  });

  test("on a 2K monitor the question uses the space", async ({ browser }) => {
    test.skip(test.info().project.name !== "desktop", "one 2K run is enough");
    const host = await person(browser, "Host", laptop);
    await signInAsGuest(host.page, "Host");
    const code = await hostGame(host.page, "Big screen", { packageId: mediaPackageId() });
    const big = await person(browser, "Pat", { viewport: { width: 2560, height: 1440 } });
    await joinByLink(big.page, code, "Pat", "player");
    await big.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(big.page)).toHaveText("Choosing");
    const cellBox = await big.page.getByTestId("board-cell").first().boundingBox();
    expect(cellBox!.height).toBeGreaterThanOrEqual(100);
    await shot(big.page, "board-2k");

    await cell(host.page, "Media", 200).click();
    await expect(dockPhase(big.page)).toHaveText("Ready to buzz", { timeout: 15_000 });
    const text = big.page.getByTestId("question-text");
    const fontSize = await text.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    // The compact question block caps its type while keeping media and text visible together.
    expect(fontSize).toBeGreaterThanOrEqual(32);
    await expect(text).toBeInViewport({ ratio: 1 });
    const frame = await big.page.getByTestId("media-frame").boundingBox();
    expect(frame!.width).toBeGreaterThanOrEqual(1200);
    expect(
      await big.page.getByTestId("game-stage").evaluate((el) => el.scrollHeight - el.clientHeight),
    ).toBeLessThanOrEqual(1);
    await shot(big.page, "question-2k");
    await host.context.close();
    await big.context.close();
  });
});

test.describe("side panels", () => {
  test("showman keeps tools and chat open next to the game", async ({ browser, page }) => {
    const wide = (page.viewportSize()?.width ?? 0) >= 1024;
    await signInAsGuest(page, "Host");
    const code = await hostGame(page, "Panels");
    const pat = await person(browser, "Pat", laptop);
    await joinByLink(pat.page, code, "Pat", "player");
    await pat.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(dockPhase(page)).toHaveText("Choosing");

    await page.getByTestId("host-tools").click();
    const tools = page.getByTestId("host-panel");
    await expect(tools).toBeVisible();

    if (!wide) {
      // Phones and portrait tablets: a sheet over the game, nothing to pin.
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByTestId("pin-host")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(tools).toHaveCount(0);
      // Touch opens the expanded card; management is an action inside it.
      await page.locator('[data-testid="player-chip"][data-player="Pat"] button').click();
      await page.getByRole("button", { name: "Manage Pat" }).first().click();
      await expect(page.getByTestId("player-admin")).toBeVisible();
      await pat.context.close();
      return;
    }

    // Wide screens: a side panel, the board stays usable next to it.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const board = await page.getByTestId("board-cell").first().boundingBox();
    const panel = await page.getByTestId("side-panels").boundingBox();
    expect(board!.x + board!.width).toBeLessThanOrEqual(panel!.x);
    await expectNoHorizontalScroll(page);

    // Manage a player inline: no pop-up over the game.
    await tools.getByRole("button", { name: "Manage Pat" }).click();
    await tools.getByRole("textbox", { name: "Score" }).fill("500");
    await tools.getByRole("button", { name: "Set score" }).click();
    await expect(pat.page.getByTestId("chip-score").first()).toHaveText("500");

    // Pin tools and chat; both survive a reload, Escape leaves them alone.
    await page.getByTestId("pin-host").click();
    await expect(page.getByTestId("pin-host")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("open-chat").click();
    await page.getByTestId("pin-chat").click();
    await page.reload();
    await expect(dockPhase(page)).toHaveText("Choosing");
    await expect(page.getByTestId("panel-host")).toBeVisible();
    await expect(page.getByTestId("panel-chat")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("panel-chat")).toBeVisible();

    // Chat while the board stays clickable.
    await pat.page.getByTestId("open-chat").click();
    await pat.page.getByLabel("Message").fill("hello host");
    await pat.page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("panel-chat")).toContainText("hello host");
    await shot(page, `pinned-panels-${test.info().project.name}`);
    await cell(page, "Capitals", 100).click();
    await expect(dockPhase(page)).toHaveText("Ready to buzz");
    await expect(page.getByTestId("panel-host")).toBeVisible();

    // Closing a pinned panel unpins it.
    await page.getByRole("button", { name: "Close Chat" }).click();
    await page.reload();
    await expect(page.getByTestId("panel-host")).toBeVisible();
    await expect(page.getByTestId("panel-chat")).toHaveCount(0);
    await pat.context.close();
  });
});
