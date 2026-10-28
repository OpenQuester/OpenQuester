import { expect, test } from "@playwright/test";
import type * as Draft from "../src/features/package-editor/packageDraft";
import type * as Storage from "../src/features/package-editor/draftStorage";
import type * as Archive from "../src/features/upload/archive";

test("point inspector follows the visible portrait image when resized", async ({
  page,
  context,
}) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.setViewportSize({ width: 1366, height: 884 });
  await page.goto("/");
  const id = await page.evaluate(async () => {
    const draftPath = "/src/features/package-editor/packageDraft.ts";
    const storagePath = "/src/features/package-editor/draftStorage.ts";
    const archivePath = "/src/features/upload/archive.ts";
    const { emptyPackage, newRound, newTheme, newQuestion } = (await import(
      draftPath
    )) as typeof Draft;
    const { saveDraft } = (await import(storagePath)) as typeof Storage;
    const { md5Hex } = (await import(archivePath)) as typeof Archive;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 480;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const md5 = md5Hex(bytes);
    const question = newQuestion(100, {
      text: "Portrait",
      answerType: "point",
      answerPoint: { x: 0.08, y: 0.9 },
      answerDeviation: 0.2,
      questionFiles: [{ md5, type: "image", displayTime: null }],
    });
    const pkg = emptyPackage("Point inspector");
    const round = newRound("Round");
    round.themes = [newTheme("Theme", [question])];
    pkg.rounds = [round];
    const id = crypto.randomUUID();
    await saveDraft({ id, pkg, updatedAt: Date.now() }, [
      { md5, type: "image", name: "portrait.png", bytes },
    ]);
    return id;
  });
  await page.goto(`/packages/editor/${id}`);
  await page.getByTestId("question-card").first().click();
  const inspector = page.getByTestId("inspector");
  const handle = page.locator('[role="separator"][aria-controls="package-editor-inspector"]');
  const control = inspector.getByRole("button", { name: /Point on image 1/ });
  const picture = inspector.getByTestId("point-picker").locator("img");
  await picture.evaluate((img: HTMLImageElement) => img.decode());

  for (const [width, key] of [
    [320, "Home"],
    [600, "End"],
  ] as const) {
    await handle.focus();
    await handle.press(key);
    await expect(handle).toHaveAttribute("aria-valuenow", String(width));
    await control.hover();
    const marker = inspector.getByTestId("point-target");
    await expect(marker).toBeVisible();
    const imageBox = (await picture.boundingBox())!;
    const markerBox = (await marker.boundingBox())!;
    expect(imageBox.width).toBeGreaterThan(0);
    expect(imageBox.height).toBeGreaterThan(0);
    expect(imageBox.width).toBeCloseTo(imageBox.height / 2, 0);
    expect(markerBox.x + markerBox.width / 2).toBeCloseTo(imageBox.x + imageBox.width * 0.08, 0);
    expect(markerBox.y + markerBox.height / 2).toBeCloseTo(imageBox.y + imageBox.height * 0.9, 0);
    expect(markerBox.width).toBeCloseTo(imageBox.width * 0.4, 0);
    await control.click();
    await expect(control).toHaveAttribute("aria-pressed", "true");
    await control.click();
    await expect(marker).toHaveCount(0);
    await control.press("Enter");
    await expect(marker).toBeVisible();
    await control.press("Space");
    await expect(marker).toHaveCount(0);
  }
});
