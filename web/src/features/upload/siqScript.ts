import { missingScriptPointImageStep } from "@/game/questionScript";
import type { QuestionScriptDTO, QuestionScriptStep, ScriptNumberSet } from "@/game/questionScript";
import { scriptPointImageOrder } from "@/lib/pointImage";
import { parseSiqPoint } from "./siqPoint";
import type { ImportWarning, QuestionFile, QuestionTextItem, UploadQuestion } from "./types";

const children = (element: Element | null, name: string) =>
  [...(element?.children ?? [])].filter((item) => item.localName === name);
const child = (element: Element | null, name: string) => children(element, name)[0] ?? null;
const value = (element: Element | null) => (element?.textContent ?? "").trim();
const params = (element: Element | null) => children(element, "param");
const parameter = (element: Element | null, name: string) =>
  params(element).find((item) => item.getAttribute("name") === name) ?? null;
const ref = (name: string) => `<param name="content" isRef="true">${name}</param>`;
const step = (op: string, content = "") => `<step type="${op}">${content}</step>`;
const simple = (name: string, content: string) => `<param name="${name}">${content}</param>`;
const reference = (name: string, content: string) =>
  `<param name="${name}" isRef="true">${content}</param>`;
const format = step(
  "setAnswerType",
  reference("type", "answerType") + reference("options", "answerOptions"),
);
const question = step("showContent", ref("question"));
const answer = step("showContent", ref("answer") + reference("fallbackRefId", "right"));
const ask = (mode: string) =>
  step("askAnswer", simple("mode", mode) + reference("duration", "answerDuration"));
const answerer = (mode: string, select?: string, visibility?: string) =>
  step(
    "setAnswerer",
    simple("mode", mode) +
      (select
        ? mode === "byCurrent"
          ? reference("select", select)
          : simple("select", select)
        : "") +
      (visibility ? simple("stakeVisibility", visibility) : ""),
  );
const announce = step("announcePrice", ref("price"));
const price = step("setPrice", simple("mode", "select") + ref("price"));
const transfer = answerer("byCurrent", "selectionMode");

/** Pinned SI ScriptsLibrary 0c216772; theme is deliberately an OQ no-op. */
export const SI_SCRIPT_TEMPLATES: Record<string, string> = {
  simple: format + question + ask("button") + answer,
  stake: format + answerer("stake", "highest", "visible") + question + ask("direct") + answer,
  stakeAll: format + answerer("stake", "allPossible", "hidden") + question + ask("direct") + answer,
  forAll: format + answerer("all") + question + ask("direct") + answer,
  noRisk:
    format +
    answerer("current") +
    step("setPrice", simple("mode", "multiply")) +
    question +
    ask("direct") +
    answer,
  secret: format + transfer + announce + price + question + ask("direct") + answer,
  secretPublicPrice: format + announce + transfer + price + question + ask("direct") + answer,
  secretOpenerPrice: format + announce + price + transfer + question + ask("direct") + answer,
  secretNoQuestion: transfer + announce + price + step("accept"),
};

const aliases: Record<string, string> = {
  withButton: "simple",
  forYourself: "noRisk",
  sponsored: "noRisk",
  auction: "stake",
};
const historicalTemplates = Object.entries(SI_SCRIPT_TEMPLATES).map(
  ([kind, xml]) =>
    [
      kind,
      xml
        .replace(format, "")
        .replaceAll(reference("duration", "answerDuration"), "")
        .replace(simple("mode", "multiply"), simple("mode", "noRisk"))
        .replace(announce, ""),
    ] as const,
);
// SI 0f4986d2 retained answer format and inserted these price steps before
// content. Its ask steps predate the optional duration reference.
const historicalPriceTemplates = [
  [
    "simple",
    format + step("setPrice", simple("mode", "withButton")) + question + ask("button") + answer,
  ],
  [
    "forAll",
    format +
      answerer("all") +
      step("setPrice", simple("mode", "forAll")) +
      question +
      ask("direct") +
      answer,
  ],
  [
    "noRisk",
    SI_SCRIPT_TEMPLATES.noRisk!.replace(simple("mode", "multiply"), simple("mode", "noRisk")),
  ],
].map(
  ([kind, xml]) => [kind!, xml!.replaceAll(reference("duration", "answerDuration"), "")] as const,
);
const scriptElement = (xml: string) =>
  new DOMParser().parseFromString(`<script>${xml}</script>`, "application/xml").documentElement;

