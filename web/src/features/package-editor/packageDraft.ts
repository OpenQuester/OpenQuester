import type {
  FileRef,
  MediaType,
  QuestionFile,
  UploadContent,
  UploadQuestion,
} from "@/features/upload/types";
import { questionSteps } from "./question-form/questionTimeline";

/**
 * The editor works on its own tree with stable ids, so selection, undo and
 * drag targets keep pointing at the same item through reorder, move and
 * delete. Order is the array position; `toUpload` writes `order` fields.
 */
export type QuestionType = UploadQuestion["type"];
export const QUESTION_TYPES: QuestionType[] = [
  "simple",
  "stake",
  "secret",
  "noRisk",
  "choice",
  "hidden",
];

export interface DraftMedia {
  /** Editor-only identity of this occurrence; a file may be used more than once. */
  occurrenceId?: string;
  md5: string;
  type: MediaType;
  /** Milliseconds the file stays on screen; null lets the game decide. */
  displayTime: number | null;
  /** Audio only: plays under the stage instead of taking it. */
  placement?: "screen" | "background";
  /** False shows the next item together with this one. */
  waitForFinish?: boolean;
}

export interface DraftTextItem {
  id: string;
  text: string;
  /** Position in the combined sequence of main text, media and extra text. */
  order: number;
}

export interface DraftChoiceOption {
  id: string;
  text: string;
  file: FileRef | null;
}

export interface DraftQuestion {
  id: string;
  type: QuestionType;
  price: number | null;
  text: string;
  /**
   * Where the text plays among the question files (0 = before the first);
   * null shows it as a caption next to the media for the whole question.
   */
  textPosition: number | null;
  /** New editor questions keep the main prompt first; imports keep their authored order. */
  mainTextFirst?: boolean;
  /** Absent for legacy questions; an empty array marks the new sequence format. */
  textItems?: DraftTextItem[];
  questionFiles: DraftMedia[];
  answerText: string;
  answerFiles: DraftMedia[];
  answerHint: string;
  /** How players answer: typed/said (the showman judges), a number or a spot. */
  answerType: "text" | "number" | "point";
  answerNumber: number | null;
  answerPoint: { x: number; y: number; imageAspectRatio?: number } | null;
  /** Explicit target occurrence; absent preserves legacy first-image behavior. */
  pointImageId?: string;
  /** Numbers: how far off still counts. Points: radius as a share of the width. */
  answerDeviation: number | null;
  /** Other answers that count as right. */
  rightAnswers: string[];
  /** Answers known to be wrong, to help the showman. */
  wrongAnswers: string[];
  authors: string[];
  sources: string[];
  questionComment: string;
  /** Milliseconds, as the server stores them. */
  answerDelay: number;
  showAnswerDuration: number;
  /** Stake: highest bid, null for all-in. Stake and no-risk: "forEveryone". */
  maxPrice: number | null;
  forEveryone: boolean;
  /** Secret. */
  transferType: "any" | "exceptCurrent";
  allowedPrices: number[];
  /** No risk. */
  priceMultiplier: number;
  /** Choice. */
  options: DraftChoiceOption[];
  /** Undefined is legacy, null requires the author to select a replacement. */
  correctChoiceOptionId?: string | null;
  showDelay: number;
}

export interface DraftTheme {
  id: string;
  name: string;
  description: string;
  questions: DraftQuestion[];
}

export interface DraftRound {
  id: string;
  name: string;
  description: string;
  type: "simple" | "final";
  themes: DraftTheme[];
}

export type AgeRestriction = UploadContent["ageRestriction"];

export interface DraftPackage {
  title: string;
  description: string;
  language: string;
  ageRestriction: AgeRestriction;
  tags: string[];
  authors: string[];
  sources: string[];
  logo: FileRef | null;
  rounds: DraftRound[];
}

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function newQuestion(
  price: number | null,
  patch: Partial<DraftQuestion> = {},
): DraftQuestion {
  return {
    id: newId(),
    type: "simple",
    price,
    text: "",
    textPosition: 0,
    mainTextFirst: true,
    textItems: [],
    questionFiles: [],
    answerText: "",
    answerFiles: [],
    answerHint: "",
    answerType: "text",
    answerNumber: null,
    answerPoint: null,
    answerDeviation: null,
    rightAnswers: [],
    wrongAnswers: [],
    authors: [],
    sources: [],
    questionComment: "",
    answerDelay: 5000,
    showAnswerDuration: 5000,
    maxPrice: null,
    forEveryone: false,
    transferType: "any",
    allowedPrices: [],
    priceMultiplier: 2,
    options: [],
    showDelay: 0,
    ...patch,
  };
}

