import { answerFormat } from "@/game/answerFormat";
import { scriptReferenceIssue } from "@/game/questionScript";
import { pointImage } from "@/lib/pointImage";
import { questionLimitIssues } from "./contentLimits";
import type { FileRef, ImportWarning, MediaType, UploadContent, UploadQuestion } from "./types";

export interface SiqSourceItem {
  type: string;
  value: string;
  placement?: string;
  duration?: string;
  waitForFinish?: string;
  isRef?: string;
  file?: FileRef;
}
export interface SiqSourceParameter {
  name: string;
  type: string;
  value: string;
  isRef?: string;
  numberSet?: { minimum: string; maximum: string; step: string };
  items?: SiqSourceItem[];
  parameters?: SiqSourceParameter[];
}
export interface SiqSourceQuestion {
  type: string;
  parameters: SiqSourceParameter[];
  script?: { type: string; parameters: SiqSourceParameter[] }[];
}

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const short = (v: unknown, limit = 128): v is string => typeof v === "string" && v.length <= limit;
const safeType = (v: unknown) => short(v) && v.toLowerCase() !== "html";
const children = (node: Element, name: string) =>
  Array.from(node.children).filter((c) => c.localName === name);

/** No raw XML or executable source is stored. The typed tree is bounded on read and re-import. */
export function readSiqSource(value: unknown): SiqSourceQuestion {
  if (JSON.stringify(value).length > 65536 || !object(value) || !safeType(value.type))
    throw new Error("siqSourceLimit");
  let count = 0;
  const parameters = (values: unknown, depth: number): SiqSourceParameter[] => {
    if (!Array.isArray(values) || depth > 4 || values.length > 64)
      throw new Error("siqSourceLimit");
    return values.map((p) => {
      if (
        ++count > 256 ||
        !object(p) ||
        !short(p.name) ||
        !safeType(p.type) ||
        !short(p.value, 4096)
      )
        throw new Error("siqSourceLimit");
      const out: SiqSourceParameter = { name: p.name, type: p.type as string, value: p.value };
      if (p.isRef != null) {
        if (!short(p.isRef)) throw new Error("siqSourceLimit");
        out.isRef = p.isRef;
      }
      if (p.numberSet != null) {
        const n = p.numberSet;
        if (!object(n) || !short(n.minimum) || !short(n.maximum) || !short(n.step))
          throw new Error("siqSourceLimit");
        out.numberSet = { minimum: n.minimum, maximum: n.maximum, step: n.step };
      }
      if (p.items != null) {
        if (!Array.isArray(p.items) || p.items.length > 300) throw new Error("siqSourceLimit");
        out.items = p.items.map((item) => {
          if (++count > 600 || !object(item) || !safeType(item.type) || !short(item.value, 4096))
            throw new Error("siqSourceLimit");
          const entry: SiqSourceItem = { type: item.type as string, value: item.value };
          for (const key of ["placement", "duration", "waitForFinish", "isRef"] as const) {
            if (item[key] != null) {
              if (!short(item[key])) throw new Error("siqSourceLimit");
              entry[key] = item[key];
            }
          }
          if (item.file != null) {
            const f = item.file;
            if (
              !object(f) ||
              !short(f.md5, 64) ||
              !/^[a-f0-9]{32}(?:\.[a-z0-9]+)?$/i.test(f.md5) ||
              !["image", "audio", "video"].includes(String(f.type))
            )
              throw new Error("siqSourceLimit");
            entry.file = { md5: f.md5, type: f.type as MediaType };
          }
          return entry;
        });
      }
      if (p.parameters != null) out.parameters = parameters(p.parameters, depth + 1);
      return out;
    });
  };
  const source: SiqSourceQuestion = {
    type: value.type as string,
    parameters: parameters(value.parameters, 0),
  };
  if (value.script != null) {
    if (!Array.isArray(value.script) || value.script.length > 64) throw new Error("siqSourceLimit");
    source.script = value.script.map((step) => {
      if (!object(step) || !safeType(step.type)) throw new Error("siqSourceLimit");
      return { type: step.type as string, parameters: parameters(step.parameters, 0) };
    });
  }
  return source;
}

