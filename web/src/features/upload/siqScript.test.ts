import { describe, expect, it } from "vitest";
import fixture from "./fixtures/siq/script-two-asks.xml?raw";
import { parseSiq } from "./siq";
import { toContent } from "./oq";
import { SI_SCRIPT_TEMPLATES } from "./siqScript";
import { fromUpload, toUpload } from "@/features/package-editor/packageDraft";
import { validatePackage } from "@/features/package-editor/validatePackage";
import { HtmlConfirmationRequiredError } from "./htmlRemoval";
import { PackageContentLimitError } from "./contentLimits";

const parse = (xml: string, remove = false) =>
  parseSiq({ "content.xml": new TextEncoder().encode(xml) }, remove);
const first = (content: Awaited<ReturnType<typeof parse>>["content"]) =>
  content.rounds[0]!.themes[0]!.questions[0]!;
const custom = (
  script: string,
  data = '<param name="question" type="content"><item>Prompt</item></param>',
) =>
  `<package name="P"><rounds><round name="R"><themes><theme name="T"><questions><question type="custom" price="100"><params>${data}</params><script>${script}</script><right><answer>42</answer></right></question></questions></theme></themes></round></rounds></package>`;
const step = (op: string, operands = "") => `<step type="${op}">${operands}</step>`;
const param = (name: string, value: string) => `<param name="${name}">${value}</param>`;
const option = (name: string, item = "<item>Choice</item>") => param(name, item);
const select = (...options: string[]) =>
  step("setAnswerType", param("type", "select") + param("options", options.join("")));
const ask = (mode: string, duration: string) =>
  step("askAnswer", param("mode", mode) + param("duration", duration));

