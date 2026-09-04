import { expect, test, type Page } from "@playwright/test";

const session = {
  id: 7,
  username: "web_player",
  name: "Web Player",
  avatar: null,
  isGuest: false,
};

async function mockApi(page: Page, authenticated = false) {
  await page.route("**/v1/me", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({ json: session });
      return;
    }
    await route.fulfill(
      authenticated
        ? { json: session }
        : {
            status: 401,
            contentType: "application/json",
            body: '{"error":"access_denied"}',
          },
    );
  });
  await page.route("**/v1/games?**", (route) =>
    route.fulfill({ json: { data: [], pageInfo: { total: 0 } } }),
  );
  await page.route("**/v1/packages?**", (route) =>
    route.fulfill({ json: { data: [], pageInfo: { total: 0 } } }),
  );
}

test("public discovery and sign-in remain usable", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your next game" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue as guest" }),
  ).toBeDisabled();
  await page.getByLabel("Display name").fill("Quiz Guest");
  await expect(
    page.getByRole("button", { name: "Continue as guest" }),
  ).toBeEnabled();
});

test("authenticated creator can open editor and switch settings", async ({
  page,
}) => {
  await mockApi(page, true);
  await page.goto("/editor/new");
  await expect(page.getByPlaceholder("Untitled package")).toBeVisible();
  await page.getByPlaceholder("Untitled package").fill("Browser package");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Choose image" }),
  ).toBeVisible();
  await page.getByLabel("Theme").click();
  await page.getByRole("option", { name: "Pure dark" }).click();
  await page.getByLabel("Default board layout").click();
  await page.getByRole("option", { name: "Matrix" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "pure-dark");
});

test("primary actions stay visible at target breakpoints", async ({ page }) => {
  await mockApi(page, true);
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 768, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Create game" }).first(),
    ).toBeVisible();
  }
});
