import { describe, expect, it } from "vitest";
import xml from "./fixtures/siq/point.xml?raw";
import { parseSiq } from "./siq";
import { parseOq } from "./oq";
import { parseSiqPoint, pointTargetOrder } from "./siqPoint";
import { fromUpload, toUpload, draftPointImage } from "@/features/package-editor/packageDraft";
import { validatePackage } from "@/features/package-editor/validatePackage";

// Parser assertions use fixture names; real decoding is covered by native Chromium.
const bytes = new Uint8Array([1, 2, 3]);
const read = (source = xml) =>
  parseSiq({
    "content.xml": new TextEncoder().encode(source),
    "Images/point-wide.png": bytes,
    "Images/point-other.png": new Uint8Array([4, 5, 6]),
  });
const questions = (parsed: Awaited<ReturnType<typeof read>>) =>
  parsed.content.rounds[0]!.themes[0]!.questions;

describe("SIQ point compatibility (A11–A16)", () => {
  it("targets the last source occurrence, including repeated hashes, through draft and OQ", async () => {
    const parsed = await read();
    for (const q of questions(parsed).slice(0, 2))
      expect(q.pointImageOrder).toBe(q.questionFiles!.at(-1)!.order);
    const duplicate = questions(parsed)[1]!;
    expect(duplicate.questionFiles![0]!.file.md5).toBe(duplicate.questionFiles![1]!.file.md5);
    const draft = fromUpload(parsed.content);
    expect(draftPointImage(draft.rounds[0]!.themes[0]!.questions[1]!)?.occurrenceId).toBe(
      draft.rounds[0]!.themes[0]!.questions[1]!.questionFiles[1]!.occurrenceId,
    );
    const content = toUpload(draft);
    const reimported = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(content)),
      ...Object.fromEntries([...parsed.files].map(([hash, file]) => [`files/${hash}`, file.bytes])),
    });
    for (const [i, q] of questions(reimported).entries()) {
      expect(q.answerType).toBe("point");
      expect(q.answerPoint).toEqual(questions(parsed)[i]!.answerPoint);
      expect(q.pointImageOrder).toBe(questions(parsed)[i]!.pointImageOrder);
    }
  });
  it("retains source aspect 1 for x,y and minimum .02 for absent or zero deviation", async () => {
    const qs = questions(await read());
    expect(qs[2]).toMatchObject({
      answerPoint: { sourceGeometry: { kind: "sigame", aspectRatio: 1 } },
      answerDeviation: 0.02,
    });
    expect(qs[3]).toMatchObject({
      answerPoint: { sourceGeometry: { kind: "sigame", aspectRatio: 2 } },
      answerDeviation: 0.02,
    });
  });
  it("keeps missing/nonimage targets unresolved and blocks publication", async () => {
    const parsed = await read();
    expect(
      questions(parsed)
        .slice(4)
        .map((q) => q.pointImageOrder),
    ).toEqual([-1, -1]);
    expect(parsed.warnings.filter((w) => w.code === "pointTargetMissing")).toHaveLength(2);
    const report = validatePackage(fromUpload(parsed.content), (hash) => parsed.files.has(hash));
    expect(report.issues.filter((issue) => issue.code === "pointAnswerMissing")).toHaveLength(2);
  });
  it.each([
    "x",
    "",
    "0.5,",
    ",0.5",
    "NaN,0.5",
    "Infinity,0.5",
    "0.5,0.5,0",
    "0.5,0.5,-1",
    "0.5,0.5,NaN",
    "0.5,0.5,2,3",
    "-0.1,0.5",
    "1.1,0.5",
  ])("preserves point mode with repair for invalid right %s", async (right) => {
    expect(parseSiqPoint(right, null)).toBeNull();
    const parsed = await read(
      xml.replaceAll("0.5,0.5,2", right).replaceAll("0.5,0.5</answer>", `${right}</answer>`),
    );
    expect(questions(parsed).every((q) => q.answerType === "point" && q.answerPoint === null)).toBe(
      true,
    );
    expect(parsed.warnings.some((w) => w.code === "pointInvalid")).toBe(true);
  });
  it.each(["-1", "NaN", "Infinity", ""])("rejects malformed deviation %s", (deviation) => {
    expect(parseSiqPoint(".5,.5,2", deviation)).toBeNull();
  });
  it("resolves only the active content source occurrence for later script integration", () => {
    const occurrences = [
      { sourceIndex: 0, order: 3, kind: "image" },
      { sourceIndex: 2, order: 5, kind: "audio" },
      { sourceIndex: 4, order: 9, kind: "image" },
    ];
    expect(pointTargetOrder(0, occurrences)).toBe(3);
    expect(pointTargetOrder(4, occurrences)).toBe(9);
    expect(pointTargetOrder(2, occurrences)).toBeNull();
    expect(pointTargetOrder(4, [...occurrences, occurrences[2]!])).toBeNull();
  });
});

it("retains an entirely missing SIQ point image for repair instead of dropping the question (A16)", async () => {
  const parsed = await read(
    '<package name="Missing"><rounds><round name="R"><themes><theme name="T"><questions><question price="100"><params><param name="question" type="content"><item type="image" isRef="True">missing.png</item></param><param name="answerType">point</param></params><right><answer>.5,.5</answer></right></question></questions></theme></themes></round></rounds></package>',
  );
  expect(questions(parsed)).toHaveLength(1);
  expect(questions(parsed)[0]).toMatchObject({ answerType: "point", pointImageOrder: -1 });
  expect(validatePackage(fromUpload(parsed.content), () => false).critical).toBeGreaterThan(0);
});
it.each([0, -1, null, "bad"])(
  "does not silently convert a malformed OQ source metric %s to native (A16/A28)",
  async (aspectRatio) => {
    const parsed = await read();
    const content = structuredClone(parsed.content);
    const q = content.rounds[0]!.themes[0]!.questions[0]!;
    q.answerPoint = {
      x: 0.5,
      y: 0.5,
      sourceGeometry: { kind: "sigame", aspectRatio: aspectRatio as number },
    };
    const again = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(content)),
    });
    expect(questions(again)[0]).toMatchObject({ answerType: "point", answerPoint: null });
    expect(
      validatePackage(fromUpload(again.content), () => true).issues.some(
        (issue) => issue.code === "pointAnswerMissing",
      ),
    ).toBe(true);
  },
);