let templateSignatures: { kind: string; value: string }[] | undefined;

function matchingTemplate(script: Element): string | null {
  templateSignatures ??= [
    // Modern multiply keeps the room's wrong-answer penalty. Native noRisk drops it.
    ...Object.entries(SI_SCRIPT_TEMPLATES).filter(([kind]) => kind !== "noRisk"),
    ...historicalPriceTemplates,
    ...historicalTemplates,
  ].map(([kind, xml]) => ({ kind, value: signature(scriptElement(xml)) }));
  const sourceSignature = signature(script);
  return templateSignatures.find(({ value }) => value === sourceSignature)?.kind ?? null;
}

// Equality includes operand types, reference identities and defaults; never infer a template from one operation.
function signature(script: Element): string {
  const parameterSignature = (param: Element): unknown => [
    param.getAttribute("name"),
    param.getAttribute("isRef")?.toLowerCase() === "true"
      ? "reference"
      : (param.getAttribute("type") ?? "simple"),
    param.getAttribute("isRef")?.toLowerCase() === "true",
    params(param).length ? params(param).map(parameterSignature) : value(param),
  ];
  return JSON.stringify(
    children(script, "step")
      .filter((item) => item.getAttribute("type") !== "setTheme")
      .map((item) => [
        item.getAttribute("type") ?? "showContent",
        params(item)
          .map(parameterSignature)
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ]),
  );
}

interface ScriptContent {
  textItems: QuestionTextItem[];
  questionFiles: QuestionFile[];
}

export interface SiqScriptResult {
  script: QuestionScriptDTO | null;
  fields: Partial<UploadQuestion>;
  nativeKind: string | null;
  issue?: ImportWarning;
}

/** Standard types also use StepParameter references; resolve only the current question's parameter map. */
export function resolveSiqQuestionParameters(
  source: Element,
  where: string,
): { question: Element; issue?: ImportWarning } {
  const original = child(source, "params");
  if (
    !original ||
    (params(original).length <= 128 &&
      ![...original.getElementsByTagName("*")].some(
        (item) =>
          item.localName === "param" && item.getAttribute("isRef")?.toLowerCase() === "true",
      ))
  )
    return { question: source };
  const question = source.cloneNode(true) as Element;
  const data = child(question, "params");
  let work = 0;
  const resolve = (input: Element, seen: Set<string>, depth: number): Element => {
    if (depth > 32 || ++work > 2048) throw new Error("parameter reference expansion limit");
    let result = input.cloneNode(true) as Element;
    if (input.getAttribute("isRef")?.toLowerCase() === "true") {
      const id = value(input);
      if (seen.has(id)) throw new Error(`reference cycle: ${id}`);
      const target = parameter(data, id);
      if (!target) throw new Error(`missing reference: ${id}`);
      result = resolve(target, new Set([...seen, id]), depth + 1);
      result.setAttribute("name", input.getAttribute("name") ?? "");
      return result;
    }
    for (const nested of params(result)) nested.replaceWith(resolve(nested, seen, depth + 1));
    return result;
  };
  try {
    if (params(data).length > 128) throw new Error("parameter count limit");
    if (data && new XMLSerializer().serializeToString(data).length > 1_000_000)
      throw new Error("parameter size limit");
    const resolved = params(data).map((input) =>
      resolve(input, new Set([input.getAttribute("name") ?? ""]), 0),
    );
    data?.replaceChildren(...resolved);
    return { question };
  } catch (error) {
    return {
      question,
      issue: {
        code: "siqCompatibility",
        where,
        severity: "critical",
        resolution: "needsRepair",
        detail: error instanceof Error ? error.message : "invalid parameters",
        sourceData: {
          type: source.getAttribute("type") ?? "",
          parameters: [
            {
              name: "params",
              type: "simple",
              value: new XMLSerializer()
                .serializeToString(child(source, "params") ?? source)
                .slice(0, 16_384),
            },
          ],
        },
      },
    };
  }
}