export function sourceFromSiq(
  q: Element,
  resolveFile?: (type: MediaType, name: string) => FileRef | null,
): SiqSourceQuestion {
  let count = 0;
  const parameter = (p: Element, depth = 0): SiqSourceParameter => {
    if (
      depth > 4 ||
      ++count > 256 ||
      children(p, "param").length > 64 ||
      children(p, "item").length > 300
    )
      throw new Error("siqSourceLimit");
    const n = children(p, "numberSet")[0];
    return {
      name: p.getAttribute("name") ?? "",
      type: p.getAttribute("type") ?? "simple",
      value: p.children.length ? "" : (p.textContent ?? ""),
      ...(p.hasAttribute("isRef") ? { isRef: p.getAttribute("isRef")! } : {}),
      ...(n
        ? {
            numberSet: {
              minimum: n.getAttribute("minimum") ?? "0",
              maximum: n.getAttribute("maximum") ?? "0",
              step: n.getAttribute("step") ?? "0",
            },
          }
        : {}),
      ...(children(p, "param").length
        ? { parameters: children(p, "param").map((child) => parameter(child, depth + 1)) }
        : {}),
      ...(children(p, "item").length
        ? {
            items: children(p, "item").map((item) => {
              const type = item.getAttribute("type") ?? "text";
              const value = item.textContent ?? "";
              const file =
                ["image", "audio", "video"].includes(type) &&
                item.getAttribute("isRef")?.toLowerCase() === "true"
                  ? resolveFile?.(type as MediaType, value)
                  : null;
              return {
                type,
                value,
                ...Object.fromEntries(
                  ["placement", "duration", "waitForFinish", "isRef"].flatMap((key) =>
                    item.hasAttribute(key) ? [[key, item.getAttribute(key)!]] : [],
                  ),
                ),
                ...(file ? { file } : {}),
              };
            }),
          }
        : {}),
    };
  };
  const container = children(q, "params")[0] ?? children(q, "type")[0];
  const script = children(q, "script")[0];
  return readSiqSource({
    type: q.getAttribute("type") ?? children(q, "type")[0]?.getAttribute("name") ?? "",
    parameters: container ? children(container, "param").map((p) => parameter(p)) : [],
    ...(script
      ? {
          script: children(script, "step").map((step) => ({
            type: step.getAttribute("type") ?? "showContent",
            parameters: children(step, "param").map((p) => parameter(p)),
          })),
        }
      : {}),
  });
}

/** Registered archive-only repair diagnostics share the existing import report. */
const compatibilityCodes = new Set<ImportWarning["code"]>([
  "siqCompatibility",
  "contentNeedsRepair",
  "choiceCorrectUnresolved",
]);
// Two content phases can each contain 30 groups of 10 files, with multiple
// independent issues per item. Text may share those groups without a file cap.
const MAX_COMPATIBILITY_ISSUES = 4096;
const MAX_COMPATIBILITY_JSON_LENGTH = 16 * 1024 * 1024;
export function readCompatibilityIssues(value: unknown): ImportWarning[] | undefined {
  if (value == null) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > MAX_COMPATIBILITY_ISSUES ||
    JSON.stringify(value).length > MAX_COMPATIBILITY_JSON_LENGTH
  )
    throw new Error("siqSourceLimit");
  return value.map((issue) => {
    if (
      !object(issue) ||
      !compatibilityCodes.has(issue.code as ImportWarning["code"]) ||
      !short(issue.where, 1024) ||
      issue.severity !== "critical" ||
      issue.resolution !== "needsRepair" ||
      Object.keys(issue).some(
        (key) =>
          ![
            "code",
            "where",
            "detail",
            "feature",
            "phase",
            "severity",
            "resolution",
            "source",
            "sourceData",
            "contentSource",
          ].includes(key),
      )
    )
      throw new Error("siqSourceLimit");
    const out: ImportWarning = {
      code: issue.code as ImportWarning["code"],
      where: issue.where,
      severity: "critical",
      resolution: "needsRepair",
    };
    for (const key of ["detail", "feature"] as const) {
      if (issue[key] != null) {
        if (!short(issue[key], key === "detail" ? 4096 : 128)) throw new Error("siqSourceLimit");
        out[key] = issue[key];
      }
    }
    if (issue.phase != null) {
      if (issue.phase !== "question" && issue.phase !== "answer") throw new Error("siqSourceLimit");
      out.phase = issue.phase;
    }
    if (issue.source != null) {
      const s = issue.source;
      if (
        !object(s) ||
        ![s.round, s.theme, s.question].every(
          (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0,
        ) ||
        (s.parameter != null && !short(s.parameter))
      )
        throw new Error("siqSourceLimit");
      out.source = {
        round: s.round as number,
        theme: s.theme as number,
        question: s.question as number,
        ...(s.parameter == null ? {} : { parameter: s.parameter as string }),
      };
    }
    if (issue.sourceData != null) out.sourceData = readSiqSource(issue.sourceData);
    if (issue.contentSource != null) {
      const content = issue.contentSource;
      const attributes = ["placement", "duration", "waitForFinish", "time"] as const;
      if (
        out.code !== "contentNeedsRepair" ||
        !object(content) ||
        !short(content.type, 100) ||
        !safeType(content.type) ||
        !short(content.text, 2000) ||
        Object.keys(content).some((key) => !["type", "text", ...attributes].includes(key))
      )
        throw new Error("siqSourceLimit");
      out.contentSource = { type: content.type, text: content.text };
      for (const key of attributes) {
        const value = content[key];
        if (value === undefined) continue;
        if (value !== null && !short(value, key === "waitForFinish" ? 16 : 100))
          throw new Error("siqSourceLimit");
        out.contentSource[key] = value;
      }
    }
    return out;
  });
}

