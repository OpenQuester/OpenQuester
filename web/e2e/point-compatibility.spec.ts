import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import type { OqPackage } from "../src/api/types";
import type { GameStore } from "../src/game/store";
import { buzz, cell, chipScore, expectPhase, hostGame, joinByLink, person } from "./support/game";

const laptop = { viewport: { width: 1280, height: 800 } };

/** The same source target/PNG fixture used by parser and native geometry regressions. */
function pointSiq(title: string): Buffer {
  const fixture = new URL("../src/features/upload/fixtures/siq/", import.meta.url);
  const source = readFileSync(new URL("point.xml", fixture), "utf8");
  const question = source.match(/<question price="100">[\s\S]*?<\/question>/)![0];
  const xml = source
    .replace('name="Point compatibility"', `name="${title}"`)
    .replace(/<questions>[\s\S]*?<\/questions>/, `<questions>${question}</questions>`)
    .replaceAll('isRef="True"', 'isRef="True" duration="00:00:00.300"');
  return Buffer.from(
    zipSync({
      "content.xml": strToU8(xml),
      "Images/point-wide.png": new Uint8Array(readFileSync(new URL("point-wide.png", fixture))),
      "Images/point-other.png": new Uint8Array(readFileSync(new URL("point-other.png", fixture))),
    }),
  );
}

/** Read the existing E2E store hook; actions still travel through the real UI and server. */
async function state(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __oqGame: { getState(): GameStore } }).__oqGame.getState().session
        ?.state ?? null,
  );
}

async function pick(page: Page, x: number) {
  const image = page.getByTestId("point-picker").locator("img");
  await image.evaluate((img: HTMLImageElement) => img.decode());
  await expect(image).toHaveJSProperty("naturalWidth", 200);
  const box = (await image.boundingBox())!;
  await image.click({ position: { x: box.width * x, y: box.height * 0.5 } });
}