export function readSiqScript(
  source: Element,
  where: string,
  final: boolean,
  readContent: (content: Element) => ScriptContent,
): SiqScriptResult | null {
  const rawType = (
    source.getAttribute("type") ??
    child(source, "type")?.getAttribute("name") ??
    ""
  ).trim();
  const kind = Object.hasOwn(aliases, rawType) ? aliases[rawType]! : rawType;
  let script = child(source, "script");
  const modernExplicit = !!source.getAttribute("type")?.trim();
  // Question.Upgrade turns legacy <type name="simple"> into Default. A modern
  // explicit type="simple" keeps the button script even when the round is final.
  if (
    !script &&
    final &&
    kind &&
    (kind !== "simple" || modernExplicit) &&
    Object.hasOwn(SI_SCRIPT_TEMPLATES, kind)
  )
    script = scriptElement(SI_SCRIPT_TEMPLATES[kind]!);
  if (!script) {
    if (final && kind && !["simple", "default", "choice"].includes(kind))
      return {
        script: null,
        fields: {},
        nativeKind: null,
        issue: {
          code: "siqCompatibility",
          where,
          detail: `unsupported explicit final type: ${rawType}`,
          severity: "critical",
          resolution: "needsRepair",
          sourceData: { type: rawType, parameters: [] },
        },
      };
    return null;
  }
  const data = child(source, "params");
  const fields: Partial<UploadQuestion> = {
    questionComment: null,
    text: null,
    textOrder: null,
    textItems: [],
    questionFiles: [],
    answerFiles: [],
    answers: [],
  };
  const steps: QuestionScriptStep[] = [];
  const right = children(child(source, "right"), "answer").map(value);
  const phaseOrders = { question: 0, answer: 0 };
  let phase: "question" | "answer" = "question";
  const answerTexts: NonNullable<UploadQuestion["textItems"]> = [];
  let needsPointTarget = false;

  const fail = (detail: string): never => {
    throw new Error(detail);
  };
  const resolve = (
    input: Element | null,
    optionalRef?: string,
    seen = new Set<string>(),
  ): Element | null => {
    if (!input) return null;
    if (input.getAttribute("isRef")?.toLowerCase() !== "true") return input;
    const id = value(input);
    if (seen.has(id)) return fail(`reference cycle: ${id}`);
    seen.add(id);
    const found = parameter(data, id);
    if (!found) {
      if (id === optionalRef) return null;
      return fail(`missing reference: ${id}`);
    }
    return resolve(found, undefined, seen);
  };
  const read = (item: Element, name: string, optionalRef?: string) =>
    resolve(parameter(item, name), optionalRef);
  const scalar = (item: Element, name: string, optionalRef?: string) =>
    value(read(item, name, optionalRef));
  const range = (item: Element): ScriptNumberSet => {
    const node = child(read(item, "content"), "numberSet");
    if (!node) return fail("missing NumberSet");
    const values = ["minimum", "maximum", "step"].map((name) =>
      Number(node.getAttribute(name) ?? "0"),
    );
    const [min, max, increment] = values;
    if (values.some((n) => !Number.isSafeInteger(n) || n < 0 || n > 1_000_000) || min! > max!)
      return fail("invalid NumberSet");
    return { min: min!, max: max!, step: increment! };
  };
  const appendContent = (content: Element): number[] => {
    const parsed = readContent(content);
    const entries = [
      ...parsed.questionFiles.map((file) => ({ order: file.order, file })),
      ...parsed.textItems.map((text) => ({ order: text.order, text })),
    ].sort((a, b) => a.order - b.order);
    const orders: number[] = [];
    for (const entry of entries) {
      const order = phaseOrders[phase]++;
      orders.push(order);
      if ("file" in entry)
        (phase === "question" ? fields.questionFiles! : fields.answerFiles!)!.push({
          ...entry.file,
          order,
        });
      else (phase === "question" ? fields.textItems! : answerTexts).push({ ...entry.text, order });
    }
    return orders;
  };

  try {
    const sourceSteps = children(script, "step");
    if (!sourceSteps.length || sourceSteps.length > 128) fail("script step limit (1–128)");
    for (const item of sourceSteps) {
      const op = item.getAttribute("type") ?? "showContent";
      if (op === "setTheme") {
        steps.push({ op });
        continue;
      }
      const allowed: Record<string, string[]> = {
        setAnswerType: ["type", "options"],
        showContent: ["content", "fallbackRefId"],
        askAnswer: ["mode", "duration"],
        setAnswerer: ["mode", "select", "stakeVisibility"],
        announcePrice: ["content"],
        setPrice: ["mode", "content"],
        accept: [],
      };
      if (params(item).some((param) => !allowed[op]?.includes(param.getAttribute("name") ?? "")))
        fail(`unknown operand for ${op}`);
      if (op === "setAnswerType") {
        const answerType = scalar(item, "type", "answerType") || "text";
        if (!["text", "number", "point", "select"].includes(answerType))
          fail(`unsupported answer type: ${answerType}`);
        const typed: Extract<QuestionScriptStep, { op: "setAnswerType" }> = {
          op,
          answerType: answerType as "text" | "number" | "point" | "select",
        };
        if (answerType === "select") {
          const options = read(item, "options", "answerOptions");
          const labels = params(options).map((option) => option.getAttribute("name") ?? "");
          if (
            labels.length < 2 ||
            new Set(labels).size !== labels.length ||
            labels.some((label) => !label || label.length > 500)
          )
            fail("invalid option labels");
          typed.optionOrders = [];
          for (const option of params(options)) {
            const resolved = resolve(option);
            const first = child(resolved, "item");
            if (!first) fail("empty option");
            if (
              first?.getAttribute("placement") === "replic" ||
              first?.getAttribute("type") === "say"
            )
              fail("private replic cannot be a select option");
            const wrapper = source.ownerDocument.createElement("param");
            wrapper.append(first!.cloneNode(true));
            const parsed = readContent(wrapper);
            const file = parsed.questionFiles[0]?.file ?? null;
            const text = parsed.textItems[0]?.text ?? null;
            if (!file && !text) fail("unavailable option content");
            const order = fields.answers!.length;
            fields.answers!.push({ order, text, file, sourceLabel: option.getAttribute("name") });
            typed.optionOrders.push(order);
          }
          const key = labels.indexOf(right[0] ?? "");
          if (key < 0) fail("unknown right option label");
          typed.correctChoiceOrder = typed.optionOrders[key]!;
        }
        steps.push(typed);
      } else if (op === "showContent") {
        const input = parameter(item, "content");
        let content: Element | null = null;
        const fallback = value(parameter(item, "fallbackRefId"));
        const missingPrimary =
          input?.getAttribute("isRef")?.toLowerCase() === "true" && !parameter(data, value(input));
        if (missingPrimary && fallback === "right") {
          steps.push({ op, phase, orders: [], revealRight: true });
        } else {
          content = resolve(input);
          if (!content) fail("missing content");
          const orders = appendContent(content!);
          if (!orders.length) fail("empty or unsupported content");
          steps.push({ op, phase, orders });
        }
      } else if (op === "askAnswer") {
        const mode = scalar(item, "mode");
        if (mode !== "button" && mode !== "direct") fail(`unsupported ask mode: ${mode}`);
        const raw = scalar(item, "duration", "answerDuration");
        const seconds = raw ? Number(raw) : 0;
        if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 86_400)
          fail("invalid answer duration");
        steps.push({
          op,
          mode: mode as "button" | "direct",
          durationMs: seconds > 0 ? seconds * 1000 : null,
        });
        phase = "answer";
      } else if (op === "setAnswerer") {
        const mode = scalar(item, "mode");
        const select = scalar(item, "select", "selectionMode") || "exceptCurrent";
        if (mode === "current" || mode === "all") steps.push({ op, mode });
        else if (mode === "byCurrent" && (select === "any" || select === "exceptCurrent"))
          steps.push({ op, mode, select });
        else if (mode === "stake") {
          const visibility = scalar(item, "stakeVisibility");
          if (!(
            (select === "highest" && visibility === "visible") ||
            (select === "allPossible" && visibility === "hidden")
          ))
            fail("unsupported stake selection");
          steps.push({
            op,
            mode,
            select: select as "highest" | "allPossible",
            stakeVisibility: visibility as "visible" | "hidden",
          });
        } else fail(`unsupported answerer: ${mode}/${select}`);
      } else if (op === "announcePrice") steps.push({ op, range: range(item) });
      else if (op === "setPrice") {
        const mode = scalar(item, "mode");
        if (mode === "select") steps.push({ op, mode, range: range(item) });
        else if (
          mode === "multiply" ||
          mode === "noRisk" ||
          mode === "withButton" ||
          mode === "forAll"
        ) {
          if (parameter(item, "content")) fail(`unexpected content for setPrice/${mode}`);
          steps.push({ op, mode });
        } else fail(`unsupported setPrice mode: ${mode}`);
      } else if (op === "accept") steps.push({ op });
      else fail(`unknown script operation: ${op}`);
    }
    if (answerTexts.length) fields.answerTextItems = answerTexts;
    if (steps.some((item) => item.op === "setAnswerType" && item.answerType === "number")) {
      const number = Number((right[0] ?? "").replace(",", "."));
      if (!right[0]?.trim() || !Number.isFinite(number)) fail("invalid numeric right answer");
      fields.answerNumber = number;
    }
    const deviation = parameter(data, "answerDeviation");
    if (steps.some((item) => item.op === "setAnswerType" && item.answerType === "point")) {
      const point = parseSiqPoint(right[0] ?? "", deviation ? value(deviation) : null);
      if (!point) return fail("invalid point right answer or deviation");
      fields.answerPoint = point.target;
      fields.answerDeviation = point.deviation;
    } else if (deviation) {
      const n = Number(value(deviation));
      if (!Number.isFinite(n) || n < 0) fail("invalid answer deviation");
      fields.answerDeviation = n;
    }
    const nativeKind = matchingTemplate(script);
    const program: QuestionScriptDTO = {
      version: 1,
      steps,
      ...(answerTexts.length ? { answerTextItems: answerTexts } : {}),
    };
    needsPointTarget = missingScriptPointImageStep({ ...fields, script: program }) >= 0;
    if (needsPointTarget) fail("point ask needs an image as the last item of its active content");
    if (nativeKind && !final && fields.answerPoint)
      fields.pointImageOrder = scriptPointImageOrder(fields.questionFiles, fields.textItems);
    return { script: program, fields, nativeKind };
  } catch (error) {
    return {
      script: null,
      fields: needsPointTarget
        ? { answerType: "point", answerPoint: fields.answerPoint, pointImageOrder: -1 }
        : {},
      nativeKind: null,
      issue: {
        code: "siqCompatibility",
        where,
        severity: "critical",
        resolution: "needsRepair",
        detail: error instanceof Error ? error.message : "invalid script",
        sourceData: {
          type: rawType,
          parameters: [
            {
              name: "script",
              type: "simple",
              value: new XMLSerializer().serializeToString(script).slice(0, 16_384),
            },
          ],
        },
      },
    };
  }
}
