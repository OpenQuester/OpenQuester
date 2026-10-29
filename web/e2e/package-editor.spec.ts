import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

import { expectNoHorizontalScroll, packageId, shot } from "./support/game";
import { makePng } from "./support/seed.mjs";

/** An .oq export with a picture question and two rounds, so moves can cross rounds. */
function oqFile(title: string): Buffer {
  const png = new Uint8Array(makePng());
  const md5 = createHash("md5").update(png).digest("hex");
  const q = (order: number, price: number, text: string, answerText: string, extra = {}) => ({
    type: "simple",
    order,
    price,
    text,
    answerText,
    showAnswerDuration: 5000,
    ...extra,
  });
  const content = {
    title,
    ageRestriction: "NONE",
    language: "en",
    tags: [],
    rounds: [
      {
        name: "Round one",
        order: 0,
        type: "simple",
        themes: [
          {
            name: "Colours",
            order: 0,
            questions: [
              q(0, 100, "Which colour is this?", "Amber", {
                questionFiles: [{ file: { md5, type: "image" }, order: 0, displayTime: 5000 }],
              }),
              q(1, 200, "Colour of the sky", "Blue"),
            ],
          },
        ],
      },
      {
        name: "Round two",
        order: 1,
        type: "simple",
        themes: [{ name: "Planets", order: 0, questions: [q(0, 200, "Red planet", "Mars")] }],
      },
    ],
  };
  return Buffer.from(
    zipSync({ "content.json": strToU8(JSON.stringify(content)), [`files/${md5}`]: png }),
  );
}

async function openInEditor(page: Page, title: string) {
  await page.goto("/packages/editor");
  await page.getByTestId("import-file").setInputFiles({
    name: "quiz.oq",
    mimeType: "application/zip",
    buffer: oqFile(title),
  });
  await expect(page.getByTestId("round-board")).toBeVisible();
}

const themeCards = (page: Page, theme: number) =>
  page.getByTestId("theme-row").nth(theme).getByTestId("question-card");

