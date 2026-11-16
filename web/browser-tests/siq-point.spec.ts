import { expect, test } from "@playwright/test";
import type * as Fixture from "./siq-point.fixture";

for (const viewport of [
  { width: 1366, height: 884 },
  { width: 820, height: 1180 },
  { width: 375, height: 812 },
]) {
  test(`SIQ last-occurrence target and source ellipse survive import/decode/reveal ${viewport.width} (A11–A15)`, async ({
    page,
    context,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/");
    for (const index of [0, 1, 2]) {
      const imported = await page.evaluate(async (index) => {
        const path = "/browser-tests/siq-point.fixture.tsx";
        return ((await import(path)) as typeof Fixture).mountImportedPoint(index, true);
      }, index);
      expect(imported.actualAspect).toBe(2);
      expect(imported.sourceAspect).toBe(index === 2 ? 1 : 2);
      expect(imported.verdict).toBe(index === 2);
      expect(imported.targetOrder).toBe(imported.orders!.at(-1));
      const picker = page.getByTestId("point-picker");
      await picker.locator("img").evaluate((img: HTMLImageElement) => img.decode());
      const dimensions = await picker.evaluate((el) => {
        const img = el.querySelector("img")!.getBoundingClientRect();
        const target = el.querySelector('[data-testid="point-target"]')!.getBoundingClientRect();
        return {
          imageWidth: img.width,
          imageHeight: img.height,
          targetWidth: target.width,
          targetHeight: target.height,
        };
      });
      const d = index === 2 ? 0.02 : 0.05;
      const a = index === 2 ? 1 : 2;
      expect(dimensions.targetWidth).toBeCloseTo((dimensions.imageWidth * 2 * d) / a, 0);
      expect(dimensions.targetHeight).toBeCloseTo(dimensions.imageHeight * 2 * d, 0);
      if (index === 2)
        await page.screenshot({
          path: info.outputPath(`siq-xy-${viewport.width}.png`),
          animations: "disabled",
        });
    }
    await page.evaluate(async () => {
      const path = "/browser-tests/siq-point.fixture.tsx";
      await ((await import(path)) as typeof Fixture).mountImportedPoint(1, false);
    });
    const picker = page.getByTestId("point-picker");
    await picker.locator("img").evaluate((img: HTMLImageElement) => img.decode());
    await expect(page.getByTestId("point-target")).toHaveCount(0);
    await picker.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    const selected = await page.evaluate(async () => {
      const path = "/browser-tests/siq-point.fixture.tsx";
      return ((await import(path)) as typeof Fixture).pickedPoint();
    });
    expect(selected).toEqual({ x: 0.52, y: 0.5 });
  });
}