/** The authored occurrence, or the first image on a legacy question. */
export function draftPointImage(q: DraftQuestion): DraftMedia | undefined {
  return q.pointImageId !== undefined
    ? q.questionFiles.find((file) => file.occurrenceId === q.pointImageId && file.type === "image")
    : q.questionFiles.find((file) => file.type === "image");
}

export function newTheme(name: string, questions: DraftQuestion[] = []): DraftTheme {
  return { id: newId(), name, description: "", questions };
}

export function newRound(name: string, type: DraftRound["type"] = "simple"): DraftRound {
  return { id: newId(), name, description: "", type, themes: [] };
}

/** Five priced questions, the usual SIGame row. */
export function starterTheme(name: string, roundIndex: number): DraftTheme {
  const step = 100 * (roundIndex + 1);
  return newTheme(
    name,
    [1, 2, 3, 4, 5].map((n) => newQuestion(n * step)),
  );
}

export function emptyPackage(title: string): DraftPackage {
  return {
    title,
    description: "",
    language: "",
    ageRestriction: "NONE",
    tags: [],
    authors: [],
    sources: [],
    logo: null,
    rounds: [],
  };
}

/** The price a question added at the end of a theme gets. */
export function nextPrice(theme: DraftTheme, roundIndex: number): number {
  const prices = theme.questions.map((q) => q.price).filter((p): p is number => p != null);
  if (prices.length === 0) return 100 * (roundIndex + 1);
  const last = prices[prices.length - 1]!;
  const step = prices.length > 1 ? last - prices[prices.length - 2]! : last;
  return last + (step > 0 ? step : 100);
}

export function questionMedia(q: DraftQuestion): DraftMedia[] {
  const out = [...q.questionFiles, ...q.answerFiles];
  for (const o of q.options)
    if (o.file) out.push({ md5: o.file.md5, type: o.file.type, displayTime: null });
  return out;
}

/** Every media hash the package still references. */
export function reachableMedia(pkg: DraftPackage): Set<string> {
  const out = new Set<string>();
  if (pkg.logo) out.add(pkg.logo.md5);
  for (const r of pkg.rounds)
    for (const t of r.themes)
      for (const q of t.questions) for (const m of questionMedia(q)) out.add(m.md5);
  return out;
}

export function countQuestions(pkg: DraftPackage): number {
  let n = 0;
  for (const r of pkg.rounds) for (const t of r.themes) n += t.questions.length;
  return n;
}

// ── Upload content ⇄ editor tree ────────────────────────────────────────────

