import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

import { expectNoHorizontalScroll, shot } from "./support/game";
import { makePng } from "./support/seed.mjs";

/** e2e/stack/server.env lists this dev account in ADMIN_EMAILS. */
const ADMIN_DEV_NUM = 990001;
const MB = 1024 * 1024;

async function devLogin(page: Page, num: number) {
  const res = await page.request.post(`/v1/dev/login/${num}`);
  expect(res.ok(), "dev login").toBeTruthy();
}

/** An .oq with one picture that stays well over 1 KB after compression. */
function pictureOq(title: string): Buffer {
  const png = new Uint8Array(makePng(800, 600, [200, 60, 90]));
  // Noise defeats compression so the file keeps a predictable size.
  for (let i = 60; i < png.length - 20; i += 7) png[i] = (i * 31) & 0xff;
  const content = (hash: string) => ({
    title,
    ageRestriction: "NONE",
    language: "en",
    tags: [],
    rounds: [
      {
        name: "Round",
        order: 0,
        type: "simple",
        themes: [
          {
            name: "Theme",
            order: 0,
            questions: [
              {
                type: "simple",
                order: 0,
                price: 100,
                text: "What colour?",
                answerText: "Red",
                showAnswerDuration: 5000,
                questionFiles: [
                  { file: { md5: hash, type: "image" }, order: 0, displayTime: 5000 },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const hash = createHash("md5").update(png).digest("hex");
  return Buffer.from(
    zipSync({ "content.json": strToU8(JSON.stringify(content(hash))), [`files/${hash}`]: png }),
  );
}

async function setPlayerPackageLimit(page: Page, bytes: number | null) {
  const res = await page.request.put("/v1/admin/api/storage/groups/user", {
    data: {
      userQuotaBytes: 1024 * MB,
      packageBytes: bytes,
      imageBytes: 10 * MB,
      audioBytes: 20 * MB,
      videoBytes: 100 * MB,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.describe("storage limits", () => {
  test("My packages shows how much of your storage is used", async ({ page }) => {
    await devLogin(page, 300_000 + Math.floor(Math.random() * 600_000));
    await page.goto("/packages/mine");
    const meter = page.getByTestId("storage-meter");
    await expect(meter).toContainText("Storage");
    await expect(meter).toContainText(/of 1\.00 GB used/);
    await expectNoHorizontalScroll(page);
    await shot(page, `storage-mine-${test.info().project.name}`);
  });

  test("an admin lowers a group's limit and an upload over it says why", async ({ browser }) => {
    test.skip(test.info().project.name !== "desktop", "flow test; the meter covers layouts");
    const admin = await (await browser.newContext()).newPage();
    const author = await (await browser.newContext()).newPage();
    await devLogin(admin, ADMIN_DEV_NUM);
    await devLogin(author, 300_000 + Math.floor(Math.random() * 600_000));

    try {
      // The admin sets "One package" for players to 1 KB in the Storage tab.
      await admin.goto("/admin");
      await admin.getByRole("tab", { name: "Storage" }).click();
      const players = admin.getByTestId("storage-group-user");
      await expect(players).toContainText("Players");
      const field = players.getByLabel("One package");
      await expect(field).toHaveValue("500");
      await field.fill("0.001");
      await players.getByRole("button", { name: "Save" }).click();
      await expect(players.getByText("Saved")).toBeVisible();
      await shot(admin, "admin-storage-desktop");

      await author.goto("/packages/upload");
      await author.locator("#package-file").setInputFiles({
        name: "picture.oq",
        mimeType: "application/zip",
        buffer: pictureOq(`Too big ${Date.now()}`),
      });
      // Keep the picture as it is so its size is known.
      await author.getByTestId("compress-toggle").getByRole("checkbox").uncheck();
      await author.getByRole("button", { name: "Upload package" }).click();
      await expect(author.getByTestId("upload-failed")).toContainText(
        "the limit for one package is 1 KB",
      );
    } finally {
      await setPlayerPackageLimit(admin, 500 * MB);
    }

    // With the default back, the same upload goes through.
    await author.getByRole("button", { name: "Try again" }).click();
    await expect(author.getByTestId("upload-done")).toBeVisible({ timeout: 30_000 });
    await author.goto("/packages/mine");
    await expect(author.getByTestId("storage-meter")).not.toContainText("0 B of");
  });
});
