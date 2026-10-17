import { expect, test, type Page } from "@playwright/test";

import {
  expectNoHorizontalScroll,
  hostGame,
  joinByLink,
  person,
  shot,
  signInAsGuest,
} from "./support/game";

/** e2e/stack/server.env lists this dev account in ADMIN_EMAILS. */
const ADMIN_DEV_NUM = 990001;

async function devLogin(page: Page, num: number): Promise<{ id: number; username: string }> {
  const res = await page.request.post(`/v1/dev/login/${num}`);
  expect(res.ok(), "dev login").toBeTruthy();
  const me = await (await page.request.get("/v1/me")).json();
  return { id: me.id, username: me.username };
}

/** A tiny package published straight through the API by whoever is signed in. */
async function publishPackage(page: Page, title: string): Promise<number> {
  const res = await page.request.post("/v1/packages", {
    data: {
      content: {
        title,
        language: "en",
        ageRestriction: "NONE",
        tags: [],
        rounds: [
          {
            name: "Round one",
            order: 0,
            type: "simple",
            themes: [
              {
                name: "Basics",
                order: 0,
                questions: [
                  {
                    type: "simple",
                    order: 0,
                    price: 100,
                    text: "Two plus two",
                    answerText: "Four",
                    showAnswerDuration: 5000,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).id as number;
}

const desktop = { viewport: { width: 1280, height: 800 } };

test("an admin makes a moderator, who removes a player, closes a live game and deletes a package", async ({
  browser,
}) => {
  test.skip(test.info().project.name !== "desktop", "flow test; layout is covered below");
  const admin = await person(browser, "Admin", desktop);
  const mod = await person(browser, "Mod", desktop);
  const host = await person(browser, "Hana", desktop);
  const pat = await person(browser, "Pat", desktop);

  await devLogin(admin.page, ADMIN_DEV_NUM);
  const candidate = await devLogin(mod.page, 100_000 + Math.floor(Math.random() * 800_000));

  // The admin gives the candidate the moderator role from the Users tab.
  await admin.page.goto("/admin");
  await expect(admin.page.getByTestId("admin-my-role")).toHaveText("Admin");
  await admin.page.getByRole("tab", { name: "Users" }).click();
  await admin.page.getByLabel("Search by name, username or email").fill(candidate.username);
  const row = admin.page.getByTestId("admin-user").filter({ hasText: `#${candidate.id} ·` });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Role…" }).click();
  const editor = row.getByTestId("staff-editor");
  await editor.getByLabel("Role", { exact: true }).selectOption("moderator");
  await expect(editor.getByLabel("Ban and unban")).toBeChecked();
  await expect(editor.getByLabel("Change roles and permissions")).not.toBeChecked();
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toHaveCount(0);
  await expect(row).toContainText("Moderator");
  await shot(admin.page, "admin-users-desktop");

  // The moderator sees the moderation tabs, but not System.
  await mod.page.goto("/admin");
  await expect(mod.page.getByTestId("admin-my-role")).toHaveText("Moderator");
  for (const tab of ["Overview", "Users", "Packages", "Games"])
    await expect(mod.page.getByRole("tab", { name: tab })).toBeVisible();
  await expect(mod.page.getByRole("tab", { name: "System" })).toHaveCount(0);

  // ...and can't act on the admin.
  await mod.page.getByRole("tab", { name: "Users" }).click();
  await mod.page.getByLabel("Search by name, username or email").fill("dev-user-990001");
  const adminRow = mod.page.getByTestId("admin-user").filter({ hasText: "Admin" });
  await expect(adminRow).toHaveCount(1);
  await expect(adminRow.getByRole("button")).toHaveCount(0);

  // A live game: Hana hosts, Pat joins.
  await signInAsGuest(host.page, "Hana");
  const title = `Moderated ${Date.now()}`;
  const code = await hostGame(host.page, title);
  await joinByLink(pat.page, code, "Pat", "player");

  await mod.page.getByRole("tab", { name: "Games" }).click();
  await mod.page.getByLabel("Search games by title").fill(title);
  const game = mod.page.locator(`[data-testid="admin-game"][data-game-id="${code}"]`);
  await expect(game).toBeVisible();
  await game.getByRole("button", { name: "Manage" }).click();
  const people = game.getByTestId("admin-game-player");
  await expect(people).toHaveCount(2);
  await shot(mod.page, "admin-games-desktop");

  // Remove Pat: Pat is sent home and told why, Hana sees Pat leave.
  await game.getByRole("button", { name: "Remove Pat" }).click();
  await game.getByRole("button", { name: "Confirm remove" }).click();
  await expect(pat.page.getByText("You were removed from the game.")).toBeVisible();
  const patRow = people.filter({ hasText: "Pat" });
  await expect(patRow).toContainText("Left or offline");
  await expect(patRow.getByRole("button")).toHaveCount(0);

  // Close the game: Hana is sent home with the reason, the game is gone.
  await game.getByRole("button", { name: "Close game" }).click();
  await game.getByRole("button", { name: "Confirm: close for everyone" }).click();
  await expect(host.page.getByText("A moderator closed the game.")).toBeVisible();
  await expect(game).toHaveCount(0);
  expect((await mod.page.request.get(`/v1/games/${code}`)).status()).toBe(404);

  // Packages: the moderator deletes someone else's package.
  const pkgTitle = `Spam ${Date.now()}`;
  await devLogin(pat.page, 100_000 + Math.floor(Math.random() * 800_000));
  const pkgId = await publishPackage(pat.page, pkgTitle);
  await mod.page.getByRole("tab", { name: "Packages" }).click();
  await mod.page.getByLabel("Search by title").fill(pkgTitle);
  const pkg = mod.page.getByTestId("admin-package").filter({ hasText: pkgTitle });
  await expect(pkg).toHaveCount(1);
  // Editing other people's packages stays an admin permission by default.
  await expect(pkg.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await pkg.getByRole("button", { name: `Delete ${pkgTitle}` }).click();
  await pkg.getByRole("button", { name: "Confirm delete" }).click();
  await expect(pkg).toHaveCount(0);
  expect((await mod.page.request.get(`/v1/packages/${pkgId}`)).status()).toBe(404);

  for (const p of [admin, mod, host, pat]) {
    expect(p.errors).toEqual([]);
    await p.context.close();
  }
});

test("every admin tab fits the screen", async ({ page }) => {
  await devLogin(page, ADMIN_DEV_NUM);
  await page.goto("/admin");
  for (const tab of ["Overview", "Users", "Packages", "Games", "System"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByText("Loading…")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  }
  await page.getByRole("tab", { name: "Users" }).click();
  await page.getByRole("button", { name: "Role…" }).first().click();
  await expect(page.getByTestId("staff-editor")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, `admin-role-editor-${test.info().project.name}`);
});
