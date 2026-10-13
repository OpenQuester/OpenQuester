import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

import { expectNoHorizontalScroll, shot, signInAsGuest } from "./support/game";
import { makePng } from "./support/seed.mjs";

/** A SIGame format 5 pack: a picture question, a cat in a bag, a broken reference and a final. */
function siqFile(title: string): Buffer {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<package name="${title}" version="5" language="en" xmlns="https://github.com/VladimirKhil/SI/blob/master/assets/siq_5.xsd">
  <rounds>
    <round name="Round one">
      <themes>
        <theme name="Colours">
          <questions>
            <question price="100">
              <params>
                <param name="question" type="content">
                  <item>Which colour is this?</item>
                  <item type="image" isRef="True">amber square.png</item>
                </param>
              </params>
              <right><answer>Amber</answer></right>
            </question>
            <question price="200" type="secret">
              <params><param name="question" type="content"><item>Cat in a bag: name a primary colour.</item></param></params>
              <right><answer>Red</answer></right>
            </question>
            <question price="300">
              <params><param name="question" type="content"><item type="image" isRef="True">lost.png</item></param></params>
              <right><answer>Nothing</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
    <round name="Final" type="final">
      <themes>
        <theme name="Science">
          <questions>
            <question price="0">
              <params><param name="question" type="content"><item>Name the closest star.</item></param></params>
              <right><answer>The Sun</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`;
  const zip = zipSync({
    "content.xml": strToU8(xml),
    "Images/amber%20square.png": new Uint8Array(makePng()),
  });
  return Buffer.from(zip);
}

/** Guests can't upload; the dev-only login (ENV=dev) gives a full account in this browser. */
async function signInAsAuthor(page: Page) {
  const res = await page.request.post("/v1/dev/login/1");
  expect(res.ok(), "dev login").toBeTruthy();
}

test.describe("package upload", () => {
  test("a .siq file is read, reviewed and uploaded with its media", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await signInAsAuthor(page);
    const title = `Uploaded pack ${Date.now()}`;

    await page.goto("/packages");
    await page.getByRole("link", { name: "Upload package" }).click();
    await expect(page.getByRole("heading", { name: "Upload a package" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose a file" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await shot(page, `upload-pick-${test.info().project.name}`);

    await page.locator("#package-file").setInputFiles({
      name: "pub-quiz.siq",
      mimeType: "application/zip",
      buffer: siqFile(title),
    });

    const review = page.getByTestId("upload-review");
    await expect(review.getByRole("heading", { name: title })).toBeVisible();
    // The question whose only picture is missing is skipped, and the page says why.
    await expect(review.getByText("3 questions")).toBeVisible();
    await expect(review.getByText(/^1 media file/)).toBeVisible();
    const warnings = page.getByTestId("upload-warnings");
    await expect(warnings).toContainText("2 things were adjusted while reading");
    await expect(warnings).toContainText("Images/lost.png isn't in the archive");
    await expect(warnings).toContainText("Question has no text or media, so it was skipped.");
    await expect(review.getByText("1 final themes")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await shot(page, `upload-review-${test.info().project.name}`);

    await page.getByRole("button", { name: "Upload package" }).click();
    const done = page.getByTestId("upload-done");
    await expect(done.getByText("Package uploaded")).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalScroll(page);
    await shot(page, `upload-done-${test.info().project.name}`);

    // The package is real: its picture is in storage and a game can be hosted with it.
    await done.getByRole("link", { name: "View package" }).click();
    const details = page.getByTestId("package-details");
    await expect(details.getByRole("heading", { name: title })).toBeVisible();
    await expect(details).toContainText("Has images");
    const id = Number(new URL(page.url()).searchParams.get("id"));
    const pkg = await (await page.request.get(`/v1/packages/${id}`)).json();
    const question = pkg.rounds[0].themes[0].questions.find(
      (q: { price: number }) => q.price === 100,
    );
    const link: string = question.questionFiles[0].file.link;
    const media = await page.request.get(link);
    expect(media.status(), "uploaded picture is downloadable").toBe(200);
    expect(
      pkg.rounds[0].themes[0].questions.find((q: { price: number }) => q.price === 200),
    ).toMatchObject({
      type: "secret",
    });
    expect(pkg.rounds[1].type).toBe("final");

    await details.getByRole("link", { name: "Host a game with this" }).click();
    await expect(page).toHaveURL(new RegExp(`/games/new\\?packageId=${id}`));
    expect(errors).toEqual([]);
  });

  test("a file that isn't a package gets a clear reason", async ({ page }) => {
    await signInAsAuthor(page);
    await page.goto("/packages/upload");
    await page.locator("#package-file").setInputFiles({
      name: "notes.siq",
      mimeType: "application/zip",
      buffer: Buffer.from("definitely not a zip"),
    });
    await expect(page.getByRole("alert")).toHaveText(
      "This file is damaged or isn't a package archive.",
    );
    await page.locator("#package-file").setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: makePng(),
    });
    await expect(page.getByRole("alert")).toHaveText("That isn't a .siq or .oq file.");
  });

  test("guests are told why they can't upload", async ({ page }) => {
    await signInAsGuest(page, "Guest uploader", "/packages/upload");
    await expect(page.getByTestId("upload-guest")).toContainText(
      "Guest accounts can't upload packages",
    );
    await expect(page.locator("#package-file")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
