import { expect, test } from "@playwright/test";
import type * as Draft from "../src/features/package-editor/packageDraft";
import type * as Storage from "../src/features/package-editor/draftStorage";
import type * as Archive from "../src/features/upload/archive";

test("attachment image cannot start a native drag, while file drops still add media", async ({
  page,
  context,
}) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const id = await page.evaluate(async () => {
    const modelPath = "/src/features/package-editor/packageDraft.ts";
    const storagePath = "/src/features/package-editor/draftStorage.ts";
    const archivePath = "/src/features/upload/archive.ts";
    const { emptyPackage, newRound, newTheme, newQuestion } = (await import(
      modelPath
    )) as typeof Draft;
    const { saveDraft } = (await import(storagePath)) as typeof Storage;
    const { md5Hex } = (await import(archivePath)) as typeof Archive;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 80;
    canvas.getContext("2d")!.fillRect(0, 0, 80, 80);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const md5 = md5Hex(bytes);
    const pkg = emptyPackage("Image drag");
    const round = newRound("Round");
    round.themes = [
      newTheme("Theme", [
        newQuestion(100, {
          text: "Question",
          questionFiles: [{ md5, type: "image", displayTime: 5000 }],
        }),
      ]),
    ];
    pkg.rounds = [round];
    const id = crypto.randomUUID();
    await saveDraft({ id, pkg, updatedAt: Date.now() }, [
      { md5, type: "image", name: "original.png", bytes },
    ]);
    return id;
  });
  await page.goto(`/packages/editor/${id}`);
  await page.getByTestId("question-card").first().press("Control+Enter");
  const form = page.getByTestId("question-dialog");
  const cards = form.getByTestId("attachment-card");
  await expect(cards).toHaveCount(1);
  const picture = cards.first().locator("img");
  await expect(picture).toHaveAttribute("draggable", "false");
  await picture.evaluate((image: HTMLImageElement) => image.decode());
  await page.evaluate(() => {
    (window as Window & { imageDrags?: number }).imageDrags = 0;
    document.addEventListener(
      "dragstart",
      () => {
        (window as Window & { imageDrags?: number }).imageDrags!++;
      },
      true,
    );
  });
  const image = (await picture.boundingBox())!;
  const dropZone = cards.first().locator("..");
  const zone = (await dropZone.boundingBox())!;
  await page.mouse.move(image.x + image.width / 2, image.y + image.height / 2);
  await page.mouse.down();
  await page.mouse.move(zone.x + zone.width - 30, zone.y + zone.height / 2, { steps: 12 });
  await page.mouse.up();
  expect(await page.evaluate(() => (window as Window & { imageDrags?: number }).imageDrags)).toBe(
    0,
  );
  await expect(cards).toHaveCount(1);
  await expect(page.getByTestId("media-editor")).toHaveCount(0);

  const transfer = await page.evaluateHandle(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "blue";
    ctx.fillRect(0, 0, 80, 80);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    const data = new DataTransfer();
    data.items.add(new File([blob], "new.png", { type: "image/png" }));
    return data;
  });
  await dropZone.dispatchEvent("dragover", { dataTransfer: transfer });
  await dropZone.dispatchEvent("drop", { dataTransfer: transfer });
  const editor = page.getByTestId("media-editor");
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Use unchanged" }).click();
  await expect(cards).toHaveCount(2);
});
