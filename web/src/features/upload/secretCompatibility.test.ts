import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { exportOq } from "@/features/package-editor/packageMedia";
import modern from "./fixtures/siq/modern-secrets.xml?raw";
import legacy from "./fixtures/siq/legacy-secrets.xml?raw";
import unresolved from "./fixtures/siq/unresolved-script.xml?raw";
import { parseSiq } from "./siq";
import { parseOq } from "./oq";
import { normalizeLegacySecretCost, normalizeSecretPrice } from "./normalizeSiqQuestion";
import { assertPlayableCompatibility } from "./siqCompatibility";
import { fromUpload, reachableMedia, toUpload } from "@/features/package-editor/packageDraft";
import { validatePackage } from "@/features/package-editor/validatePackage";
import { convertImportedQuestionToSimple } from "@/features/package-editor/question-form/questionUpdates";
import { loadDraft, saveDraft } from "@/features/package-editor/draftStorage";

const entries = (xml: string) => ({ "content.xml": new TextEncoder().encode(xml) });
const questions = (content: Awaited<ReturnType<typeof parseSiq>>["content"]) =>
  content.rounds[0]!.themes[0]!.questions;

const secretPackage = (type: string, parameters: string, legacy = false) =>
  entries(
    `<package><rounds><round><themes><theme><questions>
  <question price="100"${legacy ? "" : ` type="${type}"`}>
    ${legacy ? `<type name="${type}">${parameters}</type>` : `<params><param name="question" type="content"><item>Q</item></param>${parameters}</params>`}
    <scenario><atom>Q</atom></scenario><right><answer>A</answer></right>
  </question></questions></theme></themes></round></rounds></package>`,
  );

