import { expect, test } from "@playwright/test";
import type * as Fixture from "./showman-instruction.fixture";

for (const final of [false, true]) {
  for (const [role, id] of [
    ["showman", 1],
    ["player", 2],
    ["spectator", 4],
  ] as const) {
    test(`${final ? "final" : "regular"} instruction stays above long content for ${role}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 375, height: 900 });
      await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
      await page.goto("/");
      await page.evaluate(
        async ({ id, final }) => {
          const path = "/browser-tests/showman-instruction.fixture.tsx";
          ((await import(path)) as typeof Fixture).mountInstruction(id, final);
        },
        { id, final },
      );
      const instruction = page.getByTestId("showman-instruction");
      const text = page.getByTestId("question-text");
      await expect(text).toBeVisible();
      if (role === "showman") {
        await expect(instruction).toBeVisible();
        expect(await instruction.textContent()).toContain("FIRST LINE\nSECOND LINE");
        expect(await instruction.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe(
          "pre-wrap",
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          375,
        );
        const bounds = (await instruction.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
        expect((await instruction.boundingBox())!.y).toBeLessThan((await text.boundingBox())!.y);
        expect((await instruction.boundingBox())!.y).toBeLessThan(900);
      } else await expect(instruction).toHaveCount(0);
    });
  }
}
