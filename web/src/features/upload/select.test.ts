import { describe, expect, it } from "vitest";
import fixture from "./fixtures/siq/select.xml?raw";
import { parseSiq } from "./siq";
import { parseOq } from "./oq";
import { fromUpload, toUpload } from "@/features/package-editor/packageDraft";
import { validatePackage } from "@/features/package-editor/validatePackage";
import { playableNumericQuestion } from "@/features/package-editor/numericAnswer";
import { HtmlConfirmationRequiredError } from "./htmlRemoval";

const bytes = (value: string) => new Uint8Array(new TextEncoder().encode(value));
const read = (xml = fixture, files: Record<string, Uint8Array> = {}) =>
  parseSiq({ "content.xml": bytes(xml), ...files });
const first = (content: Awaited<ReturnType<typeof read>>["content"]) =>
  content.rounds[0]!.themes[0]!.questions[0]!;

describe("SIQ select", () => {
  it.each(["simple", "stake", "secret", "noRisk"])(
    "preserves %s mechanics, exact labels and the first right without aliases",
    async (type) => {
      const parsed = await read(fixture.replace('type="stake"', `type="${type}"`));
      const q = first(parsed.content);
      expect(q).toMatchObject({
        type,
        answerType: "select",
        correctChoiceOrder: 2,
        answerText: "Chosen",
        rightAnswers: null,
      });
      expect(q.answers?.map(({ order, sourceLabel, text }) => [order, sourceLabel, text])).toEqual([
        [0, "A", "Same"],
        [1, "B", "Same"],
        [2, "C", "Chosen"],
      ]);
      expect(q.selectSource?.rightLabels).toEqual(["C", "B"]);
      const restored = toUpload(fromUpload(parsed.content));
      const archive = await parseOq({ "content.json": bytes(JSON.stringify(restored)) });
      expect(first(archive.content)).toMatchObject({
        type,
        answerType: "select",
        answers: q.answers,
        correctChoiceOrder: 2,
        answerText: "Chosen",
        selectSource: q.selectSource,
      });
      expect(playableNumericQuestion(first(restored))).not.toHaveProperty("selectSource");
    },
  );

  it.each([
    ["forAll", "simple"],
    ["stakeAll", "stake"],
  ] as const)(
    "keeps %s participation with exact select identity and actual price through draft and OQ",
    async (source, type) => {
      const parsed = await read(
        fixture.replace('price="300" type="stake"', `price="100" type="${source}"`),
      );
      const q = first(parsed.content);
      expect(q).toMatchObject({
        type,
        subType: "forEveryone",
        answerType: "select",
        correctChoiceOrder: 2,
      });
      q.realPrice = 500;
      const archive = await parseOq({
        "content.json": bytes(JSON.stringify(toUpload(fromUpload(parsed.content)))),
      });
      expect(first(archive.content)).toMatchObject({
        type,
        subType: "forEveryone",
        price: 100,
        realPrice: 500,
        answerType: "select",
        correctChoiceOrder: 2,
        answers: q.answers,
      });
    },
  );

  it.each([
    fixture.replace("<answer>C</answer>", "<answer>Z</answer>"),
    fixture.replace('name="B" type="content"', 'name="C" type="content"'),
  ])("keeps ambiguous source options as a blocked repair draft", async (xml) => {
    const parsed = await read(xml);
    const q = first(parsed.content);
    expect(q).toMatchObject({ answerType: "select", correctChoiceNeedsRepair: true });
    expect(q.answers).toHaveLength(3);
    expect(parsed.warnings).toContainEqual(
      expect.objectContaining({
        code: "choiceCorrectUnresolved",
        severity: "critical",
        resolution: "needsRepair",
      }),
    );
    const draft = fromUpload(parsed.content);
    expect(validatePackage(draft, () => true).issues).toContainEqual(
      expect.objectContaining({ code: "choiceCorrectUnresolved", severity: "critical" }),
    );
    const archive = await parseOq({ "content.json": bytes(JSON.stringify(toUpload(draft))) });
    expect(first(archive.content).selectSource).toEqual(q.selectSource);
    expect(first(archive.content).correctChoiceNeedsRepair).toBe(true);
  });

  it.each([9, 30])(
    "imports %i media options without applying authored-group limits to them",
    async (count) => {
      const options = Array.from(
        { length: count },
        (_, i) =>
          `<param name="L${i}" type="content"><item type="${["image", "audio", "video"][i % 3]}" isRef="true">same</item></param>`,
      ).join("");
      const xml = fixture
        .replace(
          /<param name="answerOptions"[\s\S]*?<\/param>\s*<\/params>/,
          `<param name="answerOptions" type="group">${options}</param></params>`,
        )
        .replace("<answer>C</answer>", "<answer>L2</answer>");
      const parsed = await read(xml, {
        "Images/same": bytes("image"),
        "Audio/same": bytes("audio"),
        "Video/same": bytes("video"),
      });
      const q = first(parsed.content);
      expect(q.answers).toHaveLength(count);
      expect(q.correctChoiceOrder).toBe(2);
      expect(q.answers?.slice(0, 3).map((option) => option.file?.type)).toEqual([
        "image",
        "audio",
        "video",
      ]);
      expect(validatePackage(fromUpload(parsed.content), () => true).critical).toBe(0);
    },
  );

  it("retains unsupported first-option source for repair and requires HTML-removal consent even in later items", async () => {
    const unsupported = await read(
      fixture.replace("<item>Chosen</item>", '<item type="unknown">raw source</item>'),
    );
    expect(first(unsupported.content).selectSource?.unresolvedOptions).toEqual([
      { order: 2, sourceLabel: "C", kind: "unknown", value: "raw source" },
    ]);
    expect(first(unsupported.content).correctChoiceNeedsRepair).toBe(true);
    const html = fixture.replace(
      "<item>Ignored second item</item>",
      '<item type="html">forbidden</item>',
    );
    await expect(read(html)).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
    await expect(parseSiq({ "content.xml": bytes(html) }, true)).rejects.toThrow(
      "allHtmlQuestions",
    );
  });
});