describe("SIQ secret normalization", () => {
  it("preserves modern dynamic/fixed rules, actor order and empty award; ignores theme and price=-1", async () => {
    const parsed = await parseSiq(entries(modern));
    const [secret, publicPrice, opener, award] = questions(parsed.content);
    expect(questions(parsed.content)).toHaveLength(4);
    expect(secret).toMatchObject({
      type: "secret",
      price: 100,
      transferType: "exceptCurrent",
      secretRules: {
        outcome: "question",
        priceAnnouncement: "afterTransfer",
        priceChooser: "receiver",
        priceRule: { kind: "roundExtremes" },
      },
    });
    expect(publicPrice).toMatchObject({
      transferType: "any",
      secretRules: {
        priceAnnouncement: "beforeTransfer",
        priceChooser: "receiver",
        priceRule: { kind: "range", min: 100, max: 1000000, step: 0 },
      },
    });
    expect(opener).toMatchObject({
      secretRules: { priceAnnouncement: "beforeTransfer", priceChooser: "opener" },
    });
    expect(award).toMatchObject({
      price: 400,
      realPrice: 750,
      text: null,
      answerText: null,
      secretRules: { outcome: "award", priceRule: null },
    });
    expect(parsed.warnings).toEqual([]);
    const draft = fromUpload(parsed.content);
    expect(validatePackage(draft, () => true).critical).toBe(0);
    const roundtrip = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(toUpload(draft))),
    });
    expect(
      questions(roundtrip.content).map(({ type, price, realPrice, secretRules, transferType }) => ({
        type,
        price,
        realPrice,
        secretRules,
        transferType,
      })),
    ).toEqual(
      questions(parsed.content).map(({ type, price, realPrice, secretRules, transferType }) => ({
        type,
        price,
        realPrice,
        secretRules,
        transferType,
      })),
    );
  });

  it("upgrades cat/bagcat self, knows and endpoints without a separate theme issue", async () => {
    const parsed = await parseSiq(entries(legacy));
    const [cat, before, defaults, award] = questions(parsed.content);
    expect(cat).toMatchObject({
      realPrice: 250,
      transferType: "exceptCurrent",
      secretRules: { priceRule: null },
    });
    expect(before).toMatchObject({
      transferType: "any",
      secretRules: {
        priceAnnouncement: "beforeTransfer",
        priceRule: { kind: "range", min: 100, max: 900, step: 800 },
      },
    });
    expect(defaults).toMatchObject({
      transferType: "exceptCurrent",
      secretRules: { priceAnnouncement: "afterTransfer", priceRule: { kind: "roundExtremes" } },
    });
    expect(award).toMatchObject({
      transferType: "exceptCurrent",
      secretRules: {
        outcome: "award",
        priceRule: { kind: "range", min: 200, max: 800, step: 200 },
      },
    });
    expect(parsed.warnings).toEqual([]);
  });

  it.each([
    [0, 0, 0, { priceRule: { kind: "roundExtremes" } }],
    [500, 500, 0, { realPrice: 500, priceRule: null }],
    [100, 500, 0, { priceRule: { kind: "range", min: 100, max: 500, step: 0 } }],
    [-1, 5, 0, null],
    [5, 1, 0, null],
    [0, 1000001, 0, null],
    [1, 5, -1, null],
    [1.5, 5, 1, null],
    [1, 5, Number.MAX_SAFE_INTEGER, null],
  ])("normalizes NumberSet %s/%s/%s", (min, max, step, expected) => {
    expect(normalizeSecretPrice(min as number, max as number, step as number)).toEqual(expected);
  });
  it("keeps legacy endpoints and validates the complete cost string", () => {
    expect(normalizeLegacySecretCost("[100;500]")).toEqual({
      priceRule: { kind: "range", min: 100, max: 500, step: 400 },
    });
    expect(normalizeLegacySecretCost("[100;500]/0")).toEqual({
      priceRule: { kind: "range", min: 100, max: 500, step: 0 },
    });
    expect(normalizeLegacySecretCost("[500;500]")).toEqual({ realPrice: 500, priceRule: null });
    for (const raw of ["[500;100]", "x[100;500]", "12tail", "Infinity", "9007199254740992"])
      expect(normalizeLegacySecretCost(raw)).toBeNull();
  });
  it.each([
    ["withButton", "simple"],
    ["auction", "stake"],
    ["sponsored", "noRisk"],
    ["forYourself", "noRisk"],
    ["simple", "simple"],
  ])("normalizes alias %s", async (raw, type) => {
    const parsed = await parseSiq(
      entries(
        `<package><rounds><round><themes><theme><questions><question price="100" type="${raw}"><scenario><atom>Q</atom></scenario><right><answer>A</answer></right></question></questions></theme></themes></round></rounds></package>`,
      ),
    );
    expect(questions(parsed.content)[0]!.type).toBe(type);
    expect(parsed.warnings).toEqual([]);
  });

  it("defaults an unspecified modern secret price to round extrema", async () => {
    const parsed = await parseSiq(secretPackage("secret", ""));
    expect(questions(parsed.content)[0]?.secretRules?.priceRule).toEqual({ kind: "roundExtremes" });
    expect(parsed.warnings).toEqual([]);
  });

  it.each([
    ["secret", '<param name="selectionMode">random</param>', false, "selectionMode"],
    [
      "secret",
      '<param name="price" type="content"><numberSet minimum="100" maximum="500"/></param>',
      false,
      "price",
    ],
    [
      "secret",
      '<param name="price" type="numberSet"><numberSet minimum="100" maximum="1000001"/></param>',
      false,
      "price",
    ],
    [
      "secret",
      '<param name="price" type="numberSet"><numberSet minimum="500" maximum="100"/></param>',
      false,
      "price",
    ],
    ["bagcat", '<param name="self">maybe</param>', true, "self"],
    ["bagcat", '<param name="knows">sometimes</param>', true, "knows"],
    ["bagcat", '<param name="cost">[100;1000001]</param>', true, "cost"],
    ["bagcat", '<param name="cost">[100;500]/1000001</param>', true, "cost"],
  ] as const)("retains a repair diagnostic for %s %s", async (type, parameters, old, field) => {
    const parsed = await parseSiq(secretPackage(type, parameters, old));
    const question = questions(parsed.content)[0];
    expect(question?.type).toBe("secret");
    expect(question?.compatibilityIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "critical",
          resolution: "needsRepair",
          source: expect.objectContaining({ parameter: field }),
        }),
      ]),
    );
    expect(() => assertPlayableCompatibility(parsed.content)).toThrow("compatibilityNeedsRepair");
  });
});

