import { scriptPointImageOrder } from "@/lib/pointImage";

/** Normalized SI data only. References are resolved by the importer, never executed as code. */
export interface ScriptNumberSet {
  min: number;
  max: number;
  step: number;
}

export type ScriptAnswerFormat = "text" | "number" | "point" | "select";

export type QuestionScriptStep =
  | {
      op: "setAnswerType";
      answerType: ScriptAnswerFormat;
      optionOrders?: number[];
      correctChoiceOrder?: number | null;
    }
  | { op: "showContent"; phase: "question" | "answer"; orders: number[]; revealRight?: boolean }
  | { op: "askAnswer"; mode: "button" | "direct"; durationMs: number | null }
  | { op: "setAnswerer"; mode: "current" | "byCurrent" | "all"; select?: "any" | "exceptCurrent" }
  | {
      op: "setAnswerer";
      mode: "stake";
      select: "highest" | "allPossible";
      stakeVisibility: "visible" | "hidden";
    }
  | { op: "announcePrice"; range: ScriptNumberSet }
  | { op: "setPrice"; mode: "select"; range: ScriptNumberSet }
  | { op: "setPrice"; mode: "multiply" | "noRisk" | "withButton" | "forAll" }
  | { op: "setTheme" }
  | { op: "accept" };

export interface QuestionScriptDTO {
  version: 1;
  answerTextItems?: {
    order: number;
    text: string;
    durationMs?: number | null;
    waitForFinish?: boolean;
    placement?: "screen" | "replic";
  }[];
  steps: QuestionScriptStep[];
}

/** Current safe wait only: no operands, future content, keys, submissions or hidden prices. */
export interface ScriptScoreEstimate {
  win: number;
  lose: number;
}

export interface QuestionScriptView {
  scoreEstimate?: ScriptScoreEstimate;
  reviewScoreEstimates?: Record<string, ScriptScoreEstimate>;
  questionId: number;
  programCounter: number;
  waitingFor: "content" | "answerer" | "price" | "answer" | null;
  actorId: number | null;
  answererIds: number[];
  answerMode: "button" | "direct";
  canReveal?: boolean;
  priceRange?: ScriptNumberSet | null;
  awards?: { playerId: number; points: number }[];
}

