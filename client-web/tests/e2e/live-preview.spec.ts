import { expect, test } from "@playwright/test";

const livePreview = process.env.PLAYWRIGHT_BASE_URL;

test.describe("deployed preview", () => {
  test.skip(!livePreview, "Set PLAYWRIGHT_BASE_URL to test a deployed preview");

  test("package discovery loads real API data at target widths", async ({
    page,
  }, testInfo) => {
    const failedRequests: string[] = [];
    page.on("requestfailed", (request) => failedRequests.push(request.url()));

    for (const viewport of [
      { name: "mobile", width: 360, height: 800 },
      { name: "tablet", width: 768, height: 900 },
      { name: "desktop", width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/packages", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: "Question packages" }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page.locator('a[href^="/packages/"]').first()).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`packages-${viewport.name}.png`),
        fullPage: true,
      });
    }

    expect(failedRequests).toEqual([]);
  });

  test("auth, branded selects, and the mobile editor remain usable", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/sign-in", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("sign-in-mobile.png"),
      fullPage: true,
    });

    await page.route("**/v1/me", (route) =>
      route.fulfill({
        json: {
          id: 7,
          username: "web_player",
          name: "Web Player",
          avatar: null,
          isGuest: false,
        },
      }),
    );
    await page.goto("/settings", { waitUntil: "networkidle" });
    await page.getByLabel("Theme").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option", { name: "Pure dark" })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("settings-select-mobile.png"),
    });
    await page.keyboard.press("Escape");

    await page.goto("/editor/new", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Untitled package").fill("Browser package");
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("editor-mobile.png"),
      fullPage: true,
    });
  });
});
