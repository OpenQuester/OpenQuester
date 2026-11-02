import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { hostGame, person, signInAsGuest } from "./support/game";

test("replays real downloaded media without another readiness ACK or a dock resize", async ({
  page,
  request,
}) => {
  test.skip(
    test.info().project.name !== "desktop",
    "native role and responsive coverage runs separately",
  );
  let code: string | undefined;
  let replayPackage: number | undefined;
  const sent: string[] = [];
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => sent.push(String(frame.payload))),
  );
  try {
    const login = await request.post("/v1/dev/login/1");
    expect(login.ok()).toBe(true);
    const md5 = createHash("md5")
      .update(readFileSync(new URL("./fixtures/clip.webm", import.meta.url)))
      .digest("hex");
    const created = await request.post("/v1/packages", {
      data: {
        content: {
          title: `Replay timing ${Date.now()}`,
          language: "en",
          ageRestriction: "NONE",
          tags: [],
          rounds: [
            {
              name: "Media",
              order: 0,
              type: "simple",
              themes: [
                {
                  name: "Media",
                  order: 0,
                  questions: [
                    {
                      type: "simple",
                      subType: "simple",
                      order: 0,
                      price: 100,
                      text: "Watch the full clip",
                      answerText: "Pattern",
                      isHidden: false,
                      answerDelay: 1000,
                      showAnswerDuration: 5000,
                      questionFiles: [
                        { order: 0, displayTime: 10000, file: { md5, type: "video" } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
    expect(created.ok()).toBe(true);
    replayPackage = (await created.json()).id;
    const upload = await request.get(`/v1/packages/${replayPackage}/upload`);
    expect((await upload.json()).status).toBe("ready");
    await signInAsGuest(page, "Replay host");
    code = await hostGame(page, `Replay regression ${Date.now()}`, {
      packageId: replayPackage,
    });
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await page.getByRole("button", { name: "Media, 100", exact: true }).click();
    await expect(page.getByTestId("question-pick-transition")).toBeVisible();
    await expect(page.getByTestId("question-pick-transition")).toHaveCount(0, { timeout: 10000 });
    const video = page.getByTestId("media-video");
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.ended), { timeout: 10000 })
      .toBe(true);
    const replay = page.getByTestId("content-replay");
    await expect(replay).toHaveCount(0);
    await expect(replay).toBeEnabled({ timeout: 25000 });
    const height = (await page.locator(".game-dock").boundingBox())!.height;
    await page.screenshot({ path: test.info().outputPath("replay-ready.png") });
    await replay.click();
    expect(await video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeLessThan(1);
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(0.1);
    expect((await page.locator(".game-dock").boundingBox())!.height).toBe(height);
    expect(sent.filter((frame) => frame.includes('"media-downloaded"'))).toHaveLength(1);
    expect(sent.filter((frame) => frame.includes('"question-pick"'))).toHaveLength(1);
  } finally {
    if (code) await page.request.delete(`/v1/games/${code}`);
    if (replayPackage) await request.delete(`/v1/packages/${replayPackage}`);
  }
});

test("refreshes a warm catalogue after leave and deletion, including the last lobby", async ({
  browser,
  page,
}) => {
  const host = await person(browser, "Exit host", { viewport: { width: 1280, height: 800 } });
  let hostCode: string | undefined;
  let ownCode: string | undefined;
  try {
    const title = `Exit regression ${Date.now()}`;
    await signInAsGuest(host.page, "Exit host");
    hostCode = await hostGame(host.page, title);
    await signInAsGuest(page, "Exit player");
    const card = page.getByTestId("game-card").filter({ hasText: title });
    await expect(card).toBeVisible();
    // Use SPA links to retain the genuinely fresh query cache.
    await card.getByRole("link").click();
    await page.getByRole("button", { name: "Join as player" }).click();
    await expect(page.getByRole("button", { name: "Leave lobby" })).toBeVisible();
    let requests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/v1/games" && request.method() === "GET") requests++;
    });
    await page.getByRole("button", { name: "Leave lobby" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => requests, { timeout: 3000 }).toBeGreaterThan(0);
    await expect(card).toBeVisible();
    await expect(page.getByText(/You're still in/)).toHaveCount(0);
    await card.getByRole("link").click();
    await page.getByRole("button", { name: "Join as player" }).click();
    await expect(page.getByRole("button", { name: "Leave lobby" })).toBeVisible();
    requests = 0;
    await host.page.getByTestId("delete-game").click();
    await host.page.getByTestId("delete-game-confirm").click();
    await expect(page.getByTestId("home-notice")).toContainText("The showman deleted the game.");
    hostCode = undefined;
    await expect(card).toHaveCount(0);
    await expect.poll(() => requests, { timeout: 3000 }).toBeGreaterThan(0);
    await page.getByTestId("home-notice").getByRole("button", { name: "Close" }).click();
    await expect(page).toHaveURL(/\/$/);
    const ownTitle = `Last lobby ${Date.now()}`;
    ownCode = await hostGame(page, ownTitle);
    requests = 0;
    await page.getByRole("button", { name: "Leave lobby" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => requests, { timeout: 3000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("home-notice")).toHaveCount(0);
    await expect(page.getByTestId("game-card").filter({ hasText: ownTitle })).toHaveCount(0);
    ownCode = undefined;
    expect(host.errors).toEqual([]);
  } finally {
    if (hostCode) await host.page.request.delete(`/v1/games/${hostCode}`);
    if (ownCode) await page.request.delete(`/v1/games/${ownCode}`);
    await host.context.close();
  }
});