test.describe("package editor", () => {
  test("cards show question content and answers, and the form saves an edit", async ({ page }) => {
    await openInEditor(page, `Editor ${Date.now()}`);
    await expect(themeCards(page, 0)).toHaveCount(2);
    await expectNoHorizontalScroll(page);

    await page.getByTestId("density-cards").click();
    await expect(page.getByTestId("theme-row").first()).toContainText("Amber");
    await expect(page.getByTestId("theme-row").first().locator("img")).toBeVisible();
    await shot(page, "editor-cards");

    await themeCards(page, 0).nth(1).dblclick();
    const form = page.getByTestId("question-dialog");
    await expect(form).toBeVisible();
    await form.getByLabel("Correct answers", { exact: true }).fill("Sky blue\nAzure");
    await expect(form.getByLabel(/Also accept/)).toHaveCount(0);
    await shot(page, `editor-correct-answers-${test.info().project.name}`);
    await page.getByTestId("question-save").click();
    await expect(form).toBeHidden();
    await expect(page.getByTestId("theme-row").first()).toContainText("Sky blue");
    await expect(page.getByTestId("save-status")).toContainText("Saved in this browser");
    await themeCards(page, 0).nth(1).dblclick();
    await expect(form.getByLabel("Correct answers", { exact: true })).toHaveValue(
      "Sky blue\nAzure",
    );
  });

  test("paste questions as text, set the round's prices and search", async ({ page }) => {
    await openInEditor(page, `Editor ${Date.now()}`);
    await page.getByRole("button", { name: "Round actions" }).click();
    await page.getByRole("menuitem", { name: "Paste questions as text" }).click();
    await page
      .getByTestId("paste-text")
      .fill("Birds\n100. Fastest bird? | Peregrine falcon\n200. Largest bird? | Ostrich");
    await expect(page.getByTestId("paste-summary")).toContainText("1 themes, 2 questions");
    await page.getByRole("button", { name: "Add to the round" }).click();
    await expect(page.getByTestId("theme-row")).toHaveCount(2);
    await expect(themeCards(page, 1)).toHaveCount(2);

    await page.getByRole("button", { name: "Round actions" }).click();
    await page.getByRole("menuitem", { name: "Set prices for the round" }).click();
    await page.getByLabel("First price").fill("300");
    await page.getByLabel("Step", { exact: true }).fill("300");
    await page.getByRole("button", { name: "Set prices" }).click();
    await expect(themeCards(page, 1).nth(1)).toContainText("600");

    await page.getByRole("button", { name: "Search the package" }).click();
    await page.getByPlaceholder("Question, answer or theme").fill("ostrich");
    await expect(page.getByTestId("search-hit")).toHaveCount(1);
    await page.getByTestId("search-hit").click();
    await expect(page.getByTestId("question-dialog")).toBeVisible();
    await expect(page.getByTestId("question-dialog").getByLabel("Correct answer")).toHaveValue(
      "Ostrich",
    );
  });

  test("hovering a compact card previews the question", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover previews are for mouse pointers");
    await openInEditor(page, `Editor ${Date.now()}`);
    await themeCards(page, 0).first().hover();
    const preview = page.getByTestId("question-hover");
    await expect(preview).toContainText("Which colour is this?");
    await expect(preview).toContainText("Amber");
    await expect(preview.locator("button, input, video, audio, a")).toHaveCount(0);
    await expect(preview).toContainText("Select the question for the full preview.");
  });

  test("a question drags into a theme of another round, and undo puts it back", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "touch screens move with the Move dialog");
    await openInEditor(page, `Editor ${Date.now()}`);
    // Every theme of every round is a drop target in the outline.
    await themeCards(page, 0)
      .first()
      .dragTo(page.getByTestId("outline").getByRole("button", { name: /Planets/ }));
    await expect(themeCards(page, 0)).toHaveCount(1);
    await expect(page.getByText("Moved to Planets")).toBeVisible();
    await page.getByRole("button", { name: /2 · Round two/ }).click();
    await expect(themeCards(page, 0)).toHaveCount(2);

    await page.getByRole("button", { name: "Undo" }).first().click();
    await page.getByRole("button", { name: /1 · Round one/ }).click();
    await expect(themeCards(page, 0)).toHaveCount(2);
  });

  test("Move to… sends a question to another round without dragging", async ({ page }) => {
    await openInEditor(page, `Editor ${Date.now()}`);
    await page
      .getByRole("button", { name: /^Actions for 200/ })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Move to…" }).click();
    await page.getByLabel("Round", { exact: true }).selectOption({ label: "2 · Round two" });
    await page.getByText("Planets", { exact: true }).last().click();
    await page.getByTestId("move-confirm").click();
    await expect(page.getByLabel("Round name")).toHaveValue("Round two");
    await expect(themeCards(page, 0)).toHaveCount(2);
    await expectNoHorizontalScroll(page);
    await shot(page, "editor-moved");
  });

  test("publishing is blocked with a reason until the package is fixed", async ({ page }) => {
    await openInEditor(page, `Editor ${Date.now()}`);
    await themeCards(page, 0).nth(1).dblclick();
    await page.getByLabel("Question text").fill("");
    await page.getByTestId("question-save").click();
    await page.getByTestId("publish").click();
    const check = page.getByTestId("publish-check");
    await expect(check).toContainText("The question has no text or media.");
    await expect(page.getByTestId("publish-confirm")).toBeDisabled();
    // The issue jumps straight to the question that causes it.
    await check.getByRole("button", { name: /no text or media/ }).click();
    await expect(page.getByTestId("question-dialog")).toBeVisible();
  });

  test("a published package opens read only from the package list", async ({ page }) => {
    await page.goto(`/packages?id=${packageId()}`);
    await page.getByTestId("package-preview").click();
    await expect(page.getByTestId("preview-badge")).toBeVisible();
    await expect(page.getByTestId("round-board")).toBeVisible();
    await expect(page.getByTestId("question-card").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Actions for/ })).toHaveCount(0);
    await expect(page.locator("[draggable=true]")).toHaveCount(0);
    await page.getByTestId("question-card").first().click();
    await expect(page.getByTestId("question-view").or(page.getByTestId("inspector"))).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
