import type { Unzipped } from "fflate";

import { md5Hex, yieldToBrowser } from "./archive";
import type {
  FileRef,
  ImportWarning,
  MediaFile,
  MediaType,
  ParsedPackage,
  QuestionFile,
  UploadContent,
  UploadQuestion,
  UploadRound,
  UploadTheme,
} from "./types";

/**
 * Reads an OpenQuester .oq archive, the format the Flutter editor exports
 * (client/packages/oq_editor/lib/utils/oq_package_archiver.dart):
 *   content.json  the package as the API returns it
 *   files/<md5>   every media file, named by its MD5
 * Server-side fields (ids, author, dates) are dropped so the upload validates.
 */
export async function parseOq(entries: Unzipped): Promise<ParsedPackage> {
  const raw = entries["content.json"];
  if (!raw) throw new Error("noContentJson");
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new Error("badContentJson");
  }
  if (!isObject(json) || !Array.isArray(json.rounds)) throw new Error("badContentJson");

  const warnings: ImportWarning[] = [];
  const types = new Map<string, MediaType>();
  const content = toContent(json, types, warnings);

  const files = new Map<string, MediaFile>();
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.startsWith("files/") || bytes.length === 0) continue;
    const md5 = name.slice("files/".length).toLowerCase();
    await yieldToBrowser();
    if (md5Hex(bytes) !== md5) {
      warnings.push({ code: "hashMismatch", where: "", detail: md5 });
      continue;
    }
    const type = types.get(md5);
    if (type) files.set(md5, { md5, type, name, bytes });
  }
  for (const md5 of types.keys())
    if (!files.has(md5)) warnings.push({ code: "missingFile", where: "", detail: md5 });

  return { format: "oq", content, files, warnings };
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
    let type = (str(q.type) ?? "simple") as UploadQuestion["type"];
    // The server needs 2–8 options; fewer can still be played as a regular question.
    const incompleteChoice = type === "choice" && list(q.answers).length < 2;
    const hasChoiceKey = q.correctChoiceNeedsRepair === true || q.correctChoiceOrder != null;
    if (incompleteChoice && !hasChoiceKey) {
      warnings.push({ code: "choiceAsSimple", where });
      type = "simple";
    }
    const out: UploadQuestion = {
      type,
      order: num(q.order) ?? i,
      price: num(q.price),
      text: str(q.text),
      textOrder: num(q.textOrder),
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
    const subType = str(q.subType);
    if (subType) out.subType = subType;
    if (type === "hidden") out.isHidden = true;
    if (type === "stake") out.maxPrice = num(q.maxPrice);
    if (type === "secret") {
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
    if (type === "choice") {
      out.subType = "simple";
      out.showDelay = num(q.showDelay) ?? 0;
      out.answers = list(q.answers).flatMap((a, j) =>
        isObject(a) ? [{ order: num(a.order) ?? j, text: str(a.text), file: fileRef(a.file) }] : [],
      );
      if (q.correctChoiceNeedsRepair === true || q.correctChoiceOrder != null) {
        const order = q.correctChoiceOrder;
        if (
          incompleteChoice ||
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

function readTextItems(value: unknown): { order: number; text: string }[] {
  if (!Array.isArray(value)) throw new Error("badContentJson");
  return value.map((item) => {
    if (!isObject(item) || typeof item.order !== "number" || typeof item.text !== "string") {
      throw new Error("badContentJson");
    }
    return { order: item.order, text: item.text };
  });
}

function answerCheckOf(q: Json): Partial<UploadQuestion> {
  const deviation = num(q.answerDeviation);
  if (q.answerType === "number") {
    return { answerType: "number", answerNumber: num(q.answerNumber), answerDeviation: deviation };
  }
  const p = q.answerPoint;
  if (q.answerType === "point") {
    const aspect = isObject(p) ? num(p.imageAspectRatio) : null;
    return {
      answerType: "point",
      answerPoint:
        isObject(p) && num(p.x) != null && num(p.y) != null
          ? { x: num(p.x)!, y: num(p.y)!, ...(aspect != null ? { imageAspectRatio: aspect } : {}) }
          : null,
      answerDeviation: deviation,
    };
  }
  return {};
}
