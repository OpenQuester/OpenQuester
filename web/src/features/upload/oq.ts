import { answerFormat } from "@/game/answerFormat";
import { readSecretRules } from "@/game/secretRules";
import {
  compatibilityMedia,
  readCompatibilityIssues,
  scriptRepairDetail,
} from "./siqCompatibility";
import { readQuestionScript } from "@/game/questionScript";
import type { Unzipped } from "fflate";

import { assertImportContentLimits } from "./contentLimits";
import { scanOq, requireRemoval, removalWarnings } from "./htmlRemoval";
import { md5Hex, yieldToBrowser } from "./archive";
import type {
  FileRef,
  ImportWarning,
  MediaFile,
  MediaType,
  ParsedPackage,
  QuestionFile,
  QuestionTextItem,
  UploadContent,
  UploadQuestion,
  UploadRound,
  UploadTheme,
} from "./types";

/**
 * Reads an OpenQuester .oq archive:
 *   content.json  the package as the API returns it
 *   files/<md5>   every media file, named by its MD5
 * Server-side fields (ids, author, dates) are dropped so the upload validates.
 */
export async function parseOq(entries: Unzipped, allowHtmlRemoval = false): Promise<ParsedPackage> {
  const raw = entries["content.json"];
  if (!raw) throw new Error("noContentJson");
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new Error("badContentJson");
  }
  if (!isObject(json) || !Array.isArray(json.rounds)) throw new Error("badContentJson");

  const report = scanOq(json, false);
  requireRemoval(report, allowHtmlRemoval);
  if (report.questions.length) scanOq(json, true);
  assertOqContentLimits(json);
  const warnings: ImportWarning[] = removalWarnings(report);
  const types = new Map<string, MediaType>();
  const content = toContent(json, types, warnings);
  if (
    report.questions.length &&
    !content.rounds.some((r) => r.themes.some((t) => t.questions.length))
  )
    throw new Error("allHtmlQuestions");

  const files = new Map<string, MediaFile>();
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.startsWith("files/") || bytes.length === 0) continue;
    const md5 = name.slice("files/".length).toLowerCase();
    const type = types.get(md5);
    if (!type) continue;
    await yieldToBrowser();
    if (md5Hex(bytes) !== md5) {
      warnings.push({ code: "hashMismatch", where: "", detail: md5 });
      continue;
    }
    files.set(md5, { md5, type, name, bytes });
  }
  for (const md5 of types.keys())
    if (!files.has(md5)) warnings.push({ code: "missingFile", where: "", detail: md5 });

  return { format: "oq", content, files, warnings };
}

export function assertOqContentLimits(json: Json) {
  assertImportContentLimits(toContent(json, new Map(), [], false));
}

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v != null && !Array.isArray(v);
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null =>
  typeof v === "number" ? v : typeof v === "string" && v.trim() && !isNaN(+v) ? +v : null;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strList = (v: unknown): string[] | null => {
  const out = list(v).flatMap((s) => (typeof s === "string" && s.trim() ? [s.trim()] : []));
  return out.length ? out : null;
};

