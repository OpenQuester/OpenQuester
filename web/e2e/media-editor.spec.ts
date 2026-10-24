import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

test("accepted image survives publish interruption and resumes with the reviewed bytes", async ({
  page,
}) => {
  expect((await page.request.post("/v1/dev/login/1")).ok()).toBe(true);
  await page.goto("/packages/editor");
  // A noisy image stays above the optimizer's minimum size even after encoding.
  const bytes = Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 320;
      const ctx = canvas.getContext("2d")!,
        data = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < data.data.length; i += 4) {
        data.data[i] = Math.random() * 256;
        data.data[i + 1] = Math.random() * 256;
        data.data[i + 2] = Math.random() * 256;
        data.data[i + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
      return [...new Uint8Array(await blob.arrayBuffer())];
    }),
  );
  const originalHash = createHash("md5").update(bytes).digest("hex");
  const content = {
    title: `Reviewed media ${Date.now()}`,
    ageRestriction: "NONE",
    tags: [],
    rounds: [
      {
        name: "Round",
        type: "simple",
        order: 0,
        themes: [
          {
            name: "Media",
            order: 0,
            questions: [
              {
                type: "simple",
                order: 0,
                price: 100,
                text: "What is this?",
                answerText: "Noise",
                showAnswerDuration: 5000,
                questionFiles: [
                  { file: { md5: originalHash, type: "image" }, order: 0, displayTime: 5000 },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  await page.getByTestId("import-file").setInputFiles({
    name: "media.oq",
    mimeType: "application/zip",
    buffer: Buffer.from(
      zipSync({
        "content.json": strToU8(JSON.stringify(content)),
        [`files/${originalHash}`]: bytes,
      }),
    ),
  });
  await page.getByTestId("question-card").first().press("Control+Enter");
  const form = page.getByTestId("question-dialog");
  await form.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByTestId("media-editor");
  await editor.getByRole("button", { name: "Rotate right", exact: true }).click();
  // Wait for the rotated, encoded preview; Save can still reflect the previous render.
  await expect(editor.getByRole("status")).toHaveText(/320 × 480 · \d+ KB/, {
    timeout: 30000,
  });
  await expect(editor.getByTestId("media-save")).toBeEnabled({ timeout: 30000 });
  // This shortcut must save only media, leaving the parent question open.
  await editor.getByTestId("media-save").press("Control+Enter");
  await expect(editor).toBeHidden();
  await expect(form).toBeVisible();
  const reviewed = Buffer.from(
    await form
      .locator("img")
      .first()
      .evaluate(async (el: HTMLImageElement) => [
        ...new Uint8Array(await (await fetch(el.src)).arrayBuffer()),
      ]),
  );
  expect(reviewed.length).toBeGreaterThan(8192);
  const hash = createHash("md5").update(reviewed).digest("hex");
  expect(hash).not.toBe(originalHash);
  await page.getByTestId("question-save").click();
  const storage = (url: URL) => url.pathname.includes(hash);
  await page.route(storage, (r) =>
    r.request().method() === "PUT" ? r.abort("connectionreset") : r.continue(),
  );
  await page.getByTestId("publish").click();
  const created = page.waitForResponse(
    (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/v1/packages",
  );
  await page.getByTestId("publish-confirm").click();
  const response = await created;
  expect(response.request().postData()).toContain(hash);
  expect(response.request().postData()).not.toContain("preserveEncoding");
  const id = (await response.json()).id as number;
  await expect(
    page.getByTestId("publish-done").getByRole("link", { name: "Finish upload" }),
  ).toBeVisible({ timeout: 30000 });
  await page.unroute(storage);
  await page.goto(`/packages/${id}/upload`);
  const resumed = page.waitForRequest(
    (r) => r.method() === "PUT" && new URL(r.url()).pathname.includes(hash),
  );
  await page.getByTestId("resume-stash").getByRole("button", { name: "Upload 1 file" }).click();
  const request = await resumed;
  await expect(page.getByTestId("resume-done")).toContainText("All media is uploaded", {
    timeout: 30000,
  });
  const storedUrl = new URL(request.url());
  storedUrl.search = "";
  const stored = await page.request.get(storedUrl.toString());
  expect(stored.ok()).toBe(true);
  expect(await stored.body()).toEqual(reviewed);
});
