import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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

/** 16-bit mono PCM: a few seconds of tones, big enough to be worth compressing. */
function makeWav(seconds = 3, rate = 44_100): Uint8Array {
  const samples = seconds * rate;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    buf.writeInt16LE(
      Math.round(8000 * Math.sin((2 * Math.PI * (330 + (i % rate) / 200) * i) / rate)),
      44 + i * 2,
    );
  return new Uint8Array(buf);
}

/** An .oq with a big picture, a WAV and an H.264 clip, all of which the browser can shrink. */
function mediaOq(title: string) {
  const files = {
    image: new Uint8Array(makePng(1920, 1080, [40, 90, 200])),
    audio: makeWav(),
    video: new Uint8Array(readFileSync(new URL("./fixtures/clip-h264.mp4", import.meta.url))),
  };
  const md5 = (b: Uint8Array) => createHash("md5").update(b).digest("hex");
  const q = (order: number, type: "image" | "audio" | "video") => ({
    type: "simple",
    order,
    price: (order + 1) * 100,
    text: `A ${type} question`,
    answerText: type,
    showAnswerDuration: 5000,
    questionFiles: [{ file: { md5: md5(files[type]), type }, order: 0, displayTime: 5000 }],
  });
  const content = {
    title,
    ageRestriction: "NONE",
    language: "en",
    tags: [],
    rounds: [
      {
        name: "Media",
        order: 0,
        type: "simple",
        themes: [
          { name: "Mixed", order: 0, questions: [q(0, "image"), q(1, "audio"), q(2, "video")] },
        ],
      },
    ],
  };
  const zip: Record<string, Uint8Array> = { "content.json": strToU8(JSON.stringify(content)) };
  for (const b of Object.values(files)) zip[`files/${md5(b)}`] = b;
  return { buffer: Buffer.from(zipSync(zip)), originals: Object.values(files).map(md5) };
}

test.describe("media compression", () => {
  test("pictures, sound and video are re-encoded before upload", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await signInAsAuthor(page);
    await page.goto("/packages/upload");
    const title = `Compressed pack ${Date.now()}`;
    const { buffer, originals } = mediaOq(title);
    await page.locator("#package-file").setInputFiles({
      name: "media.oq",
      mimeType: "application/zip",
      buffer,
    });
    const review = page.getByTestId("upload-review");
    await expect(review.getByRole("heading", { name: title })).toBeVisible();
    const toggle = page.getByTestId("compress-toggle").getByRole("checkbox");
    await expect(toggle).toBeChecked();
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "Upload package" }).click();
    const done = page.getByTestId("upload-done");
    await expect(done.getByText("Package uploaded")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("upload-savings")).toContainText("Media compressed from");
    await shot(page, `upload-compressed-${test.info().project.name}`);

    await done.getByRole("link", { name: "View package" }).click();
    const id = Number(new URL(page.url()).searchParams.get("id"));
    const pkg = await (await page.request.get(`/v1/packages/${id}`)).json();
    const questions = pkg.rounds[0].themes[0].questions as {
      price: number;
      questionFiles: { file: { md5: string; link: string } }[];
    }[];
    const expected: Record<number, string> = {
      100: "image/avif",
      200: "audio/webm",
      300: "video/webm",
    };
    for (const q of questions) {
      const file = q.questionFiles[0].file;
      expect(originals, "the content points at the re-encoded file").not.toContain(file.md5);
      const res = await page.request.get(file.link);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe(expected[q.price]);
    }
    expect(errors).toEqual([]);
  });
});