test("SIQ last-image point survives draft, publication, real clicks and reveal reconnect", async ({
  browser,
  page,
}, info) => {
  const host = await person(browser, "Point host", laptop);
  const device = info.project.use;
  const kim = await person(browser, "Kim", {
    viewport: device.viewport ?? laptop.viewport,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    userAgent: device.userAgent,
    deviceScaleFactor: device.deviceScaleFactor,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let packageId: number | undefined;
  let code: string | undefined;
  try {
    expect((await host.page.request.post("/v1/dev/login/990031")).ok()).toBe(true);
    await host.page.goto("/packages/editor");
    await host.page.getByTestId("import-file").setInputFiles({
      name: "point.siq",
      mimeType: "application/zip",
      buffer: pointSiq(`SIQ point ${Date.now()}`),
    });
    await expect(host.page.getByTestId("round-board")).toBeVisible();
    await host.page.reload();
    await expect(host.page.getByTestId("question-card")).toHaveCount(1);
    await host.page.getByTestId("publish").click();
    const created = host.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/v1/packages",
    );
    await host.page.getByTestId("publish-confirm").click();
    const response = await created;
    expect(response.ok()).toBe(true);
    packageId = (await response.json()).id as number;
    await expect(host.page.getByTestId("publish-done")).toBeVisible({ timeout: 30_000 });
    expect(
      (await (await host.page.request.get(`/v1/packages/${packageId}/upload`)).json()).status,
    ).toBe("ready");
    const stored = (await (
      await host.page.request.get(`/v1/packages/${packageId}`)
    ).json()) as OqPackage;
    const question = stored.rounds[0]!.themes[0]!.questions[0]!;
    const images = question
      .questionFiles!.filter((item) => item.file.type === "image")
      .sort((a, b) => a.order - b.order);
    expect(images).toHaveLength(2);
    const target = images.at(-1)!;
    expect(target.file.md5).not.toBe(images[0]!.file.md5);
    expect(question).toMatchObject({
      answerType: "point",
      pointImageOrder: target.order,
      answerDeviation: 0.05,
      answerPoint: {
        x: 0.5,
        y: 0.5,
        imageAspectRatio: 2,
        sourceGeometry: { kind: "sigame", aspectRatio: 2 },
      },
    });
    const downloaded = await host.page.request.get(target.file.link!);
    expect(downloaded.ok()).toBe(true);
    expect(
      createHash("md5")
        .update(await downloaded.body())
        .digest("hex"),
    ).toBe(target.file.md5);

    code = await hostGame(host.page, "Point compatibility", { packageId });
    await joinByLink(page, code, "Pat", "player");
    await joinByLink(kim.page, code, "Kim", "player");
    await page.getByRole("button", { name: "I'm ready" }).click();
    await kim.page.getByRole("button", { name: "I'm ready" }).click();
    await expectPhase([page, kim.page, host.page], "Choosing");
    await cell(host.page, "Targets", 100).click();
    await expectPhase([page, kim.page], "Ready to buzz");
    await kim.page.reload();
    await expectPhase([kim.page], "Ready to buzz");
    const rejoined = await state(kim.page);
    expect(rejoined?.currentQuestion?.pointImageOrder).toBe(target.order);
    expect(rejoined?.currentQuestion).not.toHaveProperty("answerPoint");
    await buzz(page);
    await expect(page.getByTestId("point-picker")).toBeVisible();
    await expect(page.getByTestId("point-target")).toHaveCount(0);
    expect((await state(page))?.currentQuestion).not.toHaveProperty("answerPoint");
    await expect(page.getByTestId("point-picker").locator("img")).toHaveAttribute(
      "src",
      new RegExp(target.file.md5),
    );
    // a=2, d=.05: .04 horizontally is outside SIQ, inside the native OQ circle.
    await pick(page, 0.54);
    await expectPhase([page, kim.page], "Ready to buzz");
    await expect.poll(() => chipScore(host.page, "Pat")).toBe("−100");
    await expect(page.getByTestId("answer-reveal")).toHaveCount(0);
    expect((await state(page))?.currentQuestion).not.toHaveProperty("answerPoint");
    expect((await state(page))?.answerShowData).toBeNull();
    await buzz(kim.page);
    await pick(kim.page, 0.5);
    await expectPhase([page, kim.page, host.page], "Answer");
    await expect.poll(() => chipScore(host.page, "Kim")).toBe("100");
    await kim.page.reload();
    await expectPhase([kim.page], "Answer");
    expect((await state(kim.page))?.answerShowData).toMatchObject({
      answerPoint: question.answerPoint,
      answerPointImage: target.file.link,
      answerDeviation: 0.05,
    });
    const reveal = kim.page.getByTestId("answer-reveal");
    await expect(reveal.getByTestId("point-target")).toBeVisible();
    await expect(reveal.getByTestId("point-picker").locator("img")).toHaveAttribute(
      "src",
      new RegExp(target.file.md5),
    );
    await reveal
      .getByTestId("point-picker")
      .locator("img")
      .evaluate((img: HTMLImageElement) => img.decode());
    const area = await reveal.getByTestId("point-picker").evaluate((picker) => {
      const image = picker.querySelector("img")!.getBoundingClientRect();
      const target = picker.querySelector('[data-testid="point-target"]')!.getBoundingClientRect();
      return { width: target.width / image.width, height: target.height / image.height };
    });
    expect(area.width).toBeCloseTo(0.05, 2);
    expect(area.height).toBeCloseTo(0.1, 2);
    await kim.page.screenshot({ path: info.outputPath("point-live-reveal.png") });
    expect([...errors, ...host.errors, ...kim.errors]).toEqual([]);
  } finally {
    if (code) await host.page.request.delete(`/v1/games/${code}`);
    if (packageId) await host.page.request.delete(`/v1/packages/${packageId}`);
    await kim.context.close();
    await host.context.close();
  }
});
