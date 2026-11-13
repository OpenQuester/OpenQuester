import { describe, expect, it } from "vitest";
import fixture from "./fixtures/siq/authored-content.xml?raw";
import { parseSiq } from "./siq";
import { parseOq } from "./oq";
import { fromUpload, toUpload } from "@/features/package-editor/packageDraft";
import { validatePackage } from "@/features/package-editor/validatePackage";
import { buildContentPlan, positionAt } from "@/game/contentPlan";
import { draftFromParsed } from "@/features/package-editor/createDraft";
import { loadDraft } from "@/features/package-editor/draftStorage";
import { HtmlConfirmationRequiredError } from "./htmlRemoval";

const bytes = (value: string) => new Uint8Array(new TextEncoder().encode(value));
const media = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
const read = (xml = fixture) =>
  parseSiq({ "content.xml": bytes(xml), "Images/picture.png": media });
const questions = (content: Awaited<ReturnType<typeof read>>["content"]) =>
  content.rounds[0]!.themes[0]!.questions;

describe("SIQ authored answer windows and text occurrences", () => {
  it("imports speech as timed screen text and keeps private instructions through draft/OQ/storage", async () => {
    const parsed = await read();
    const [q, oral, legacy] = questions(parsed.content);
    expect(parsed.warnings).toEqual([]);
    expect(q).toMatchObject({
      answerDurationMs: 15000,
      answerText: "Paris",
      rightAnswers: ["City of light"],
      text: "First screen",
      textOrder: 0,
      textDurationMs: 3000,
      textItems: [
        { order: 1, text: "Read this privately", placement: "screen", durationMs: 2000 },
        { order: 2, text: "", placement: "screen", durationMs: 1000 },
        { order: 3, text: "", placement: "screen", durationMs: 4000 },
        { order: 4, text: "Final clue", placement: "screen", durationMs: 1000 },
      ],
      questionFiles: [{ order: 5 }],
      answerTextItems: [
        { order: 0, text: "Paris is the capital of France" },
        { order: 2, text: "After the image" },
      ],
      answerFiles: [{ order: 1 }],
      answerExplanation: "After-answer explanation",
      showmanComments: "Private instruction",
    });
    expect(oral).toMatchObject({
      text: null,
      textItems: [{ placement: "screen", text: "Purely oral private question" }],
    });
    expect(legacy).toMatchObject({
      answerText: "Legacy key",
      answerTextItems: [
        { order: 0, text: "Legacy answer explanation", durationMs: 2000 },
        { order: 2, text: "After legacy image" },
      ],
      answerFiles: [{ order: 1 }],
    });
    const plan = buildContentPlan({ ...q, files: q!.questionFiles })!;
    expect(plan.steps.map((step) => step.durationMs)).toEqual([3000, 2000, 1000, 4000, 1000, 5000]);
    expect(positionAt(plan, 3500).screen[0]?.order).toBe(1);
    expect(positionAt(plan, 5500).screen[0]?.order).toBe(2); // empty screen replaces it
    const draft = fromUpload(parsed.content);
    expect(validatePackage(draft, () => true).critical).toBe(0);
    const upload = toUpload(draft);
    const archive = await parseOq({ "content.json": bytes(JSON.stringify(upload)) });
    expect(questions(archive.content)[0]).toMatchObject({
      answerDurationMs: 15000,
      answerTextItems: q!.answerTextItems,
      textItems: q!.textItems,
      showmanComments: "Private instruction",
    });
    const id = await draftFromParsed(parsed);
    expect(toUpload((await loadDraft(id))!.pkg)).toEqual(upload);
  });

  it("converts legacy say atoms and scripted replic content into separate timed screen steps", async () => {
    const v4 = await read(
      '<package><rounds><round><themes><theme><questions><question price="100"><scenario><atom type="say" time="3">Legacy prompt</atom><atom>Next</atom></scenario><right><answer>Key</answer></right></question></questions></theme></themes></round></rounds></package>',
    );
    const scripted = await read(
      '<package><rounds><round><themes><theme><questions><question type="custom" price="100"><script><step type="showContent"><param name="content"><item placement="replic" waitForFinish="false" duration="00:00:03">Script prompt</item><item>Next</item></param></step><step type="askAnswer"><param name="mode">button</param></step></script><right><answer>Key</answer></right></question></questions></theme></themes></round></rounds></package>',
    );
    for (const [parsed, firstText] of [
      [v4, "Legacy prompt"],
      [scripted, "Script prompt"],
    ] as const) {
      const [question] = questions(parsed.content);
      expect(parsed.warnings).toEqual([]);
      expect(question?.textItems?.[0]).toEqual({
        order: 0,
        text: firstText,
        durationMs: 3000,
        placement: "screen",
      });
      const plan = buildContentPlan(question!)!;
      expect(plan.steps.map((step) => step.durationMs)).toEqual([3000, 2000]);
    }
  });

  it("allocates a display interval even for a single untimed SIQ prompt", async () => {
    const parsed = await read(
      '<package><rounds><round><themes><theme><questions><question price="100"><scenario><atom>Prompt</atom></scenario><right><answer>Key</answer></right></question></questions></theme></themes></round></rounds></package>',
    );
    const [question] = questions(toUpload(fromUpload(parsed.content)));
    expect(question).toMatchObject({ text: "Prompt", textOrder: 0 });
    expect(buildContentPlan(question!)?.steps.map((step) => step.durationMs)).toEqual([2000]);
  });

  it.each(["-1", "1.5", "NaN", "Infinity", "2147484", "999999999999999999999999"])(
    "preserves invalid answerDuration %s as a blocking repair",
    async (value) => {
      const parsed = await read(fixture.replace(">15</param>", `>${value}</param>`));
      const q = questions(parsed.content)[0]!;
      expect(q.answerDurationMs).toBeNull();
      expect(q.compatibilityIssues).toContainEqual(
        expect.objectContaining({ feature: "answerDuration", detail: value, severity: "critical" }),
      );
      expect(validatePackage(fromUpload(parsed.content), () => true).critical).toBe(1);
      const archive = await parseOq({
        "content.json": bytes(JSON.stringify(toUpload(fromUpload(parsed.content)))),
      });
      expect(validatePackage(fromUpload(archive.content), () => true).critical).toBe(1);
    },
  );

  it.each(["0", ""])("uses room default for absent/zero answerDuration %s", async (value) => {
    const parsed = await read(
      fixture.replace(
        '<param name="answerDuration">15</param>',
        value ? '<param name="answerDuration">0</param>' : "",
      ),
    );
    expect(questions(parsed.content)[0]!.answerDurationMs).toBeNull();
    expect(parsed.warnings).toEqual([]);
  });

  it("blocks unknown content/placement and still counts missing, blank and private source steps", async () => {
    const bad = await read(
      fixture
        .replace('placement="replic"', 'placement="mystery"')
        .replace('type="image"', 'type="future"'),
    );
    expect(questions(bad.content)[0]!.compatibilityIssues?.map((issue) => issue.feature)).toEqual([
      "placement",
      "contentType",
    ]);
    expect(validatePackage(fromUpload(bad.content), () => true).critical).toBeGreaterThan(0);
    const repairedArchive = await parseOq({
      "content.json": bytes(JSON.stringify(toUpload(fromUpload(bad.content)))),
    });
    expect(questions(repairedArchive.content)[0]!.compatibilityIssues).toEqual(
      questions(bad.content)[0]!.compatibilityIssues,
    );
    expect(
      questions(repairedArchive.content)[0]!.compatibilityIssues?.[0]?.contentSource,
    ).toMatchObject({ placement: "mystery", text: "Read this privately" });
    expect(
      validatePackage(fromUpload(repairedArchive.content), () => true).critical,
    ).toBeGreaterThan(0);
    const wrap = (items: string) =>
      `<package><rounds><round><themes><theme><questions><question><params><param name="question">${items}</param></params></question></questions></theme></themes></round></rounds></package>`;
    for (const item of [
      '<item placement="replic" duration="00:00:01"/>',
      '<item duration="00:00:01"/>',
      '<item type="future"/>',
    ])
      await expect(read(wrap(item.repeat(31)))).rejects.toMatchObject({
        issues: [expect.objectContaining({ actual: 31, max: 30 })],
      });
    await expect(
      read(wrap('<item type="image" waitForFinish="false">missing.png</item>'.repeat(11))),
    ).rejects.toMatchObject({ issues: [expect.objectContaining({ actual: 11, max: 10 })] });
  });

  it("requires removal consent for HTML carried as an OQ repair occurrence", async () => {
    const parsed = await read(fixture.replace('placement="replic"', 'placement="unknown"'));
    const q = questions(parsed.content)[0]!;
    q.compatibilityIssues![0]!.contentSource!.type = "HTML";
    const archive = { "content.json": bytes(JSON.stringify(parsed.content)) };
    await expect(parseOq(archive)).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
    expect(questions((await parseOq(archive, true)).content)).toHaveLength(2);
  });

  it("keeps more than 16 occurrence repairs through OQ within the 30-step limit", async () => {
    const items = Array.from(
      { length: 20 },
      (_, i) => `<item placement="future">Retain item ${i + 1}</item>`,
    ).join("");
    const parsed = await read(
      `<package name="Repairs"><rounds><round name="R"><themes><theme name="T"><questions><question price="100"><params><param name="question">${items}</param></params><right><answer>Key</answer></right></question></questions></theme></themes></round></rounds></package>`,
    );
    const issues = questions(parsed.content)[0]!.compatibilityIssues;
    expect(issues).toHaveLength(20);
    expect(issues?.at(-1)?.contentSource?.text).toBe("Retain item 20");
    const archive = await parseOq({
      "content.json": bytes(JSON.stringify(toUpload(fromUpload(parsed.content)))),
    });
    expect(questions(archive.content)[0]!.compatibilityIssues).toEqual(issues);
    expect(validatePackage(fromUpload(archive.content), () => true).critical).toBeGreaterThan(0);
  });
});
