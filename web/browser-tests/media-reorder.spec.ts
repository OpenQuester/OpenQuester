import { expect, test } from "@playwright/test";
import type * as Drafts from "../src/features/package-editor/draftStorage";
import type * as Model from "../src/features/package-editor/packageDraft";

test("reorders distinct occurrences safely and keeps main text first with external drops", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(async () => {
    const modelPath = "/src/features/package-editor/packageDraft.ts";
    const storagePath = "/src/features/package-editor/draftStorage.ts";
    const { emptyPackage, newQuestion, newRound, newTheme } = (await import(
      modelPath
    )) as typeof Model;
    const { saveDraft } = (await import(storagePath)) as typeof Drafts;
    const image = async (color: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 30;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 40, 30);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((value) => resolve(value!), "image/png"),
      );
      return new Uint8Array(await blob.arrayBuffer());
    };
    const pkg = emptyPackage("Reorder verification");
    const round = newRound("Round");
    const item = (md5: string, displayTime: number) => ({
      md5,
      type: "image" as const,
      displayTime,
    });
    round.themes = [
      newTheme("Theme", [
        newQuestion(100, {
          text: "Prompt",
          textPosition: null,
          mainTextFirst: undefined,
          textItems: undefined,
          answerText: "Answer",
          questionFiles: [item("first", 1000), item("first", 2000), item("second", 3000)],
        }),
      ]),
    ];
    pkg.rounds = [round];
    await saveDraft({ id: "reorder-test", pkg, updatedAt: 1 }, [
      { md5: "first", type: "image", name: "first.png", bytes: await image("red") },
      { md5: "second", type: "image", name: "second.png", bytes: await image("blue") },
    ]);
  });
  await page.goto("/packages/editor/reorder-test");
  await page.getByTestId("question-card").first().press("Control+Enter");
  const form = page.getByTestId("question-dialog");
  await form.getByRole("button", { name: "Close", exact: true }).click();
  await expect(form).toBeHidden();
  const unchanged = await page.evaluate(async () => {
    const path = "/src/features/package-editor/draftStorage.ts";
    const { loadDraft } = (await import(path)) as typeof Drafts;
    return await loadDraft("reorder-test");
  });
  expect(unchanged!.pkg.rounds[0]!.themes[0]!.questions[0]!.questionFiles[0]).not.toHaveProperty(
    "occurrenceId",
  );
  await page.getByTestId("question-card").first().press("Control+Enter");
  const section = form.getByTestId("question-media-fields");
  const cards = section.getByTestId("attachment-card");
  const values = async () =>
    cards
      .locator('input[inputmode="decimal"]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value));
  await expect(cards).toHaveCount(3);
  await expect.poll(values).toEqual(["1", "2", "3"]);
  await page.evaluate(() => {
    (window as Window & { reorderStarts?: number }).reorderStarts = 0;
    document.addEventListener("dragstart", () => {
      (window as Window & { reorderStarts?: number }).reorderStarts!++;
    });
  });
  const image = cards.first().locator("img").first();
  await image.dragTo(cards.last(), { targetPosition: { x: 10, y: 20 } });
  expect(
    await page.evaluate(() => (window as Window & { reorderStarts?: number }).reorderStarts),
  ).toBe(0);
  expect(await values()).toEqual(["1", "2", "3"]);
  await cards
    .nth(1)
    .getByRole("button", { name: "Drag file 2 to reorder" })
    .dragTo(cards.first(), { targetPosition: { x: 10, y: 20 } });
  await expect.poll(values).toEqual(["2", "1", "3"]);
  await cards.nth(1).locator('input[inputmode="decimal"]').fill("4");
  await form.getByRole("button", { name: "Undo media change" }).click();
  await expect.poll(values).toEqual(["4", "2", "3"]);
  await cards.nth(2).getByRole("button", { name: "Drag file 3 to reorder" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(values).toEqual(["4", "3", "2"]);
  await cards.nth(1).getByRole("button", { name: "Drag file 2 to reorder" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(values).toEqual(["3", "4", "2"]);
  await form.getByRole("button", { name: "Undo media change" }).click();
  await expect.poll(values).toEqual(["4", "3", "2"]);
  await form.getByTestId("question-save").click();
  await expect(form).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = "/src/features/package-editor/draftStorage.ts";
        const { loadDraft } = (await import(path)) as typeof Drafts;
        const saved = await loadDraft("reorder-test");
        return saved?.pkg.rounds[0]!.themes[0]!.questions[0]!.questionFiles.map(
          (file) => file.displayTime,
        );
      }),
    )
    .toEqual([4000, 3000, 2000]);
  const draft = await page.evaluate(async () => {
    const path = "/src/features/package-editor/draftStorage.ts";
    const { loadDraft } = (await import(path)) as typeof Drafts;
    return await loadDraft("reorder-test");
  });
  expect(draft!.pkg.rounds[0]!.themes[0]!.questions[0]).toMatchObject({
    textPosition: 0,
    questionFiles: [
      { md5: "first", displayTime: 4000 },
      { md5: "second", displayTime: 3000 },
      { md5: "first", displayTime: 2000 },
    ],
  });
  const ids = draft!.pkg.rounds[0]!.themes[0]!.questions[0]!.questionFiles.map(
    (file) => file.occurrenceId,
  );
  expect(new Set(ids).size).toBe(3);

  await page.getByTestId("question-card").first().press("Control+Enter");
  await section.getByTestId("attachment-drop-zone").evaluate((zone) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const bytes = Uint8Array.from(atob(canvas.toDataURL("image/png").split(",")[1]!), (char) =>
      char.charCodeAt(0),
    );
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "external.png", { type: "image/png" }));
    zone.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
    zone.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });
  await page.getByTestId("media-editor").getByRole("button", { name: "Use unchanged" }).click();
  await expect(cards).toHaveCount(4);
});

test("mobile shortcut undo keeps a useful focus after accept and decline", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(async () => {
    const modelPath = "/src/features/package-editor/packageDraft.ts";
    const storagePath = "/src/features/package-editor/draftStorage.ts";
    const { emptyPackage, newQuestion, newRound, newTheme } = (await import(
      modelPath
    )) as typeof Model;
    const { saveDraft } = (await import(storagePath)) as typeof Drafts;
    const pkg = emptyPackage("Focus verification");
    const round = newRound("Round");
    round.themes = [
      newTheme("Theme", [
        newQuestion(100, {
          text: "Prompt",
          answerText: "Answer",
          answerType: "point",
        }),
      ]),
    ];
    pkg.rounds = [round];
    await saveDraft({ id: "focus-test", pkg, updatedAt: 1 }, []);
  });
  await page.goto("/packages/editor/focus-test");
  await page.getByTestId("question-card").first().press("Control+Enter");
  const form = page.getByTestId("question-dialog");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aL8AAAAASUVORK5CYII=",
    "base64",
  );
  await form.getByTestId("question-media-fields").locator('input[type="file"]').setInputFiles({
    name: "target.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByTestId("media-editor").getByRole("button", { name: "Use unchanged" }).click();
  const picker = form.getByTestId("point-picker");
  await expect(picker).toBeVisible();
  await picker.focus();
  await page.keyboard.press("Enter");
  const undo = form.getByRole("button", { name: "Undo media change" });
  await undo.focus();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Control+z");
  await expect(undo).toBeFocused();
  page.once("dialog", (dialog) => dialog.accept());
  await page.keyboard.press("Control+z");
  await expect(form.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(form.getByTestId("question-save")).toBeFocused();
});
