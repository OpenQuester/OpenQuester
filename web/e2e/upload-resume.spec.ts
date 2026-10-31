import { createHash } from "node:crypto";

import { expect, test, type Browser, type Page, type Route } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

import { expectNoHorizontalScroll, shot } from "./support/game";
import { makePng } from "./support/seed.mjs";

const md5 = (b: Uint8Array) => createHash("md5").update(b).digest("hex");

const shade = () => Math.floor(Math.random() * 256);

/**
 * A .siq with two small pictures (too small to be re-encoded, so their MD5s
 * stay as they are). Random colours keep them out of storage from earlier runs.
 */
function twoPicturePack(title: string, includeHtml = false) {
  const amber = new Uint8Array(makePng(24, 16, [shade(), shade(), shade()]));
  const teal = new Uint8Array(makePng(24, 16, [shade(), shade(), shade()]));
  const question = (price: number, file: string) => `
            <question price="${price}">
              <params><param name="question" type="content">
                <item>Which colour is this?</item>
                <item type="image" isRef="True">${file}</item>
              </param></params>
              <right><answer>A colour</answer></right>
            </question>`;
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<package name="${title}" version="5" language="en" xmlns="https://github.com/VladimirKhil/SI/blob/master/assets/siq_5.xsd">
  <rounds><round name="Round one"><themes><theme name="Colours"><questions>
    ${question(100, "amber.png")}
    ${question(200, "teal.png")}
    ${includeHtml ? '<question price="300" type="html"/>' : ""}
  </questions></theme></themes></round></rounds>
</package>`;
  const buffer = Buffer.from(
    zipSync({
      "content.xml": strToU8(xml),
      "Images/amber.png": amber,
      "Images/teal.png": teal,
    }),
  );
  return { buffer, uploaded: md5(amber), lost: md5(teal) };
}

async function signInAsAuthor(page: Page) {
  const res = await page.request.post("/v1/dev/login/1");
  expect(res.ok(), "dev login").toBeTruthy();
}

/**
 * Fails every storage upload of this file, as a dropped connection would.
 * Returns what puts the connection back.
 */
async function breakUploadsOf(page: Page, fileMd5: string, hold?: Promise<void>) {
  const matches = (url: URL) => url.pathname.includes(fileMd5);
  await page.route(matches, async (route: Route) => {
    if (route.request().method() !== "PUT") return route.continue();
    await hold;
    await route.abort("connectionreset");
  });
  return () => page.unroute(matches);
}

async function pickPackage(page: Page, buffer: Buffer) {
  await page.locator("#package-file").setInputFiles({
    name: "colours.siq",
    mimeType: "application/zip",
    buffer,
  });
}

/** Uploads the pack with its second picture failing; returns the new package id. */
async function uploadWithOneFileLost(page: Page, buffer: Buffer, lost: string): Promise<number> {
  const restore = await breakUploadsOf(page, lost);
  await page.goto("/packages/upload");
  await pickPackage(page, buffer);
  const created = createdPackageId(page);
  await page.getByRole("button", { name: "Upload package" }).click();
  const partial = page.getByTestId("upload-partial");
  await expect(partial).toContainText("1 of 2 media files are uploaded", { timeout: 30_000 });
  await restore();
  return created;
}

/** The id the server gives the package the page creates next. */
async function createdPackageId(page: Page): Promise<number> {
  const res = await page.waitForResponse(
    (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/v1/packages",
  );
  return (await res.json()).id as number;
}

async function newAuthorPage(browser: Browser, project: { use: object }) {
  const context = await browser.newContext(project.use);
  const page = await context.newPage();
  await signInAsAuthor(page);
  return page;
}

test.describe("unfinished uploads", () => {
  test("shows each file's progress, blocks hosting and resumes from this browser", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await signInAsAuthor(page);
    const title = `Half uploaded ${Date.now()}`;
    const { buffer, lost } = twoPicturePack(title);

    // Hold the lost file until the list shows the other one finished.
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    const restore = await breakUploadsOf(page, lost, hold);
    await page.goto("/packages/upload");
    await pickPackage(page, buffer);
    const created = createdPackageId(page);
    await page.getByRole("button", { name: "Upload package" }).click();
    const id = await created;

    const files = page.getByTestId("upload-file");
    await expect(files).toHaveCount(2, { timeout: 30_000 });
    await expect(page.locator('[data-testid="upload-file"][data-state="done"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="upload-file"][data-state="uploading"]')).toHaveCount(
      1,
    );
    await expectNoHorizontalScroll(page);
    await shot(page, `upload-files-${test.info().project.name}`);
    release();

    const partial = page.getByTestId("upload-partial");
    await expect(partial).toContainText("1 of 2 media files are uploaded", { timeout: 30_000 });
    await expect(partial).toContainText("nobody can start a game with it");
    await expectNoHorizontalScroll(page);
    await restore();

    // My packages says why it can't be hosted and offers to finish.
    await partial.getByRole("link", { name: "Finish later" }).click();
    const row = page.getByTestId("my-package").filter({ hasText: title });
    await expect(row).toContainText("Upload not finished");
    await expect(row.getByRole("link", { name: "Host", exact: true })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await shot(page, `upload-unfinished-row-${test.info().project.name}`);

    // Hosting is refused with the reason, by the page and by the server.
    await page.goto(`/games/new?packageId=${id}`);
    await expect(page.getByTestId("upload-unfinished")).toContainText("Finish the upload");
    await expect(page.getByRole("button", { name: "Create & open lobby" })).toBeDisabled();
    await expectNoHorizontalScroll(page);
    const refused = await page.request.post("/v1/games", {
      data: {
        title: "Too early",
        packageId: id,
        isPrivate: false,
        ageRestriction: "NONE",
        maxPlayers: 4,
      },
    });
    expect(refused.status()).toBe(409);
    expect((await refused.json()).error).toContain("1 of its 2 media files");

    // Others don't see it in the package list.
    const listed = await (
      await page.request.get(
        "/v1/packages?limit=50&offset=0&sortBy=id&order=desc&uploadStatus=ready",
      )
    ).json();
    expect(listed.data.map((p: { id: number }) => p.id)).not.toContain(id);

    // This browser kept the lost file, so resuming is one tap.
    await page.goto("/packages/mine");
    await page
      .getByTestId("my-package")
      .filter({ hasText: title })
      .getByRole("link", { name: "Finish upload" })
      .click();
    await expect(page.getByTestId("resume-summary")).toHaveText("1 of 2 media files are uploaded");
    const stash = page.getByTestId("resume-stash");
    await expect(stash).toContainText("still has the missing file");
    await expect(page.getByTestId("resume-pick")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await shot(page, `upload-resume-${test.info().project.name}`);
    await stash.getByRole("button", { name: "Upload 1 file" }).click();

    const done = page.getByTestId("resume-done");
    await expect(done).toContainText("All media is uploaded", { timeout: 30_000 });
    await expectNoHorizontalScroll(page);
    await done.getByRole("link", { name: "Host a game with this" }).click();
    await expect(page.getByTestId("upload-unfinished")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create & open lobby" })).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test("reconfirms a cleaned package when resuming on another device", async ({
    page,
    browser,
  }) => {
    await signInAsAuthor(page);
    const { buffer, lost } = twoPicturePack(`Clean resume ${Date.now()}`, true);
    const restore = await breakUploadsOf(page, lost);
    await page.goto("/packages/upload");
    await pickPackage(page, buffer);
    await page.getByRole("button", { name: "Remove and continue" }).click();
    const created = createdPackageId(page);
    await page.getByRole("button", { name: "Upload package" }).click();
    const id = await created;
    await expect(page.getByTestId("upload-partial")).toBeVisible({ timeout: 30000 });
    await restore();
    const other = await newAuthorPage(browser, test.info().project);
    await other.goto(`/packages/${id}/upload`);
    let mutations = 0;
    other.on("request", (request) => {
      if (["POST", "PUT"].includes(request.method())) mutations++;
    });
    await pickPackage(other, buffer);
    await expect(other.getByRole("dialog")).toContainText("question 3");
    await other.getByRole("button", { name: "Cancel" }).click();
    await expect(other.getByTestId("resume-pick")).toBeVisible();
    expect(mutations).toBe(0);
    await pickPackage(other, buffer);
    await other.getByRole("button", { name: "Remove and continue" }).click();
    await expect(other.getByTestId("resume-done")).toContainText("All media is uploaded", {
      timeout: 30000,
    });
    const state = await (await other.request.get(`/v1/packages/${id}/upload`)).json();
    expect(state.status).toBe("ready");
    await other.context().close();
  });
  test("resumes on another device by picking the same file", async ({ page, browser }) => {
    await signInAsAuthor(page);
    const { buffer, lost } = twoPicturePack(`Two devices ${Date.now()}`);
    const id = await uploadWithOneFileLost(page, buffer, lost);

    // A fresh browser has nothing stashed: it asks for the package file.
    const other = await newAuthorPage(browser, test.info().project);
    await other.goto(`/packages/${id}/upload`);
    await expect(other.getByTestId("resume-summary")).toHaveText("1 of 2 media files are uploaded");
    await expect(other.getByTestId("resume-stash")).toHaveCount(0);
    await expect(other.getByTestId("resume-pick")).toContainText("Pick the same .siq or .oq file");
    await expectNoHorizontalScroll(other);

    // A different package is refused before anything is changed.
    await pickPackage(other, twoPicturePack("Some other pack").buffer);
    await expect(other.getByRole("alert")).toContainText("You picked “Some other pack”");

    await pickPackage(other, buffer);
    await expect(other.getByTestId("resume-done")).toContainText("All media is uploaded", {
      timeout: 30_000,
    });
    const state = await (await other.request.get(`/v1/packages/${id}/upload`)).json();
    expect(state).toMatchObject({ status: "ready", totalFiles: 2, uploadedFiles: 2, missing: [] });
    await other.context().close();
  });

  test("warns about a package that's already uploaded and finishes it instead", async ({
    page,
  }) => {
    await signInAsAuthor(page);
    const { buffer, lost } = twoPicturePack(`Uploaded twice ${Date.now()}`);
    const id = await uploadWithOneFileLost(page, buffer, lost);

    // Picking the same file again points at the unfinished upload.
    await page.goto("/packages/upload");
    await pickPackage(page, buffer);
    const duplicates = page.getByTestId("upload-duplicates");
    await expect(duplicates).toContainText("This package is already on OpenQuester");
    const match = duplicates.getByTestId("upload-duplicate");
    await expect(match).toHaveCount(1);
    await expect(match).toContainText("Your upload");
    await expect(match).toContainText("Upload not finished");
    await expect(page.getByRole("button", { name: "Upload anyway" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await shot(page, `upload-duplicate-${test.info().project.name}`);

    await match.getByRole("button", { name: "Finish this upload" }).click();
    const done = page.getByTestId("upload-done");
    await expect(done).toContainText("Package uploaded", { timeout: 30_000 });
    await done.getByRole("link", { name: "View package" }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]id=${id}\\b`));

    // Once finished, the same file offers the existing package to open, with no copy made.
    await page.goto("/packages/upload");
    await pickPackage(page, buffer);
    const again = page.getByTestId("upload-duplicate");
    await expect(again).toHaveCount(1);
    await expect(again).not.toContainText("Upload not finished");
    await expect(again.getByRole("link", { name: "Open it" })).toBeVisible();
  });
});