export function toContent(
  p: Json,
  types: Map<string, MediaType>,
  warnings: ImportWarning[],
  includeCompatibility = true,
): UploadContent {
  const fileRef = (v: unknown): FileRef | null => {
    if (!isObject(v)) return null;
    const md5 = str(v.md5)?.toLowerCase();
    const type = str(v.type) as MediaType | null;
    if (!md5 || (type !== "image" && type !== "audio" && type !== "video")) return null;
    types.set(md5, type);
    return { md5, type };
  };
  const qFiles = (v: unknown): QuestionFile[] | null => {
    const out = list(v).flatMap((f, i) => {
      if (!isObject(f)) return [];
      const file = fileRef(f.file);
      if (!file) return [];
      const out: QuestionFile = { file, order: num(f.order) ?? i, displayTime: num(f.displayTime) };
      if (f.placement === "background" && file.type === "audio") out.placement = "background";
      if (f.waitForFinish === false) out.waitForFinish = false;
      return [out];
    });
    return out.length ? out : null;
  };
  const question = (q: Json, i: number, where: string): UploadQuestion => {
    const type = (str(q.type) ?? "simple") as UploadQuestion["type"];
    let scriptIssue: ImportWarning | undefined;
    let script: UploadQuestion["script"];
    try {
      script = readQuestionScript(q.script);
    } catch {
      const issue: ImportWarning = {
        code: "siqCompatibility",
        where,
        severity: "critical",
        resolution: "needsRepair",
        detail: "invalid archived script",
        sourceData: {
          type: "custom",
          parameters: [
            { name: "script", type: "simple", value: JSON.stringify(q.script).slice(0, 16384) },
          ],
        },
      };
      scriptIssue = issue;
    }
    const text = str(q.text);
    const scriptWithoutMain = script != null && !text?.trim();
    const out: UploadQuestion = {
      type,
      ...(script == null ? {} : { script }),
      order: num(q.order) ?? i,
      price: num(q.price),
      ...(q.realPrice == null ? {} : { realPrice: num(q.realPrice) }),
      ...(includeCompatibility && q.compatibilityIssues != null
        ? { compatibilityIssues: readCompatibilityIssues(q.compatibilityIssues) }
        : {}),
      text,
      textOrder: scriptWithoutMain ? null : num(q.textOrder),
      textDurationMs: scriptWithoutMain ? null : num(q.textDurationMs),
      textWaitForFinish:
        !scriptWithoutMain && typeof q.textWaitForFinish === "boolean" ? q.textWaitForFinish : null,
      answerDurationMs: num(q.answerDurationMs),
      showmanComments: str(q.showmanComments),
      answerExplanation: str(q.answerExplanation),
      ...(q.answerTextItems != null ? { answerTextItems: readTextItems(q.answerTextItems) } : {}),
      playMediaSimultaneously: q.playMediaSimultaneously !== false,
      ...(q.textItems != null ? { textItems: readTextItems(q.textItems) } : {}),
      ...(q.pointImageOrder != null ? { pointImageOrder: num(q.pointImageOrder) ?? -1 } : {}),
      questionComment: str(q.questionComment),
      answerText: str(q.answerText),
      answerHint: str(q.answerHint),
      ...answerCheckOf(q),
      rightAnswers: strList(q.rightAnswers),
      wrongAnswers: strList(q.wrongAnswers),
      authors: strList(q.authors),
      sources: strList(q.sources),
      answerDelay: num(q.answerDelay),
      showAnswerDuration: num(q.showAnswerDuration) ?? 5000,
      questionFiles: qFiles(q.questionFiles),
      answerFiles: qFiles(q.answerFiles),
    };
    if (out.answerTextItems != null) {
      const orders = [...(out.answerFiles ?? []), ...out.answerTextItems].map((item) => item.order);
      if (
        orders.some((order) => !Number.isInteger(order) || order < 0) ||
        new Set(orders).size !== orders.length
      ) {
        const issue: ImportWarning = {
          code: "contentNeedsRepair",
          where,
          severity: "critical",
          resolution: "needsRepair",
          feature: "contentOrder",
          detail: "answer",
        };
        (out.compatibilityIssues ??= []).push(issue);
      }
    }
    const subType = str(q.subType);
    if (subType) out.subType = subType;
    if (type === "hidden") out.isHidden = true;
    if (type === "stake") out.maxPrice = num(q.maxPrice);
    if (type === "secret") {
      if (q.secretRules != null) out.secretRules = readSecretRules(q.secretRules);
      out.transferType = str(q.transferType) === "exceptCurrent" ? "exceptCurrent" : "any";
      const prices = list(q.allowedPrices)
        .map(num)
        .filter((n): n is number => n != null);
      out.allowedPrices = prices.length ? prices : null;
      out.subType ??= "simple";
    }
    if (type === "noRisk") {
      out.priceMultiplier = num(q.priceMultiplier) ?? 2;
      out.subType ??= "simple";
    }
    if (type === "stake") out.subType ??= "simple";
    if (out.script) {
      out.answerNumber = num(q.answerNumber);
      out.answerPoint = answerCheckOf({ ...q, answerType: "point" }).answerPoint;
      out.answerDeviation = num(q.answerDeviation);
    }
    if (answerFormat(out) === "select") {
      if (type === "choice") out.subType = subType === "forEveryone" ? "forEveryone" : "simple";
      out.showDelay = num(q.showDelay) ?? 0;
    }
    if (answerFormat(out) === "select" || out.script) {
      out.answers = list(q.answers).flatMap((a, j) =>
        isObject(a)
          ? [
              {
                order: num(a.order) ?? j,
                text: str(a.text),
                file: fileRef(a.file),
                ...(typeof a.sourceLabel === "string" && a.sourceLabel.length <= 500
                  ? { sourceLabel: a.sourceLabel }
                  : {}),
              },
            ]
          : [],
      );
      const orders = out.answers.map((option) => option.order);
      const invalidOrders =
        new Set(orders).size !== orders.length ||
        orders.some((order) => !Number.isInteger(order) || order < 0);
      if (
        !out.script &&
        (invalidOrders ||
          (out.answerType === "select" && q.correctChoiceOrder == null) ||
          out.answers.length < 2 ||
          q.correctChoiceNeedsRepair === true ||
          q.correctChoiceOrder != null)
      ) {
        const order = q.correctChoiceOrder;
        if (
          invalidOrders ||
          out.answers.length < 2 ||
          q.correctChoiceNeedsRepair === true ||
          typeof order !== "number" ||
          !Number.isInteger(order) ||
          order < 0 ||
          out.answers.filter((a) => a.order === order).length !== 1
        ) {
          out.correctChoiceNeedsRepair = true;
          warnings.push({ code: "choiceCorrectUnresolved", where });
        } else {
          out.correctChoiceOrder = order;
        }
      }
    }
    if (!out.script && isObject(q.selectSource)) {
      out.selectSource = readSelectSource(q.selectSource);
    }
    out.compatibilityIssues = readCompatibilityIssues([
      ...(out.compatibilityIssues ?? []),
      ...(scriptIssue ? [scriptIssue] : []),
    ]);
    for (const media of compatibilityMedia(out.compatibilityIssues))
      types.set(media.md5, media.type);
    warnings.push(...(out.compatibilityIssues ?? []));
    const detail = includeCompatibility ? scriptRepairDetail(out) : undefined;
    if (detail)
      warnings.push({
        code: "siqCompatibility",
        where,
        severity: "critical",
        resolution: "needsRepair",
        detail,
      });
    return out;
  };
  const theme = (t: Json, i: number, roundName: string): UploadTheme => {
    const name = str(t.name) ?? "-";
    return {
      name,
      order: num(t.order) ?? i,
      description: str(t.description),
      questions: list(t.questions)
        .filter(isObject)
        .map((q, j) => question(q, j, `${roundName} › ${name} › ${num(q.price) ?? ""}`)),
    };
  };
  const round = (r: Json, i: number): UploadRound => {
    const name = str(r.name) ?? "-";
    return {
      name,
      order: num(r.order) ?? i,
      description: str(r.description),
      type: str(r.type) === "final" ? "final" : "simple",
      themes: list(r.themes)
        .filter(isObject)
        .map((t, j) => theme(t, j, name)),
    };
  };

  const age = str(p.ageRestriction);
  const logo = isObject(p.logo) ? fileRef(p.logo.file) : null;
  return {
    title: str(p.title)?.trim() || "Untitled package",
    description: str(p.description),
    language: str(p.language),
    authors: strList(p.authors),
    sources: strList(p.sources),
    ageRestriction: age === "A12" || age === "A16" || age === "A18" ? age : "NONE",
    logo: logo ? { file: logo } : null,
    tags: list(p.tags).flatMap((t) => {
      const tag = isObject(t) ? str(t.tag) : str(t);
      return tag ? [{ tag }] : [];
    }),
    rounds: list(p.rounds)
      .filter(isObject)
      .map((r, i) => round(r, i)),
  };
}

