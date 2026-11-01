import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import { makePng } from "../e2e/support/seed.mjs";
import { mixedHtmlPack } from "../e2e/support/htmlRemoval";
import type * as DraftStorage from "../src/features/package-editor/draftStorage";

test("worker import cancels without IndexedDB writes or running HTML", async ({
  page,
  context,
}) => {
  let sentinel = 0;
  page.on("request", (request) => {
    if (request.url().includes("/html-sentinel")) sentinel++;
  });
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.addInitScript(() => {
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        (window as unknown as { workerCount: number }).workerCount =
          ((window as unknown as { workerCount: number }).workerCount ?? 0) + 1;
      }
    };
  });
  await page.goto("/packages/editor");
  const count = () =>
    page.evaluate(async () => {
      const path = "/src/features/package-editor/draftStorage.ts";
      const storage = (await import(path)) as typeof DraftStorage;
      return (await storage.listDrafts()).length;
    });
  const before = await count();
  const input = {
    name: "mixed.siq",
    mimeType: "application/zip",
    buffer: mixedHtmlPack("Browser HTML", true),
  };
  const workersBefore = await page.evaluate(
    () => (window as unknown as { workerCount: number }).workerCount ?? 0,
  );
  await page.getByTestId("import-file").setInputFiles(input);
  await expect(page.getByRole("dialog")).toContainText("question 2");
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { workerCount: number }).workerCount ?? 0),
    )
    .toBeGreaterThan(workersBefore);
  await page.keyboard.press("Escape");
  expect(await count()).toBe(before);
  expect(sentinel).toBe(0);
  expect(
    await page.evaluate(() => (window as unknown as { htmlExecuted?: boolean }).htmlExecuted),
  ).toBeUndefined();
  await page.getByTestId("import-file").setInputFiles(input);
  await page.getByRole("button", { name: "Remove and continue" }).click();
  await expect(page.getByTestId("round-board")).toBeVisible();
  expect(await count()).toBe(before + 1);
  expect(sentinel).toBe(0);
});

test("ambiguous worker-inflated manifests are refused before approval", async ({
  page,
  context,
}) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/packages/editor");
  const padding = "x".repeat(600_000);
  const manifest = (count: number) =>
    `<package><!--${padding}--><rounds><round><themes><theme><questions>${'<question type="html"/>'.repeat(count)}<question><scenario><atom>safe</atom></scenario></question></questions></theme></themes></round></rounds></package>`;
  const archive = Buffer.from(
    zipSync({ "CONTENT.XML": strToU8(manifest(1)), "Content.Xml": strToU8(manifest(2)) }),
  );
  await page
    .getByTestId("import-file")
    .setInputFiles({ name: "aliases.siq", mimeType: "application/zip", buffer: archive });
  await expect(page.getByRole("alert")).toContainText("multiple conflicting package manifests");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("OQ import cancels on outside click and requires fresh approval", async ({
  page,
  context,
}) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/packages/editor");
  const content = {
    title: "OQ HTML",
    rounds: [
      {
        name: "Round",
        order: 0,
        themes: [
          {
            name: "Theme",
            order: 0,
            questions: [
              { type: "simple", order: 0, price: 100, text: "normal" },
              { type: "html", order: 1, price: 200 },
            ],
          },
        ],
      },
    ],
  };
  const archive = Buffer.from(zipSync({ "content.json": strToU8(JSON.stringify(content)) }));
  const input = { name: "mixed.oq", mimeType: "application/zip", buffer: archive };
  await page.getByTestId("import-file").setInputFiles(input);
  await expect(page.getByRole("dialog")).toContainText("question 2");
  await page.mouse.click(1, 1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("round-board")).toHaveCount(0);
  await page.getByTestId("import-file").setInputFiles(input);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Remove and continue" }).click();
  await expect(page.getByTestId("round-board")).toBeVisible();
  await expect(page.getByTestId("upload-warnings")).toContainText(
    "Unsupported HTML question removed",
  );
});

test("worker preflight keeps typed media when Html has the same path", async ({
  page,
  context,
}) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.addInitScript(() => {
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        (window as unknown as { workerCount: number }).workerCount =
          ((window as unknown as { workerCount: number }).workerCount ?? 0) + 1;
      }
    };
  });
  await page.goto("/packages/editor");
  const before = await page.evaluate(
    () => (window as unknown as { workerCount: number }).workerCount ?? 0,
  );
  const xml = `<package name="Collision"><!--${"x".repeat(600_000)}--><rounds><round name="R"><themes><theme name="T"><questions><question price="100"><scenario><atom>normal</atom><atom type="image">@Html/picture.png</atom></scenario><right><answer>A</answer></right></question></questions></theme></themes></round></rounds></package>`;
  const archive = Buffer.from(
    zipSync({
      "content.xml": strToU8(xml),
      "Images/Html/picture.png": new Uint8Array(makePng()),
      "Html/picture.png": strToU8("unrelated"),
    }),
  );
  await page
    .getByTestId("import-file")
    .setInputFiles({ name: "collision.siq", mimeType: "application/zip", buffer: archive });
  await expect(page.getByTestId("round-board")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("question-card")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { workerCount: number }).workerCount ?? 0),
    )
    .toBeGreaterThan(before);
});