/** Archive boundary: reject unknown operands and executable extensions instead of silently dropping them. */
export function readQuestionScript(value: unknown): QuestionScriptDTO | null {
  if (value == null) return null;
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const integer = (v: unknown, max = 2147483647): v is number =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max;
  const oneOf = (value: unknown, ...options: string[]) =>
    typeof value === "string" && options.includes(value);
  const range = (v: unknown) =>
    object(v) &&
    Object.keys(v).every((key) => ["min", "max", "step"].includes(key)) &&
    integer(v.min, 1_000_000) &&
    integer(v.max, 1_000_000) &&
    integer(v.step, 1_000_000) &&
    v.min <= v.max;
  const fail = (): never => {
    throw new Error("badQuestionScript");
  };
  if (
    !object(value) ||
    value.version !== 1 ||
    Object.keys(value).some((key) => !["version", "steps", "answerTextItems"].includes(key)) ||
    !Array.isArray(value.steps) ||
    value.steps.length < 1 ||
    value.steps.length > 128
  )
    return fail();
  const allowed: Record<string, string[]> = {
    setTheme: ["op"],
    accept: ["op"],
    setAnswerType: ["op", "answerType", "optionOrders", "correctChoiceOrder"],
    showContent: ["op", "phase", "orders", "revealRight"],
    askAnswer: ["op", "mode", "durationMs"],
    setAnswerer: ["op", "mode", "select", "stakeVisibility"],
    announcePrice: ["op", "range"],
    setPrice: ["op", "mode", "range"],
  };
  for (const step of value.steps) {
    if (
      !object(step) ||
      typeof step.op !== "string" ||
      !Object.hasOwn(allowed, step.op) ||
      Object.keys(step).some((key) => !allowed[step.op as string]!.includes(key))
    )
      return fail();
    if (
      step.op === "setAnswerType" &&
      (!oneOf(step.answerType, "text", "number", "point", "select") ||
        (step.optionOrders !== undefined &&
          (!Array.isArray(step.optionOrders) ||
            step.optionOrders.length > 1000 ||
            step.optionOrders.some((item) => !integer(item)))) ||
        (step.correctChoiceOrder != null && !integer(step.correctChoiceOrder)))
    )
      return fail();
    if (
      step.op === "showContent" &&
      (!oneOf(step.phase, "question", "answer") ||
        !Array.isArray(step.orders) ||
        step.orders.length > 300 ||
        step.orders.some((item) => !integer(item)) ||
        (step.revealRight !== undefined && typeof step.revealRight !== "boolean"))
    )
      return fail();
    if (
      step.op === "askAnswer" &&
      (!oneOf(step.mode, "button", "direct") ||
        (step.durationMs !== null &&
          (!integer(step.durationMs, 86_400_000) || step.durationMs === 0)))
    )
      return fail();
    if (step.op === "announcePrice" && !range(step.range)) return fail();
    if (
      step.op === "setPrice" &&
      !(
        (oneOf(step.mode, "multiply", "noRisk", "withButton", "forAll") &&
          step.range === undefined) ||
        (step.mode === "select" && range(step.range))
      )
    )
      return fail();
    if (
      step.op === "setAnswerer" &&
      !(
        (oneOf(step.mode, "current", "all") &&
          step.select === undefined &&
          step.stakeVisibility === undefined) ||
        (step.mode === "byCurrent" &&
          (step.select === undefined || oneOf(step.select, "any", "exceptCurrent")) &&
          step.stakeVisibility === undefined) ||
        (step.mode === "stake" &&
          ((step.select === "highest" && step.stakeVisibility === "visible") ||
            (step.select === "allPossible" && step.stakeVisibility === "hidden")))
      )
    )
      return fail();
  }
  if (
    value.answerTextItems !== undefined &&
    (!Array.isArray(value.answerTextItems) ||
      value.answerTextItems.length > 30 ||
      value.answerTextItems.some(
        (item) =>
          !object(item) ||
          !integer(item.order) ||
          typeof item.text !== "string" ||
          item.text.length > 100_000 ||
          (!item.text.trim() && (item.durationMs == null || item.durationMs === 0)) ||
          Object.keys(item).some(
            (key) => !["order", "text", "durationMs", "waitForFinish", "placement"].includes(key),
          ) ||
          (item.durationMs != null && !integer(item.durationMs, 120_000)) ||
          (item.waitForFinish !== undefined && typeof item.waitForFinish !== "boolean") ||
          (item.placement !== undefined &&
            item.placement !== "screen" &&
            item.placement !== "replic"),
      ))
  )
    return fail();
  return structuredClone(value) as unknown as QuestionScriptDTO;
}

/** Check each point ask against the last authored occurrence of its active presentation. */
export function hasMissingScriptPointImage(question: {
  script?: QuestionScriptDTO | null;
  questionFiles?: Parameters<typeof scriptPointImageOrder>[0];
  answerFiles?: Parameters<typeof scriptPointImageOrder>[0];
  textItems?: Parameters<typeof scriptPointImageOrder>[1];
  answerTextItems?: Parameters<typeof scriptPointImageOrder>[1];
}): boolean {
  let format: ScriptAnswerFormat = "text";
  let target = -1;
  for (const step of question.script?.steps ?? []) {
    if (step.op === "setAnswerType") format = step.answerType;
    if (step.op === "showContent") {
      if (step.revealRight) {
        if (format !== "point") target = -1;
        continue;
      }
      const files = step.phase === "question" ? question.questionFiles : question.answerFiles;
      const texts =
        step.phase === "question"
          ? question.textItems
          : (question.answerTextItems ?? question.script?.answerTextItems);
      const orders = new Set(step.orders);
      target = scriptPointImageOrder(
        files?.filter((item) => orders.has(item.order)),
        texts?.filter((item) => orders.has(item.order)),
        step.orders,
      );
    }
    if (step.op === "askAnswer" && format === "point" && target === -1) return true;
  }
  return false;
}
