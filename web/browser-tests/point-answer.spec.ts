import { expect, test } from "@playwright/test";
import type * as Fixture from "./point-answer.fixture";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

for (const { shape, viewport, sequence } of [
  { shape: "wide", viewport: { width: 1366, height: 884 }, sequence: false },
  { shape: "tall", viewport: { width: 375, height: 812 }, sequence: false },
  { shape: "wide", viewport: { width: 1366, height: 884 }, sequence: true },
] as const) {
  test(`regular Buzz keeps the image frame and click geometry: ${shape} sequence=${sequence}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/");
    await page.evaluate(
      async ({ s, sequence }) => {
        const path = "/browser-tests/point-answer.fixture.tsx";
        ((await import(path)) as typeof Fixture).mountRegular(s, sequence);
      },
      { s: shape, sequence },
    );
    const frame = page.getByTestId("content-stage").getByTestId("media-frame");
    const image = frame.locator("img");
    await image.evaluate((el: HTMLImageElement) => el.decode());
    await expect(image).toBeVisible();
    const beforeFrame = (await frame.boundingBox())!;
    const beforeImage = await image.evaluate((element: HTMLImageElement) => {
      const rect = element.getBoundingClientRect();
      const scale = Math.min(
        rect.width / element.naturalWidth,
        rect.height / element.naturalHeight,
      );
      const width = element.naturalWidth * scale,
        height = element.naturalHeight * scale;
      return {
        x: rect.x + (rect.width - width) / 2,
        y: rect.y + (rect.height - height) / 2,
        width,
        height,
      };
    });
    const dir = process.env.OQ_POINT_FRAME_SHOTS;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      await page.screenshot({
        path: join(dir, `${shape}${sequence ? "-sequence" : ""}-before-buzz.png`),
        animations: "disabled",
      });
    }
    await page.evaluate(async () => {
      const path = "/browser-tests/point-answer.fixture.tsx";
      ((await import(path)) as typeof Fixture).buzzRegular();
    });
    const picker = page.getByTestId("point-picker");
    await expect(picker).toBeVisible();
    await picker.locator("img").evaluate((el: HTMLImageElement) => el.decode());
    await expect.poll(() => picker.evaluate((el) => el.style.width)).not.toBe("");
    const afterFrame = (await frame.boundingBox())!;
    const afterImage = (await picker.locator("img").boundingBox())!;
    for (const side of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(afterFrame[side] - beforeFrame[side])).toBeLessThan(1.5);
      expect(Math.abs(afterImage[side] - beforeImage[side])).toBeLessThan(1.5);
    }
    expect(await frame.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    if (dir)
      await page.screenshot({
        path: join(dir, `${shape}${sequence ? "-sequence" : ""}-after-buzz.png`),
        animations: "disabled",
      });
    await page.mouse.click(
      afterImage.x + afterImage.width * 0.25,
      afterImage.y + afterImage.height * 0.75,
    );
    const response = await page.evaluate(async () => {
      const path = "/browser-tests/point-answer.fixture.tsx";
      return ((await import(path)) as typeof Fixture).regularAnswer();
    });
    const [x, y] = response.split(",").map(Number);
    expect(Math.abs(x! - 0.25)).toBeLessThan(1.5 / afterImage.width);
    expect(Math.abs(y! - 0.75)).toBeLessThan(1.5 / afterImage.height);
  });
}

for (const { shape, viewport } of [
  { shape: "wide", viewport: { width: 1366, height: 884 } },
  { shape: "tall", viewport: { width: 375, height: 812 } },
] as const) {
  test(`point answers remain aligned and private before reveal: ${shape}`, async ({
    page,
    context,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/");
    await page.evaluate(async (s) => {
      const path = "/browser-tests/point-answer.fixture.tsx";
      ((await import(path)) as typeof Fixture).mountPoint(s);
    }, shape);
    const picker = page.getByTestId("point-picker");
    const img = picker.locator("img");
    await img.evaluate((el: HTMLImageElement) => el.decode());
    await expect.poll(() => picker.evaluate((el) => el.style.width)).not.toBe("");
    // Click the settled picture so our intended fractional coordinate is stable.
    await expect
      .poll(() => picker.evaluate((el) => getComputedStyle(el.closest(".oq-pop")!).transform))
      .toBe("none");
    const rect = (await img.boundingBox())!;
    await page.mouse.click(rect.x + rect.width * 0.25, rect.y + rect.height * 0.75);
    const [selectedX, selectedY] = (
      await page.evaluate(async () => {
        const path = "/browser-tests/point-answer.fixture.tsx";
        return ((await import(path)) as typeof Fixture).regularAnswer();
      })
    )
      .split(",")
      .map(Number);
    const selected = page.getByTestId("point-picked");
    await expect(selected).toBeVisible();
    await expect(page.getByTestId("point-answer-marker")).toHaveCount(0);
    await expect(page.getByText("Answer locked in")).toBeVisible();
    await expect(page.getByText(/Your selected point:/)).toHaveClass(/sr-only/);
    await page.evaluate(async () => {
      const path = "/browser-tests/point-answer.fixture.tsx";
      ((await import(path)) as typeof Fixture).changePointPerspective(3);
    });
    await expect(page.getByTestId("point-picked")).toHaveCount(0);
    await page.evaluate(async () => {
      const path = "/browser-tests/point-answer.fixture.tsx";
      ((await import(path)) as typeof Fixture).changePointPerspective(2);
    });
    await expect(page.getByTestId("point-picked")).toBeVisible();
    const dot = (await selected.boundingBox())!;
    expect(Math.abs(dot.x + dot.width / 2 - (rect.x + rect.width * 0.25))).toBeLessThan(1.5);
    expect(Math.abs(dot.y + dot.height / 2 - (rect.y + rect.height * 0.75))).toBeLessThan(1.5);
    await page.screenshot({
      path: info.outputPath(`${shape}-waiting.png`),
      animations: "disabled",
    });
    await page.evaluate(async () => {
      const path = "/browser-tests/point-answer.fixture.tsx";
      ((await import(path)) as typeof Fixture).revealPoint();
    });
    await expect(page.getByTestId("point-answer-marker")).toHaveCount(2);
    const image = page.getByTestId("point-picker").locator("img");
    await image.evaluate((el: HTMLImageElement) => el.decode());
    // Read all boxes in one browser task: oq-pop can scale between separate
    // Playwright round trips, even with reduced motion enabled.
    const geometry = await image.evaluate((img) => {
      const reveal = img.closest('[data-testid="answer-reveal"]')!;
      const box = (el: Element) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        image: box(img),
        section: box(reveal.querySelector('[data-testid="point-result-image"]')!),
        target: box(reveal.querySelector('[data-testid="point-target"]')!),
        first: box(reveal.querySelector('[data-testid="point-answer-dot"]')!),
      };
    });
    const { image: imageBox, section, target, first } = geometry;
    expect(imageBox.x + imageBox.width / 2).toBeCloseTo(section.x + section.width / 2, 0);
    expect(target.width).toBeCloseTo(imageBox.width * 0.3, 0);
    const markers = page.getByTestId("point-answer-marker");
    expect(
      Math.abs(first.x + first.width / 2 - (imageBox.x + imageBox.width * selectedX!)),
    ).toBeLessThan(1.5);
    expect(
      Math.abs(first.y + first.height / 2 - (imageBox.y + imageBox.height * selectedY!)),
    ).toBeLessThan(1.5);
    await expect(markers.first()).toContainText("user2");
    await expect(markers.last()).toContainText("user3");
    await page.screenshot({ path: info.outputPath(`${shape}-reveal.png`), animations: "disabled" });
    await page.evaluate(async () => {
      const path = "/browser-tests/point-answer.fixture.tsx";
      ((await import(path)) as typeof Fixture).restartPoint();
    });
    await expect(page.getByTestId("point-picker")).toBeVisible();
    await expect(page.getByTestId("point-picked")).toHaveCount(0);
  });
}

test("long point labels stay inside a narrow image at its edges", async ({
  page,
  context,
}, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/browser-tests/point-answer.fixture.tsx";
    ((await import(path)) as typeof Fixture).mountMarkerBounds();
  });
  const picture = page.getByTestId("point-picker").locator("img");
  await picture.evaluate((el: HTMLImageElement) => el.decode());
  const image = (await picture.boundingBox())!;
  const labels = page.getByTestId("point-answer-label");
  await expect(page.getByTestId("point-answer-marker")).toHaveCount(3);
  await expect(labels).toHaveCount(3);
  for (const id of [1, 2, 3]) {
    const box = (await labels.nth(id - 1).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(image.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(image.x + image.width + 0.5);
    expect(box.y).toBeGreaterThanOrEqual(image.y - 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(image.y + image.height + 0.5);
  }
  await expect(page.getByText(/WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW selected/).first()).toHaveClass(
    /sr-only/,
  );
  await page.screenshot({ path: info.outputPath("tall-edges.png"), animations: "disabled" });
});
