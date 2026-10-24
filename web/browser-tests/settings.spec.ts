import { expect, test } from "@playwright/test";

for (const saved of [
  "null",
  '{"theme":123,"language":{},"volume":90,"sound":"no","pins":{"chat":"false"}}',
]) {
  test(`starts with malformed persisted settings: ${saved}`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    await context.addInitScript((saved) => localStorage.setItem("oq.settings", saved), saved);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
    const settings = await page.evaluate(async () => {
      const path = "/src/features/settings/settingsStore.ts";
      const { useSettings } = await import(path);
      const { volume, sound, pins } = useSettings.getState();
      return { volume, sound, pins };
    });
    expect(settings.volume).toBeGreaterThanOrEqual(0);
    expect(settings.volume).toBeLessThanOrEqual(1);
    expect(settings.sound).toBe(true);
    expect(settings.pins.chat).toBe(false);
    expect(errors).toEqual([]);
  });
}