it("retains a bounded unresolved script with True media through draft/OQ and blocks play/publication until explicit conversion", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const parsed = await parseSiq({ ...entries(unresolved), "Images/only.png": bytes });
  const draft = fromUpload(parsed.content);
  const q = draft.rounds[0]!.themes[0]!.questions[0]!;
  expect(q.compatibilityIssues?.[0]).toMatchObject({
    severity: "critical",
    resolution: "needsRepair",
    source: { round: 0, theme: 0, question: 0 },
    sourceData: { type: "custom" },
  });
  const source = q.compatibilityIssues![0]!.sourceData!;
  expect(source.parameters.find((p) => p.name === "theme")?.items?.[0]?.value).toBe(
    "Referenced content, not a theme announcement",
  );
  expect(source.script?.[0]?.parameters[0]?.items?.[0]).toMatchObject({
    type: "image",
    isRef: "True",
    file: { type: "image" },
  });
  const hash = [...parsed.files.keys()][0]!;
  expect(reachableMedia(draft).has(hash)).toBe(true);
  await saveDraft({ id: "p0", pkg: draft, updatedAt: 1 }, parsed.files.values());
  expect((await loadDraft("p0"))?.pkg.rounds[0]?.themes[0]?.questions[0]?.id).toBe(q.id);
  const content = toUpload(draft);
  expect(() => assertPlayableCompatibility(content)).toThrow("compatibilityNeedsRepair");
  expect(
    validatePackage(draft, () => true).issues.some(
      (i) =>
        i.code === "compatibilityNeedsRepair" &&
        i.target.kind === "question" &&
        i.target.id === q.id,
    ),
  ).toBe(true);
  const roundtrip = await parseOq({
    "content.json": new TextEncoder().encode(JSON.stringify(content)),
    [`files/${hash}`]: bytes,
  });
  expect(questions(roundtrip.content)[0]?.compatibilityIssues?.[0]?.sourceData).toEqual(source);
  expect([...roundtrip.files.get(hash)!.bytes]).toEqual([1, 2, 3]);
  Object.assign(q, convertImportedQuestionToSimple(), { text: "Authored replacement" });
  expect(() => assertPlayableCompatibility(toUpload(draft))).not.toThrow();
  expect(validatePackage(draft, () => true).critical).toBe(0);
});

it("does not retain HTML via compatibility source metadata", async () => {
  const parsed = await parseSiq({ ...entries(unresolved), "Images/only.png": new Uint8Array([1]) });
  const content = structuredClone(parsed.content);
  const issue = questions(content)[0]!.compatibilityIssues![0]!;
  issue.sourceData!.script![0]!.parameters[0]!.items![0]!.type = "html";
  await expect(
    parseOq({ "content.json": new TextEncoder().encode(JSON.stringify(content)) }),
  ).rejects.toThrow("htmlConfirmationRequired");
});

it("exports and reimports 20 P5 item diagnostics without losing any repair source", async () => {
  const parsed = await parseSiq(entries(modern));
  const issues = Array.from({ length: 20 }, (_, index) => ({
    code: "contentNeedsRepair" as const,
    where: "Round › Theme › 100",
    feature: "authoredContent",
    detail: "Unknown placement",
    contentSource: {
      type: "text",
      text: "Retained " + index,
      placement: "future",
      duration: "bad",
      waitForFinish: null,
      time: null,
    },
    severity: "critical" as const,
    resolution: "needsRepair" as const,
  }));
  questions(parsed.content)[0]!.compatibilityIssues = issues;
  const archive = await exportOq(fromUpload(parsed.content), new Map());
  const restored = await parseOq(unzipSync(new Uint8Array(await archive.arrayBuffer())));
  expect(questions(restored.content)[0]!.compatibilityIssues).toEqual(issues);
  expect(validatePackage(fromUpload(restored.content), () => true).critical).toBe(1);
});

it("keeps original source coordinates when HTML removal changes preceding indices", async () => {
  const xml = `<package><rounds><round><themes><theme><questions><question price="100" type="html"/><question price="200" type="custom"><scenario><atom>Retained</atom></scenario></question></questions></theme></themes></round></rounds></package>`;
  const parsed = await parseSiq(entries(xml), true);
  expect(questions(parsed.content)[0]!.compatibilityIssues?.[0]?.source).toMatchObject({
    round: 0,
    theme: 0,
    question: 1,
  });
});
