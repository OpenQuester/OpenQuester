import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalScroll, shot } from "./support/game";
import { makePng } from "./support/seed.mjs";

/** A fresh full account per test (dev-only login), so "my packages" are only this test's. */
async function signInAsNewAuthor(page: Page): Promise<number> {
  const num = 10_000 + Math.floor(Math.random() * 1_000_000);
  const res = await page.request.post(`/v1/dev/login/${num}`);
  expect(res.ok(), "dev login").toBeTruthy();
  const me = await (await page.request.get("/v1/me")).json();
  return me.id as number;
}

/** Publishes a small package with one picture straight through the API. */
async function publishPackage(page: Page, title: string): Promise<number> {
  const png = makePng(64, 36, [80, 140, 255]);
  const md5 = createHash("md5").update(png).digest("hex");
  const q = (order: number, price: number, text: string, answerText: string, extra = {}) => ({
    type: "simple",
    order,
    price,
    text,
    answerText,
    showAnswerDuration: 5000,
    ...extra,
  });
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
                name: "Colours",
                order: 0,
                questions: [
                  q(0, 100, "Which colour is this?", "Blue", {
                    questionFiles: [{ file: { md5, type: "image" }, order: 0, displayTime: 5000 }],
                  }),
                  q(1, 200, "Colour of grass", "Green"),
                ],
              },
            ],
          },
        ],
      },
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const { id, uploadLinks } = await res.json();
  const put = await page.request.put(uploadLinks[md5], {
    headers: {
      "content-md5": createHash("md5").update(png).digest("base64"),
      "if-none-match": "*",
      "content-type": "image/png",
    },
    data: png,
  });
  // 412: another test already stored these exact bytes.
  expect([200, 201, 204, 412], "picture stored").toContain(put.status());
  return id as number;
}

test.describe("my packages", () => {
  test("an author edits a published package in place and deletes it", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await signInAsNewAuthor(page);
    const title = `Mine ${Date.now()}`;
    const id = await publishPackage(page, title);

    await page.goto("/packages");
    await page.getByRole("link", { name: "My packages" }).click();
    const row = page.getByTestId("my-package");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(title);
    await expectNoHorizontalScroll(page);
    await shot(page, `my-packages-${test.info().project.name}`);

    // Edit opens the published package in the editor, picture shown from storage.
    await row.getByTestId("my-package-edit").click();
    await expect(page.getByTestId("round-board")).toBeVisible();
    await page.getByTestId("density-cards").click();
    await expect(page.getByTestId("theme-row").first().locator("img")).toBeVisible();
    await page.getByTestId("question-card").nth(1).dblclick();
    await page.getByTestId("question-dialog").getByLabel("Correct answer").fill("Grass green");
    await page.getByTestId("question-save").click();

    await page.getByTestId("publish").click();
    await expect(page.getByTestId("publish-confirm")).toHaveText(
      "Save changes to the published package",
    );
    await page.getByTestId("publish-confirm").click();
    await expect(page.getByTestId("publish-done")).toBeVisible({ timeout: 30_000 });

    // Same package id, new content, picture still there.
    const pkg = await (await page.request.get(`/v1/packages/${id}`)).json();
    const questions = pkg.rounds[0].themes[0].questions;
    expect(questions.find((q: { price: number }) => q.price === 200).answerText).toBe(
      "Grass green",
    );
    const link = questions.find((q: { price: number }) => q.price === 100).questionFiles[0].file
      .link;
    expect((await page.request.get(link)).status()).toBe(200);

    // Delete from My packages, with a confirmation step.
    await page.goto("/packages/mine");
    await page.getByTestId("my-package-delete").click();
    await page.getByTestId("my-package-delete-confirm").click();
    await expect(page.getByTestId("my-packages-empty")).toBeVisible();
    expect((await page.request.get(`/v1/packages/${id}`)).status()).toBe(404);
    expect(errors).toEqual([]);
  });

  test("someone else's package can't be overwritten", async ({ page }) => {
    await signInAsNewAuthor(page);
    const id = await publishPackage(page, `Not yours ${Date.now()}`);
    await signInAsNewAuthor(page);
    const res = await page.request.put(`/v1/packages/${id}`, {
      data: {
        content: {
          title: "Hijacked",
          ageRestriction: "NONE",
          tags: [],
          rounds: [],
        },
      },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("profile and packages list", () => {
  test("changing the profile photo stores it and shows it", async ({ page }) => {
    await signInAsNewAuthor(page);
    await page.goto("/settings");
    await page.locator("#avatar-file").setInputFiles({
      name: "me.png",
      mimeType: "image/png",
      buffer: makePng(300, 200, [240, 90, 120]),
    });
    await expect(page.getByText("Photo updated")).toBeVisible({ timeout: 20_000 });
    const me = await (await page.request.get("/v1/me")).json();
    expect(me.avatar, "avatar link").toBeTruthy();
    expect((await page.request.get(me.avatar)).status()).toBe(200);
    await expect(page.locator("main img").first()).toHaveAttribute("src", me.avatar);
    await expectNoHorizontalScroll(page);
  });

  test("filters narrow the list and say how many are on", async ({ page }) => {
    const myId = await signInAsNewAuthor(page);
    await publishPackage(page, `Filter me ${Date.now()}`);
    await page.goto("/packages");
    await page.getByRole("button", { name: "More filters" }).click();
    await expect(page.getByTestId("package-filters")).toBeVisible();
    await page.getByLabel("Only my packages").check();
    await expect(page.getByRole("button", { name: /Fewer filters/ })).toContainText("1");
    await expect(page.getByTestId("package-tile")).toHaveCount(1);
    await page.locator("#pk-rounds-min").fill("5");
    await expect(page.getByText("No packages match")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByLabel("Only my packages")).not.toBeChecked();
    await expectNoHorizontalScroll(page);
    expect(myId).toBeGreaterThan(0);
  });

  test("the admin page explains when you aren't an admin", async ({ page }) => {
    await signInAsNewAuthor(page);
    await page.goto("/admin");
    await expect(page.getByTestId("admin-no-access")).toContainText("This page is for admins.");
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });
});