export function compatibilityMedia(issues: ImportWarning[] | undefined): FileRef[] {
  const files: FileRef[] = [];
  const visit = (params: SiqSourceParameter[]) => {
    for (const p of params) {
      for (const item of p.items ?? []) if (item.file) files.push(item.file);
      visit(p.parameters ?? []);
    }
  };
  for (const issue of issues ?? []) {
    if (!issue.sourceData) continue;
    visit(issue.sourceData.parameters);
    for (const step of issue.sourceData.script ?? []) visit(step.parameters);
  }
  return files;
}

export const COMPATIBILITY_NEEDS_REPAIR = "compatibilityNeedsRepair";

export function invalidSelectSource(
  source: UploadQuestion["selectSource"],
  options: readonly { sourceLabel?: string | null }[],
): boolean {
  if (!source) return false;
  const rights = source.rightLabels;
  return (
    rights.length === 0 ||
    rights.length > 1000 ||
    new Set(rights).size !== rights.length ||
    rights.some(
      (label) =>
        !label ||
        label.length > 500 ||
        options.filter((option) => option.sourceLabel === label).length !== 1,
    )
  );
}

export function scriptRepairDetail(question: UploadQuestion): string | undefined {
  if (!question.script) return undefined;
  const referenceIssue = scriptReferenceIssue(question);
  if (referenceIssue) return referenceIssue;
  const limit = questionLimitIssues(question)[0];
  if (limit?.step != null)
    return `${limit.phase} group ${limit.step}: ${limit.actual} files (maximum ${limit.max})`;
  if (limit) return `${limit.phase}: ${limit.actual} groups (maximum ${limit.max})`;
}

function questionNeedsRepair(question: UploadQuestion): boolean {
  if (
    question.correctChoiceNeedsRepair ||
    question.compatibilityIssues?.some((i) => i.severity === "critical")
  )
    return true;
  if (question.script) return !!scriptRepairDetail(question);
  if (
    answerFormat(question) === "select" &&
    invalidSelectSource(question.selectSource, question.answers ?? [])
  )
    return true;
  if (answerFormat(question) !== "point" || question.secretRules?.outcome === "award") return false;

  const point = question.answerPoint;
  return (
    !point ||
    ![point.x, point.y].every(
      (coordinate) => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1,
    ) ||
    !pointImage(question.questionFiles, question.pointImageOrder)
  );
}

export function needsCompatibilityRepair(
  content: UploadContent,
  warnings: readonly ImportWarning[] = [],
): boolean {
  return (
    warnings.some(
      (warning) =>
        warning.severity === "critical" ||
        warning.resolution === "needsRepair" ||
        warning.code === "contentNeedsRepair" ||
        warning.code === "choiceCorrectUnresolved" ||
        warning.code === "pointInvalid" ||
        warning.code === "pointTargetMissing",
    ) ||
    content.rounds.some((round) =>
      round.themes.some((theme) => theme.questions.some(questionNeedsRepair)),
    )
  );
}

export function assertPlayableCompatibility(
  content: UploadContent,
  warnings?: readonly ImportWarning[],
): void {
  if (needsCompatibilityRepair(content, warnings)) throw new Error(COMPATIBILITY_NEEDS_REPAIR);
}