function readTextItems(value: unknown): QuestionTextItem[] {
  if (!Array.isArray(value)) throw new Error("badContentJson");
  return value.map((item) => {
    if (!isObject(item) || typeof item.order !== "number" || typeof item.text !== "string") {
      throw new Error("badContentJson");
    }
    if (item.placement != null && item.placement !== "screen" && item.placement !== "replic")
      throw new Error("badContentJson");
    if (
      item.durationMs != null &&
      (typeof item.durationMs !== "number" || !Number.isFinite(item.durationMs))
    )
      throw new Error("badContentJson");
    if (item.waitForFinish != null && typeof item.waitForFinish !== "boolean")
      throw new Error("badContentJson");
    return {
      order: item.order,
      text: item.text,
      ...(item.durationMs == null ? {} : { durationMs: item.durationMs as number }),
      ...(typeof item.waitForFinish === "boolean" ? { waitForFinish: item.waitForFinish } : {}),
      ...(item.placement === "screen" || item.placement === "replic"
        ? { placement: item.placement }
        : {}),
    };
  });
}

function answerCheckOf(q: Json): Partial<UploadQuestion> {
  const deviation = num(q.answerDeviation);
  if (q.answerType === "select") return { answerType: "select" };
  if (q.answerType === "number") {
    return { answerType: "number", answerNumber: num(q.answerNumber), answerDeviation: deviation };
  }
  const p = q.answerPoint;
  if (q.answerType === "point") {
    const aspect = isObject(p) ? num(p.imageAspectRatio) : null;
    const source = isObject(p) ? p.sourceGeometry : undefined;
    const validSource =
      source === undefined ||
      (isObject(source) && source.kind === "sigame" && (num(source.aspectRatio) ?? 0) > 0);
    const sourceGeometry =
      isObject(source) && validSource
        ? { kind: "sigame" as const, aspectRatio: num(source.aspectRatio)! }
        : undefined;
    return {
      answerType: "point",
      answerPoint:
        isObject(p) && validSource && num(p.x) != null && num(p.y) != null
          ? {
              x: num(p.x)!,
              y: num(p.y)!,
              ...(aspect != null ? { imageAspectRatio: aspect } : {}),
              ...(sourceGeometry ? { sourceGeometry } : {}),
            }
          : null,
      answerDeviation: deviation,
    };
  }
  return {};
}

function readSelectSource(value: Json): UploadQuestion["selectSource"] {
  const unresolvedOptions = Array.isArray(value.unresolvedOptions)
    ? value.unresolvedOptions.flatMap((item) =>
        isObject(item) &&
        typeof item.order === "number" &&
        typeof item.sourceLabel === "string" &&
        typeof item.kind === "string" &&
        item.kind.trim().toLowerCase() !== "html" &&
        typeof item.value === "string"
          ? [
              {
                order: item.order,
                sourceLabel: item.sourceLabel,
                kind: item.kind,
                value: item.value,
              },
            ]
          : [],
      )
    : undefined;
  return {
    rightLabels: list(value.rightLabels).filter((item): item is string => typeof item === "string"),
    ...(unresolvedOptions === undefined ? {} : { unresolvedOptions }),
  };
}