describe("typed SI scripts", () => {
  it.each([
    ["empty program", "", "script step limit"],
    ["unknown operation", step("unknown"), "unknown script operation"],
    ["unknown operand", step("accept", param("other", "x")), "unknown operand"],
    [
      "unknown answer format",
      step("setAnswerType", param("type", "video")),
      "unsupported answer type",
    ],
    ["one option", select(option("42")), "invalid option labels"],
    ["duplicate labels", select(option("42"), option("42")), "invalid option labels"],
    ["empty option", select(option("42", ""), option("B")), "empty option"],
    [
      "private option",
      select(option("42", '<item placement="replic">Secret</item>'), option("B")),
      "private replic",
    ],
    ["unknown right label", select(option("A"), option("B")), "unknown right option label"],
    ["no content parameter", step("showContent"), "missing content"],
    ["empty content", step("showContent", param("content", "")), "empty or unsupported content"],
    ["unsupported answer mode", ask("auto", "1"), "unsupported ask mode"],
    ["fractional duration", ask("direct", "1.5"), "invalid answer duration"],
    ["negative duration", ask("button", "-1"), "invalid answer duration"],
    ["duration past one day", ask("direct", "86401"), "invalid answer duration"],
    [
      "unsupported transfer selection",
      step("setAnswerer", param("mode", "byCurrent") + param("select", "highest")),
      "unsupported answerer",
    ],
    [
      "visible group stake",
      step(
        "setAnswerer",
        param("mode", "stake") +
          param("select", "allPossible") +
          param("stakeVisibility", "visible"),
      ),
      "unsupported stake selection",
    ],
    ["missing price range", step("announcePrice"), "missing NumberSet"],
    [
      "descending price range",
      step("announcePrice", param("content", '<numberSet minimum="500" maximum="100"/>')),
      "invalid NumberSet",
    ],
    [
      "fractional price step",
      step(
        "announcePrice",
        param("content", '<numberSet minimum="100" maximum="500" step="0.5"/>'),
      ),
      "invalid NumberSet",
    ],
    [
      "content with fixed multiplier",
      step("setPrice", param("mode", "multiply") + param("content", "ignored")),
      "unexpected content",
    ],
    [
      "reserved price policy",
      step("setPrice", param("mode", "forYourself")),
      "unsupported setPrice mode",
    ],
    [
      "malformed point",
      step("setAnswerType", param("type", "point")),
      "invalid point right answer",
    ],
  ])("retains a repair diagnostic for %s", async (_name, script, detail) => {
    const { content } = await parse(custom(script));
    expect(first(content).script).toBeUndefined();
    expect(first(content).compatibilityIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "critical",
          resolution: "needsRepair",
          detail: expect.stringContaining(detail),
        }),
      ]),
    );
  });

  it("rejects source that exceeds the retained program size instead of truncating it", async () => {
    await expect(parse(custom(step("setTheme").repeat(129)))).rejects.toThrow("siqSourceLimit");
  });

  it.each([
    [
      "numeric key",
      step("setAnswerType", param("type", "number")),
      "invalid numeric right answer",
      "",
      "not a number",
    ],
    [
      "deviation",
      ask("direct", "5"),
      "invalid answer deviation",
      param("answerDeviation", "-1"),
      "42",
    ],
    ["empty option label", select(option("42"), option("")), "invalid option labels", "", "42"],
    [
      "missing primary reference",
      step("showContent", '<param name="content" isRef="true">missing</param>'),
      "missing reference",
      "",
      "42",
    ],
    [
      "unavailable media option",
      select(option("42", '<item type="image" isRef="true">missing.png</item>'), option("B")),
      "missing script media",
      "",
      "42",
    ],
    [
      "blank option",
      select(option("42", "<item/>"), option("B")),
      "unavailable option content",
      "",
      "42",
    ],
  ])("keeps the original source for a bad %s", async (_name, script, detail, data, right) => {
    const { content } = await parse(
      custom(script, data).replace("<answer>42</answer>", `<answer>${right}</answer>`),
    );
    expect(first(content)).toMatchObject({
      compatibilityIssues: [
        expect.objectContaining({
          severity: "critical",
          detail: expect.stringContaining(detail),
          sourceData: expect.objectContaining({ type: "custom" }),
        }),
      ],
    });
  });

  it("uses the default text type and duration when their optional source references are absent", async () => {
    const format = step("setAnswerType", '<param name="type" isRef="true">answerType</param>');
    const answer = step(
      "askAnswer",
      param("mode", "direct") + '<param name="duration" isRef="true">answerDuration</param>',
    );
    const { content } = await parse(custom(format + answer, ""));
    expect(first(content).script?.steps).toEqual([
      { op: "setAnswerType", answerType: "text" },
      { op: "askAnswer", mode: "direct", durationMs: null },
    ]);
  });

  it("accepts both duration boundaries and both supported stake modes", async () => {
    const setStake = (selection: string, visibility: string) =>
      step(
        "setAnswerer",
        param("mode", "stake") + param("select", selection) + param("stakeVisibility", visibility),
      );
    const { content } = await parse(
      custom(
        setStake("highest", "visible") +
          ask("button", "0") +
          setStake("allPossible", "hidden") +
          ask("direct", "86400"),
      ),
    );
    expect(first(content).script?.steps).toEqual([
      { op: "setAnswerer", mode: "stake", select: "highest", stakeVisibility: "visible" },
      { op: "askAnswer", mode: "button", durationMs: null },
      { op: "setAnswerer", mode: "stake", select: "allPossible", stakeVisibility: "hidden" },
      { op: "askAnswer", mode: "direct", durationMs: 86_400_000 },
    ]);
  });

  it.each([
    ['<item waitForFinish="sometimes">Prompt</item>', "waitForFinish"],
    ['<item placement="background">Prompt</item>', "placement"],
    ['<item type="audio" placement="replic">audio.mp3</item>', "placement"],
  ])("marks unsupported playback attributes for repair: %s", async (item, diagnostic) => {
    const { content } = await parse(custom(`<step><param name="content">${item}</param></step>`));
    const question = first(content);
    expect(question.script).toBeUndefined();
    expect(question).toMatchObject({
      compatibilityIssues: [
        {
          severity: "critical",
          resolution: "needsRepair",
          detail: expect.stringContaining(diagnostic),
        },
      ],
    });
  });

  it("retains default SIQ point tolerance when a later step switches to text", async () => {
    const xml = custom(
      '<step type="setAnswerType"><param name="type">point</param></step>' +
        '<step><param name="content"><item type="image" isRef="true">map.png</item></param></step>' +
        '<step type="askAnswer"><param name="mode">direct</param></step>' +
        '<step type="setAnswerType"><param name="type">text</param></step>',
    ).replace("<answer>42</answer>", "<answer>0.4,0.6,2</answer>");
    const { content } = await parseSiq({
      "content.xml": new TextEncoder().encode(xml),
      "Images/map.png": new Uint8Array([1]),
    });
    expect(first(content)).toMatchObject({
      script: { version: 1 },
      answerPoint: { x: 0.4, y: 0.6, sourceGeometry: { kind: "sigame", aspectRatio: 2 } },
      answerDeviation: 0.02,
    });
  });

  it("A24/A35 preserves two asks, inline/ref/right fallback, durations and ignored theme across draft/archive", async () => {
    const parsed = await parse(fixture);
    const q = first(parsed.content);
    expect(parsed.warnings.filter((warning) => warning.severity === "critical")).toEqual([]);
    expect(q.script?.steps.map((step) => step.op)).toEqual([
      "setTheme",
      "setAnswerType",
      "setAnswerer",
      "showContent",
      "askAnswer",
      "showContent",
      "askAnswer",
      "showContent",
    ]);
    expect(q.script?.steps.filter((step) => step.op === "askAnswer")).toEqual([
      { op: "askAnswer", mode: "direct", durationMs: 15000 },
      { op: "askAnswer", mode: "direct", durationMs: 2000 },
    ]);
    expect(q.textItems).toMatchObject([
      { order: 0, text: "First prompt", placement: "screen", waitForFinish: true },
    ]);
    expect(q.script?.answerTextItems).toMatchObject([
      { order: 0, text: "Second prompt", placement: "screen", waitForFinish: true },
    ]);
    expect(q.script?.steps.at(-1)).toEqual({
      op: "showContent",
      phase: "answer",
      orders: [],
      revealRight: true,
    });
    const roundTrip = toUpload(fromUpload(parsed.content));
    expect(first(roundTrip).script).toEqual(q.script);
    expect(
      first(toContent(roundTrip as unknown as Record<string, unknown>, new Map(), [])).script,
    ).toEqual(q.script);
    expect(roundTrip.rounds[0]!.themes[0]!.name).toBe("Cell theme");
  });

  it("keeps source labels per select step, but only the first right is a live key", async () => {
    const set = (left: string, right: string) =>
      `<step type="setAnswerType"><param name="type">select</param><param name="options" type="group"><param name="A" type="content"><item>${left}</item></param><param name="B" type="content"><item>${right}</item></param></param></step><step type="askAnswer"><param name="mode">direct</param></step>`;
    const parsed = await parse(
      custom(set("Same", "Same") + set("Left", "Right")).replace(
        "<answer>42</answer>",
        "<answer>B</answer><answer>A</answer>",
      ),
    );
    const question = first(parsed.content);
    expect(question.answers?.map(({ sourceLabel }) => sourceLabel)).toEqual(["A", "B", "A", "B"]);
    expect(
      question.script?.steps.flatMap((step) =>
        step.op === "setAnswerType" ? [step.correctChoiceOrder] : [],
      ),
    ).toEqual([1, 3]);
    const draft = toUpload(fromUpload(parsed.content));
    const restored = first(toContent(draft as unknown as Record<string, unknown>, new Map(), []));
    expect(restored.answers).toEqual(question.answers);
    expect(restored.answerText).toBe("B");
    expect(restored.rightAnswers).toEqual(["A"]);
  });

  it.each([
    ["no active content", ""],
    ["text follows image", '<step><param name="content" isRef="true">question</param></step>'],
  ])("marks a point ask for repair when %s", async (_label, show) => {
    const format = '<step type="setAnswerType"><param name="type">point</param></step>';
    const ask = '<step type="askAnswer"><param name="mode">direct</param></step>';
    const data =
      '<param name="question" type="content"><item type="image" isRef="true">map.png</item><item>Tail</item></param>';
    const xml = custom(format + show + ask, data).replace(
      "<answer>42</answer>",
      "<answer>0.4,0.6</answer>",
    );
    const parsed = await parseSiq({
      "content.xml": new TextEncoder().encode(xml),
      "Images/map.png": new Uint8Array([1]),
    });
    const question = first(parsed.content);
    expect(question).toMatchObject({
      answerType: "point",
      pointImageOrder: -1,
      compatibilityIssues: [
        {
          severity: "critical",
          resolution: "needsRepair",
          detail: expect.stringContaining("point ask needs an image"),
        },
      ],
    });
    expect(question.script).toBeUndefined();
    expect(validatePackage(fromUpload(parsed.content), () => true).critical).toBeGreaterThan(0);
  });

  it("compiles a native point template with the last image occurrence of a repeated hash", async () => {
    const image = '<item type="image" isRef="true">map.png</item>';
    const data =
      '<param name="answerType">point</param>' +
      `<param name="question" type="content">${image}<item>Middle</item>${image}</param>`;
    const xml = custom(SI_SCRIPT_TEMPLATES.simple!, data).replace(
      "<answer>42</answer>",
      "<answer>0.4,0.6</answer>",
    );
    const result = await parseSiq({
      "content.xml": new TextEncoder().encode(xml),
      "Images/map.png": new Uint8Array([1]),
    });
    const question = first(result.content);
    expect(question).toMatchObject({ script: null, answerType: "point", pointImageOrder: 2 });
    expect(question.questionFiles?.map(({ file }) => file.md5)).toEqual([
      question.questionFiles?.[0]?.file.md5,
      question.questionFiles?.[0]?.file.md5,
    ]);
  });

  it.each([
    ["withButton", "button", ""],
    ["forAll", "direct", '<step type="setAnswerer"><param name="mode">all</param></step>'],
  ])(
    "compiles the pinned 0f4986d2 %s template and keeps the step in custom programs",
    async (mode, answerMode, answerer) => {
      const template =
        '<step type="setAnswerType"><param name="type" isRef="true">answerType</param><param name="options" isRef="true">answerOptions</param></step>' +
        answerer +
        `<step type="setPrice"><param name="mode">${mode}</param></step>` +
        '<step type="showContent"><param name="content" isRef="true">question</param></step>' +
        `<step type="askAnswer"><param name="mode">${answerMode}</param></step>` +
        '<step type="showContent"><param name="content" isRef="true">answer</param><param name="fallbackRefId" isRef="true">right</param></step>';
      const native = first((await parse(custom(template))).content);
      expect(native.script).toBeNull();
      if (mode === "forAll") expect(native.subType).toBe("forEveryone");
      const typed = (await parse(custom(template + '<step type="accept"/>'))).content;
      expect(first(typed).script?.steps).toContainEqual({ op: "setPrice", mode });
      const draft = toUpload(fromUpload(typed));
      const restored = first(toContent(draft as unknown as Record<string, unknown>, new Map(), []));
      expect(restored.script).toEqual(first(typed).script);
    },
  );

  it("keeps historical noRisk distinct from modern multiply in a custom program", async () => {
    const typed = first(
      (
        await parse(
          custom(
            '<step type="setPrice"><param name="mode">noRisk</param></step><step type="setPrice"><param name="mode">multiply</param></step>',
          ),
        )
      ).content,
    );
    expect(typed.script?.steps).toEqual([
      { op: "setPrice", mode: "noRisk" },
      { op: "setPrice", mode: "multiply" },
    ]);
  });

  it("compiles only the exact native template, retaining a modified template as a program", async () => {
    const exact = first((await parse(custom(SI_SCRIPT_TEMPLATES.simple!))).content);
    expect(exact.type).toBe("simple");
    expect(exact.script).toBeNull();
    const extra = first(
      (await parse(custom(SI_SCRIPT_TEMPLATES.simple! + '<step type="accept"/>'))).content,
    );
    expect(extra.script?.steps.at(-1)?.op).toBe("accept");
  });

  it.each([
    ['<step type="runCode"/>', "unknown script operation"],
    [
      '<step type="setPrice"><param name="mode">forYourself</param></step>',
      "unsupported setPrice mode: forYourself",
    ],
    ['<step><param name="content" isRef="True">missing</param></step>', "missing reference"],
    [
      '<step type="setAnswerType"><param name="type">client</param></step>',
      "unsupported answer type",
    ],
  ])("A25 retains bounded repair instead of running a fallback: %s", async (script, detail) => {
    const parsed = await parse(custom(script));
    const q = first(parsed.content);
    expect(q.script).toBeUndefined();
    expect(q.compatibilityIssues?.[0]).toMatchObject({
      severity: "critical",
      resolution: "needsRepair",
      detail: expect.stringContaining(detail),
    });
    expect(validatePackage(fromUpload(parsed.content), () => true).critical).toBeGreaterThan(0);
  });

  it("resolves redirected standard question content and keeps a standard reference cycle blocked", async () => {
    const valid = fixture
      .replace('type="custom"', 'type="simple"')
      .replace(/<script>[\s\S]*?<\/script>/, "");
    expect(first((await parse(valid)).content).text).toBe("First prompt");
    const cyclic = valid.replace(
      '<param name="prompt" type="content"><item>First prompt</item></param>',
      '<param name="prompt" isRef="TRUE">question</param>',
    );
    expect(first((await parse(cyclic)).content).compatibilityIssues?.[0]?.detail).toContain(
      "reference cycle",
    );
  });

  it("A25 applies existing HTML removal consent inside inline scripts", async () => {
    const xml = custom(
      '<step><param name="content" type="content"><item type="html">forbidden.html</item></param></step>',
    );
    await expect(parse(xml)).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
  });

  it("A29 counts repeated resolved content references rather than only parameter definitions", async () => {
    const script = '<step><param name="content" isRef="True">question</param></step>'.repeat(31);
    await expect(parse(custom(script))).rejects.toBeInstanceOf(PackageContentLimitError);
  });

  it("A29 checks authored file limits before missing files can reduce the group", async () => {
    const items = '<item type="image" waitForFinish="False" isRef="True">missing.jpg</item>'.repeat(
      11,
    );
    await expect(
      parse(custom(`<step><param name="content" type="content">${items}</param></step>`)),
    ).rejects.toBeInstanceOf(PackageContentLimitError);
  });

  it("keeps authored prices for explicit and inherited final themes across draft and archive", async () => {
    const explicit = custom('<step type="setPrice"><param name="mode">noRisk</param></step>');
    const inherited =
      '<question price="300"><params><param name="question" type="content"><item>Prompt</item></param></params><right><answer>42</answer></right></question>';
    const xml = explicit
      .replace('<round name="R">', '<round name="R" type="final">')
      .replace(
        "</theme></themes>",
        `</theme><theme name="Other"><questions>${inherited}</questions></theme></themes>`,
      );
    const parsed = await parse(xml);
    const draft = toUpload(fromUpload(parsed.content));
    const archive = toContent(draft as unknown as Record<string, unknown>, new Map(), []);
    const [scripted, defaultFinal] = archive.rounds[0]!.themes.map((theme) => theme.questions[0]!);
    expect(scripted).toMatchObject({
      price: null,
      realPrice: 100,
      script: { steps: [{ op: "setPrice", mode: "noRisk" }] },
    });
    expect(defaultFinal).toMatchObject({ price: null, realPrice: 300 });
    expect(defaultFinal?.script).toBeUndefined();
  });

  it("keeps explicit supported final programs while inherited final remains native", async () => {
    const final = fixture.replace('<round name="Round">', '<round name="Round" type="themeList">');
    expect(first((await parse(final)).content).script?.steps).toHaveLength(8);
    const inherited = final.replace('type="custom"', "").replace(/<script>[\s\S]*?<\/script>/, "");
    expect(first((await parse(inherited)).content).script).toBeUndefined();
  });

  it("distinguishes modern explicit button final from inherited and upgraded legacy simple final", async () => {
    const body =
      '<params><param name="question" type="content"><item>Prompt</item></param></params><right><answer>42</answer></right>';
    const wrap = (question: string) =>
      `<package name="P"><rounds><round name="F" type="final"><themes><theme name="T"><questions>${question}</questions></theme></themes></round></rounds></package>`;
    expect(
      first(
        (await parse(wrap(`<question type="simple">${body}</question>`))).content,
      ).script?.steps.some((step) => step.op === "askAnswer" && step.mode === "button"),
    ).toBe(true);
    expect(
      first((await parse(wrap(`<question>${body}</question>`))).content).script,
    ).toBeUndefined();
    expect(
      first((await parse(wrap(`<question><type name="simple"/>${body}</question>`))).content)
        .script,
    ).toBeUndefined();
  });
});
