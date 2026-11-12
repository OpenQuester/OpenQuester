import { scriptPointImageOrder } from "@/lib/pointImage";
import type { UploadQuestion } from "@/features/upload/types";

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

type ScriptContentSource = Pick<
  UploadQuestion,
  "script" | "questionFiles" | "answerFiles" | "textItems" | "answerTextItems"
>;

export function scriptContent(
  question: ScriptContentSource,
  { phase, orders }: Extract<QuestionScriptStep, { op: "showContent" }>,
) {
  const selected = new Set(orders);
  const files = phase === "question" ? question.questionFiles : question.answerFiles;
  const textItems =
    phase === "question"
      ? question.textItems
      : (question.answerTextItems ?? question.script?.answerTextItems);
  return {
    files: files?.filter((item) => selected.has(item.order)),
    textItems: textItems?.filter((item) => selected.has(item.order)),
  };
}

/** Check each point ask against the last authored occurrence of its active presentation. */
export function missingScriptPointImageStep(question: ScriptContentSource): number {
  let format: ScriptAnswerFormat = "text";
  let target = -1;
  return (question.script?.steps ?? []).findIndex((step) => {
    if (step.op === "setAnswerType") format = step.answerType;
    if (step.op === "showContent") {
      if (step.revealRight) {
        if (format !== "point") target = -1;
      } else {
        const { files, textItems } = scriptContent(question, step);
        target = scriptPointImageOrder(files, textItems, step.orders);
      }
    }
    return step.op === "askAnswer" && format === "point" && target === -1;
  });
}

/** Mirror the server's validateQuestionScript cross-field checks after structural parsing. */
export function scriptReferenceIssue(question: UploadQuestion): string | undefined {
  const steps = question.script?.steps ?? [];
  for (const [index, step] of steps.entries()) {
    const where = `step ${index + 1} (${step.op})`;
    if (step.op === "showContent" && !step.revealRight) {
      const { files, textItems } = scriptContent(question, step);
      const available = [...(files ?? []), ...(textItems ?? [])];
      if (!step.orders.length) return `${where}: missing ${step.phase} content orders`;
      if (new Set(step.orders).size !== step.orders.length)
        return `${where}: duplicate ${step.phase} content orders`;
      for (const order of step.orders) {
        const count = available.filter((item) => item.order === order).length;
        if (count !== 1)
          return `${where}: ${step.phase} content order ${order} matches ${count} items`;
      }
    }
    if (step.op !== "setAnswerType") continue;
    if (step.answerType === "number" && !Number.isFinite(question.answerNumber))
      return `${where}: missing or invalid answerNumber`;
    if (step.answerType === "point" && !question.answerPoint)
      return `${where}: missing answerPoint`;
    if (step.answerType === "select") {
      const orders = step.optionOrders ?? [];
      if (orders.length < 2 || new Set(orders).size !== orders.length)
        return `${where}: optionOrders needs at least two distinct orders`;
      if (step.correctChoiceOrder == null || !orders.includes(step.correctChoiceOrder))
        return `${where}: correctChoiceOrder must be in optionOrders`;
      for (const order of orders) {
        const count = question.answers?.filter((option) => option.order === order).length ?? 0;
        if (count !== 1) return `${where}: option order ${order} matches ${count} choices`;
      }
    }
  }
  const ask = missingScriptPointImageStep(question);
  if (ask >= 0) return `step ${ask + 1} (askAnswer): active content must end with an image`;
}