const toMedia = (files: QuestionFile[] | null | undefined): DraftMedia[] =>
  [...(files ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((f) => {
      const m: DraftMedia = {
        occurrenceId: newId(),
        md5: f.file.md5,
        type: f.file.type,
        displayTime: f.displayTime,
      };
      if (f.placement === "background") m.placement = "background";
      if (f.waitForFinish === false) m.waitForFinish = false;
      return m;
    });

/** The text's place among the files: how many files come before it. */
const textPosition = (q: UploadQuestion): number | null =>
  q.textOrder == null ? null : (q.questionFiles ?? []).filter((f) => f.order < q.textOrder!).length;

const byOrder = <T extends { order: number }>(list: T[]): T[] =>
  [...list].sort((a, b) => a.order - b.order);

export function fromUpload(c: UploadContent): DraftPackage {
  return {
    title: c.title,
    description: c.description ?? "",
    language: c.language ?? "",
    ageRestriction: c.ageRestriction,
    tags: c.tags.map((t) => t.tag),
    authors: c.authors ?? [],
    sources: c.sources ?? [],
    logo: c.logo?.file ?? null,
    rounds: byOrder(c.rounds).map((r) => ({
      id: newId(),
      name: r.name,
      description: r.description ?? "",
      type: r.type,
      themes: byOrder(r.themes).map((t) => ({
        id: newId(),
        name: t.name,
        description: t.description ?? "",
        questions: byOrder(t.questions).map((q) => {
          const sourceFiles = byOrder(q.questionFiles ?? []);
          const questionFiles = toMedia(sourceFiles);
          const mainTextFirst =
            q.textItems != null &&
            (q.textOrder === 0 ||
              (q.textOrder == null &&
                (!q.text?.trim() || (!sourceFiles.length && !q.textItems.length))));
          const sourceTextItems = q.textItems?.map((item) => ({ ...item, id: newId() }));
          const sourceSteps = [
            ...sourceFiles.map((file) => ({ order: file.order, id: null as string | null })),
            ...(q.textOrder == null || !q.text?.trim() ? [] : [{ order: q.textOrder, id: null }]),
            ...(sourceTextItems ?? []).map((item) => ({ order: item.order, id: item.id })),
          ].sort((a, b) => a.order - b.order);
          const textItems = sourceTextItems?.map((item) => ({
            ...item,
            // A new main-first question retains its empty main slot in the editor,
            // although that slot is omitted from the exported sequence.
            order:
              sourceSteps.findIndex((step) => step.id === item.id) +
              (mainTextFirst && !q.text?.trim() ? 1 : 0),
          }));
          const targets =
            q.pointImageOrder == null
              ? []
              : sourceFiles.flatMap((file, index) =>
                  file.order === q.pointImageOrder && file.file.type === "image" ? [index] : [],
                );
          const pointImageId =
            q.pointImageOrder == null
              ? undefined
              : targets.length === 1
                ? questionFiles[targets[0]!]!.occurrenceId
                : "";
          const sourceOptions = byOrder(q.answers ?? []);
          const options = sourceOptions.map((a) => ({
            id: newId(),
            text: a.text ?? "",
            file: a.file,
          }));
          const matches = sourceOptions
            .map((a, index) => ({ a, index }))
            .filter(({ a }) => q.correctChoiceOrder != null && a.order === q.correctChoiceOrder);
          const correctChoiceOptionId =
            q.correctChoiceNeedsRepair || q.correctChoiceOrder != null
              ? matches.length === 1 && !q.correctChoiceNeedsRepair
                ? options[matches[0]!.index]!.id
                : null
              : undefined;
          return newQuestion(q.price, {
            type: q.type,
            text: q.text ?? "",
            textPosition: mainTextFirst ? 0 : textPosition(q),
            mainTextFirst: mainTextFirst || undefined,
            textItems,
            questionFiles,
            ...(pointImageId === undefined ? {} : { pointImageId }),
            answerText: q.answerText ?? "",
            answerFiles: toMedia(q.answerFiles),
            answerHint: q.answerHint ?? "",
            answerType: q.answerType ?? "text",
            answerNumber: q.answerNumber ?? null,
            answerPoint: q.answerPoint ?? null,
            answerDeviation: q.answerDeviation ?? null,
            rightAnswers: q.rightAnswers ?? [],
            wrongAnswers: q.wrongAnswers ?? [],
            authors: q.authors ?? [],
            sources: q.sources ?? [],
            questionComment: q.questionComment ?? "",
            answerDelay: q.answerDelay ?? 5000,
            showAnswerDuration: q.showAnswerDuration,
            maxPrice: q.maxPrice ?? null,
            forEveryone: q.subType === "forEveryone",
            transferType: q.transferType ?? "any",
            allowedPrices: q.allowedPrices ?? [],
            priceMultiplier: q.priceMultiplier ?? 2,
            options,
            correctChoiceOptionId,
            showDelay: q.showDelay ?? 0,
          });
        }),
      })),
    })),
  };
}

/** Files in order; positions at or after `skip` leave room for the text. */
const fromMedia = (files: DraftMedia[], skip: number | null = null): QuestionFile[] | null =>
  files.length
    ? files.map((f, i) => {
        const out: QuestionFile = {
          file: { md5: f.md5, type: f.type },
          order: skip != null && i >= skip ? i + 1 : i,
          displayTime: f.displayTime,
        };
        if (f.placement === "background" && f.type === "audio") out.placement = "background";
        if (f.waitForFinish === false) out.waitForFinish = false;
        return out;
      })
    : null;

const orNull = (s: string): string | null => (s.trim() ? s : null);

/** Trimmed, non-empty entries; null when nothing is left. */
const listOrNull = (list: string[]): string[] | null => {
  const items = list.map((s) => s.trim()).filter(Boolean);
  return items.length ? items : null;
};

/**
 * Archive-compatible content shared with the editor's publication projection.
 * Type-specific fields stay on their type; final questions are simple with no price.
 */
export function toUpload(pkg: DraftPackage): UploadContent {
  return {
    title: pkg.title.trim(),
    description: orNull(pkg.description),
    language: orNull(pkg.language),
    authors: listOrNull(pkg.authors),
    sources: listOrNull(pkg.sources),
    ageRestriction: pkg.ageRestriction,
    logo: pkg.logo ? { file: pkg.logo } : null,
    tags: pkg.tags.map((tag) => ({ tag })),
    rounds: pkg.rounds.map((r, ri) => ({
      name: r.name.trim(),
      order: ri,
      description: orNull(r.description),
      type: r.type,
      themes: r.themes.map((t, ti) => ({
        name: t.name.trim(),
        order: ti,
        description: orNull(t.description),
        questions: t.questions.map((q, qi) => toUploadQuestion(q, qi, r.type === "final")),
      })),
    })),
  };
}

export function toUploadQuestion(q: DraftQuestion, order: number, final: boolean): UploadQuestion {
  const type: QuestionType = final ? "simple" : q.type;
  const steps = questionSteps(q).filter(
    (step) =>
      step.kind === "media" || (step.kind === "main" ? q.text.trim() : step.item.text.trim()),
  );
  const mainIndex = steps.findIndex((step) => step.kind === "main");
  const textStep =
    mainIndex >= 0 && (q.mainTextFirst || q.questionFiles.length || (q.textItems?.length ?? 0) > 0)
      ? mainIndex
      : null;
  const questionFiles = steps.flatMap((step, index) =>
    step.kind === "media" ? [{ ...fromMedia([step.file])![0]!, order: index }] : [],
  );
  const textItems =
    q.textItems == null
      ? undefined
      : steps.flatMap((step, index) =>
          step.kind === "text" ? [{ order: index, text: step.item.text }] : [],
        );
  const targetIndex =
    q.pointImageId == null
      ? -1
      : q.questionFiles.findIndex(
          (file) => file.occurrenceId === q.pointImageId && file.type === "image",
        );
  const out: UploadQuestion = {
    type,
    order,
    price: final ? null : q.price,
    text: orNull(q.text),
    textOrder: textStep,
    ...(textItems === undefined ? {} : { textItems }),
    questionComment: orNull(q.questionComment),
    answerText: orNull(q.answerText),
    answerHint: orNull(q.answerHint),
    rightAnswers: listOrNull(q.rightAnswers),
    ...answerCheck(q, type),
    wrongAnswers: listOrNull(q.wrongAnswers),
    authors: listOrNull(q.authors),
    sources: listOrNull(q.sources),
    answerDelay: q.answerDelay,
    showAnswerDuration: q.showAnswerDuration,
    questionFiles: questionFiles.length ? questionFiles : null,
    ...(type !== "choice" && q.answerType === "point" && q.pointImageId !== undefined
      ? { pointImageOrder: questionFiles?.[targetIndex]?.order ?? -1 }
      : {}),
    answerFiles: fromMedia(q.answerFiles),
  };
  switch (type) {
    case "hidden":
      out.isHidden = true;
      break;
    case "stake":
      out.subType = q.forEveryone ? "forEveryone" : "simple";
      out.maxPrice = q.maxPrice;
      break;
    case "noRisk":
      out.subType = q.forEveryone ? "forEveryone" : "simple";
      out.priceMultiplier = q.priceMultiplier;
      break;
    case "secret":
      out.subType = q.allowedPrices.length ? "customPrice" : "simple";
      out.transferType = q.transferType;
      out.allowedPrices = q.allowedPrices.length ? q.allowedPrices : null;
      break;
    case "choice":
      out.subType = "simple";
      out.showDelay = q.showDelay;
      out.answers = q.options.map((o, i) => ({ order: i, text: orNull(o.text), file: o.file }));
      if (q.correctChoiceOptionId !== undefined) {
        const index = q.options.findIndex((option) => option.id === q.correctChoiceOptionId);
        if (index < 0) out.correctChoiceNeedsRepair = true;
        else out.correctChoiceOrder = index;
      }
      break;
  }
  return out;
}

/**
 * Number / point answer fields, only for the type that uses them. The chosen
 * mode is kept even while its target is missing (validation blocks publishing
 * then), so it never quietly turns into a text question.
 */
function answerCheck(q: DraftQuestion, type: QuestionType): Partial<UploadQuestion> {
  if (type === "choice") return {};
  if (q.answerType === "number") {
    return {
      answerType: "number",
      answerNumber: q.answerNumber,
      answerDeviation: q.answerDeviation,
    };
  }
  if (q.answerType === "point") {
    return { answerType: "point", answerPoint: q.answerPoint, answerDeviation: q.answerDeviation };
  }
  return {};
}
