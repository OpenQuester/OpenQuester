import { expect, test } from "@playwright/test";
import type * as Dimensions from "../src/features/upload/pointImageDimensions";
import type * as Optimize from "../src/features/upload/optimize/index";
import type * as Archive from "../src/features/upload/archive";
import type * as Oq from "../src/features/upload/oq";
import type * as Upload from "../src/features/upload/upload";
import type * as Draft from "../src/features/package-editor/packageDraft";
import type * as Media from "../src/features/package-editor/packageMedia";
import type { ParsedPackage } from "../src/features/upload/types";

test("measures final landscape, portrait, square and EXIF-oriented image bytes", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const dimensionsPath = "/src/features/upload/pointImageDimensions.ts";
    const optimizePath = "/src/features/upload/optimize/index.ts";
    const archivePath = "/src/features/upload/archive.ts";
    const { withPointImageDimensions } = (await import(dimensionsPath)) as typeof Dimensions;
    const { optimizePackage } = (await import(optimizePath)) as typeof Optimize;
    const { md5Hex } = (await import(archivePath)) as typeof Archive;
    const results: number[] = [];
    let converted = 0;
    for (const [width, height, oriented] of [
      [1200, 600, false],
      [600, 1200, false],
      [600, 600, false],
      [1200, 600, true],
    ] as const) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      for (let y = 0; y < height; y += 10)
        for (let x = 0; x < width; x += 10) {
          ctx.fillStyle = `rgb(${x % 256},${y % 256},${(x * y) % 256})`;
          ctx.fillRect(x, y, 10, 10);
        }
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((value) => resolve(value!), "image/jpeg", 0.95),
      );
      let bytes = new Uint8Array(await blob.arrayBuffer());
      if (oriented) {
        const exif = new Uint8Array([
          255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1,
          0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
        ]);
        const result = new Uint8Array(bytes.length + exif.length);
        result.set(bytes.subarray(0, 2));
        result.set(exif, 2);
        result.set(bytes.subarray(2), 2 + exif.length);
        bytes = result;
      }
      const md5 = md5Hex(bytes);
      const file = { md5, type: "image" as const, name: "image.jpg", bytes };
      const parsed: ParsedPackage = {
        format: "oq",
        warnings: [],
        files: new Map([[md5, file]]),
        content: {
          title: "Point",
          ageRestriction: "NONE",
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
                      answerType: "point",
                      answerPoint: { x: 0.5, y: 0.5 },
                      showAnswerDuration: 5000,
                      questionFiles: [
                        { file: { md5, type: "image" }, order: 0, displayTime: null },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      const optimized = (await optimizePackage(parsed, () => {})).parsed;
      if (!optimized.files.has(md5)) converted++;
      const measured = await withPointImageDimensions(optimized);
      results.push(
        measured.content.rounds[0]!.themes[0]!.questions[0]!.answerPoint!.imageAspectRatio!,
      );
    }
    return { aspects: results, converted };
  });
  expect(result.aspects).toEqual([2, 0.5, 1, 0.5]);
  expect(result.converted).toBeGreaterThan(0);
});

test("archive upload sends aspect measured from the optimized first image", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  let posted: { content: ParsedPackage["content"] } | undefined;
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await context.route("**/v1/packages", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posted = route.request().postDataJSON();
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ message: "Captured" }),
    });
  });
  await page.goto("/");
  const originalHash = await page.evaluate(async () => {
    const archivePath = "/src/features/upload/archive.ts",
      oqPath = "/src/features/upload/oq.ts",
      uploadPath = "/src/features/upload/upload.ts";
    const { md5Hex, readZip } = (await import(archivePath)) as typeof Archive;
    const { parseOq } = (await import(oqPath)) as typeof Oq;
    const { uploadPackage } = (await import(uploadPath)) as typeof Upload;
    const draftPath = "/src/features/package-editor/packageDraft.ts",
      mediaPath = "/src/features/package-editor/packageMedia.ts";
    const { fromUpload } = (await import(draftPath)) as typeof Draft;
    const { exportOq } = (await import(mediaPath)) as typeof Media;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    for (let y = 0; y < 600; y += 10)
      for (let x = 0; x < 1200; x += 10) {
        ctx.fillStyle = `rgb(${x % 256},${y % 256},${(x * y) % 256})`;
        ctx.fillRect(x, y, 10, 10);
      }
    const jpeg = new Uint8Array(
      await (
        await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.95))
      ).arrayBuffer(),
    );
    const exif = new Uint8Array([
      255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0,
      0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const bytes = new Uint8Array(jpeg.length + exif.length);
    bytes.set(jpeg.subarray(0, 2));
    bytes.set(exif, 2);
    bytes.set(jpeg.subarray(2), 2 + exif.length);
    const md5 = md5Hex(bytes);
    const content: ParsedPackage["content"] = {
      title: "Point",
      ageRestriction: "NONE",
      tags: [],
      rounds: [
        {
          name: "R",
          order: 0,
          type: "simple",
          themes: [
            {
              name: "T",
              order: 0,
              questions: [
                {
                  type: "simple",
                  order: 0,
                  price: 100,
                  answerType: "point",
                  answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
                  showAnswerDuration: 5000,
                  questionFiles: [{ file: { md5, type: "image" }, order: 0, displayTime: null }],
                },
              ],
            },
          ],
        },
      ],
    };
    const blob = await exportOq(
      fromUpload(content),
      new Map([[md5, { md5, type: "image", name: "image.jpg", bytes }]]),
    );
    const parsed = await parseOq(await readZip(new Uint8Array(await blob.arrayBuffer())));
    try {
      await uploadPackage(parsed, () => {}, undefined, true);
    } catch {
      /* captured request is deliberately rejected */
    }
    return md5;
  });
  expect(posted).toBeDefined();
  const question = posted!.content.rounds[0]!.themes[0]!.questions[0]!;
  expect(question.answerPoint).toEqual({ x: 0.5, y: 0.5, imageAspectRatio: 0.5 });
  expect(question.questionFiles![0]!.file.md5).not.toBe(originalHash);
});
