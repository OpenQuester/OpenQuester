import { expect, test } from "@playwright/test";
import type * as Draft from "../src/features/package-editor/packageDraft";
import type * as Storage from "../src/features/package-editor/draftStorage";
import type * as Archive from "../src/features/upload/archive";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

test.use({ screenshot: "only-on-failure" });

test("new target uses last image and secret preview waits for that step", async ({
  page,
  context,
}) => {
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.setViewportSize({ width: 1366, height: 884 });
  await page.goto("/");
  const id = await page.evaluate(async () => {
    const d = "/src/features/package-editor/packageDraft.ts",
      s = "/src/features/package-editor/draftStorage.ts",
      a = "/src/features/upload/archive.ts";
    const { emptyPackage, newRound, newTheme, newQuestion } = (await import(d)) as typeof Draft;
    const { saveDraft } = (await import(s)) as typeof Storage;
    const { md5Hex } = (await import(a)) as typeof Archive;
    const make = async (width: number, height: number, color: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((value) => resolve(value!), "image/png"),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const md5 = md5Hex(bytes);
      return { md5, type: "image" as const, name: `${md5}.png`, bytes };
    };
    const files = [await make(100, 200, "red"), await make(240, 120, "blue")];
    const pkg = emptyPackage("Point order");
    const round = newRound("Round");
    round.themes = [
      newTheme("Theme", [
        newQuestion(100, {
          type: "secret",
          text: "Question",
          answerType: "point",
          questionFiles: files.map((f) => ({ md5: f.md5, type: f.type, displayTime: 3000 })),
        }),
      ]),
    ];
    pkg.rounds = [round];
    const id = crypto.randomUUID();
    await saveDraft({ id, pkg, updatedAt: Date.now() }, files);
    return id;
  });
  await page.goto(`/packages/editor/${id}`);
  await page.getByTestId("question-card").first().press("Control+Enter");
  const form = page.getByTestId("question-dialog");
  const picker = form.getByTestId("point-picker");
  await expect
    .poll(() =>
      picker
        .locator("img")
        .evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
    )
    .toEqual([240, 120]);
  await picker.click();
  await expect(picker.getByTestId("point-target")).toBeVisible();
  await form
    .getByTestId("attachment-card")
    .last()
    .getByRole("button", { name: "Remove file" })
    .click();
  await expect
    .poll(() =>
      picker
        .locator("img")
        .evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
    )
    .toEqual([100, 200]);
  await expect(picker.getByTestId("point-target")).toHaveCount(0);
  await form.getByRole("button", { name: "Undo media change" }).click();
  await expect
    .poll(() =>
      picker
        .locator("img")
        .evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
    )
    .toEqual([240, 120]);
  await expect(picker.getByTestId("point-target")).toBeVisible();
  await expect(form.getByRole("button", { name: "Choose the last picture" })).toHaveCount(0);
  await form.getByTestId("question-save").click();
  await page.getByTestId("question-card").first().press("Control+Enter");
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const game = page.getByTestId("question-playtest");
  await game.getByRole("radio", { name: /Player 2/ }).click();
  await game.getByTestId("secret-give").click();
  await game
    .getByRole("group", { name: "Simulation controls" })
    .getByLabel("View as")
    .selectOption("3");
  const stage = game.getByTestId("content-stage");
  await expect(stage).toBeVisible();
  await expect(game.getByTestId("point-picker")).toHaveCount(0);
  await expect(game.getByTestId("dock")).toContainText("Wait for the target picture to appear.");
  await expect(stage.locator("img")).toHaveCount(1);
  expect(
    await stage
      .locator("img")
      .evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
  ).toEqual([100, 200]);
  const dir = process.env.OQ_POINT_SHOTS;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, "point-sequence-first.png") });
  }
  const target = game.getByTestId("point-picker");
  await expect(target).toBeVisible({ timeout: 7000 });
  expect(
    await target
      .locator("img")
      .evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
  ).toEqual([240, 120]);
  if (dir) await page.screenshot({ path: join(dir, "point-sequence-target.png") });
  await target.click();
  await expect(game.getByTestId("answer-reveal")).toBeVisible();
  expect(
    await game
      .getByTestId("answer-reveal")
      .locator("img")
      .evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
  ).toEqual([240, 120]);
  if (dir) await page.screenshot({ path: join(dir, "point-sequence-reveal.png") });
});
