import type {
  FileRef,
  MediaType,
  QuestionFile,
  UploadContent,
  UploadQuestion,
} from "@/features/upload/types";

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

export interface EditorMedia {
  md5: string;
  type: MediaType;
  /** Milliseconds the file stays on screen; null lets the game decide. */
  displayTime: number | null;
}

export interface ChoiceOption {
  id: string;
  text: string;
  file: FileRef | null;
}

export interface EditorQuestion {
  id: string;
  type: QuestionType;
  price: number | null;
  text: string;
  questionFiles: EditorMedia[];
  answerText: string;
  answerFiles: EditorMedia[];
  answerHint: string;
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
  options: ChoiceOption[];
  showDelay: number;
}

export interface EditorTheme {
  id: string;
  name: string;
  description: string;
  questions: EditorQuestion[];
}

export interface EditorRound {
  id: string;
  name: string;
  description: string;
  type: "simple" | "final";
  themes: EditorTheme[];
}

export type AgeRestriction = UploadContent["ageRestriction"];

export interface EditorPackage {
  title: string;
  description: string;
  language: string;
  ageRestriction: AgeRestriction;
  tags: string[];
  logo: FileRef | null;
  rounds: EditorRound[];
}

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function newQuestion(
  price: number | null,
  patch: Partial<EditorQuestion> = {},
): EditorQuestion {
  return {
    id: newId(),
    type: "simple",
    price,
    text: "",
    questionFiles: [],
    answerText: "",
    answerFiles: [],
    answerHint: "",
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

export function newTheme(name: string, questions: EditorQuestion[] = []): EditorTheme {
  return { id: newId(), name, description: "", questions };
}

export function newRound(name: string, type: EditorRound["type"] = "simple"): EditorRound {
  return { id: newId(), name, description: "", type, themes: [] };
}

/** Five priced questions, the usual SIGame row. */
export function starterTheme(name: string, roundIndex: number): EditorTheme {
  const step = 100 * (roundIndex + 1);
  return newTheme(
    name,
    [1, 2, 3, 4, 5].map((n) => newQuestion(n * step)),
  );
}

export function emptyPackage(title: string): EditorPackage {
  return {
    title,
    description: "",
    language: "",
    ageRestriction: "NONE",
    tags: [],
    logo: null,
    rounds: [],
  };
}

/** The price a question added at the end of a theme gets. */
export function nextPrice(theme: EditorTheme, roundIndex: number): number {
  const prices = theme.questions.map((q) => q.price).filter((p): p is number => p != null);
  if (prices.length === 0) return 100 * (roundIndex + 1);
  const last = prices[prices.length - 1]!;
  const step = prices.length > 1 ? last - prices[prices.length - 2]! : last;
  return last + (step > 0 ? step : 100);
}

export function questionMedia(q: EditorQuestion): EditorMedia[] {
  const out = [...q.questionFiles, ...q.answerFiles];
  for (const o of q.options)
    if (o.file) out.push({ md5: o.file.md5, type: o.file.type, displayTime: null });
  return out;
}

/** Every media hash the package still references. */
export function reachableMedia(pkg: EditorPackage): Set<string> {
  const out = new Set<string>();
  if (pkg.logo) out.add(pkg.logo.md5);
  for (const r of pkg.rounds)
    for (const t of r.themes)
      for (const q of t.questions) for (const m of questionMedia(q)) out.add(m.md5);
  return out;
}

export function countQuestions(pkg: EditorPackage): number {
  let n = 0;
  for (const r of pkg.rounds) for (const t of r.themes) n += t.questions.length;
  return n;
}

// ── Upload content ⇄ editor tree ────────────────────────────────────────────

const toMedia = (files: QuestionFile[] | null | undefined): EditorMedia[] =>
  [...(files ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((f) => ({
      md5: f.file.md5,
      type: f.file.type,
      displayTime: f.displayTime,
    }));

const byOrder = <T extends { order: number }>(list: T[]): T[] =>
  [...list].sort((a, b) => a.order - b.order);

export function fromUpload(c: UploadContent): EditorPackage {
  return {
    title: c.title,
    description: c.description ?? "",
    language: c.language ?? "",
    ageRestriction: c.ageRestriction,
    tags: c.tags.map((t) => t.tag),
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
        questions: byOrder(t.questions).map((q) =>
          newQuestion(q.price, {
            type: q.type,
            text: q.text ?? "",
            questionFiles: toMedia(q.questionFiles),
            answerText: q.answerText ?? "",
            answerFiles: toMedia(q.answerFiles),
            answerHint: q.answerHint ?? "",
            questionComment: q.questionComment ?? "",
            answerDelay: q.answerDelay ?? 5000,
            showAnswerDuration: q.showAnswerDuration,
            maxPrice: q.maxPrice ?? null,
            forEveryone: q.subType === "forEveryone",
            transferType: q.transferType ?? "any",
            allowedPrices: q.allowedPrices ?? [],
            priceMultiplier: q.priceMultiplier ?? 2,
            options: byOrder(q.answers ?? []).map((a) => ({
              id: newId(),
              text: a.text ?? "",
              file: a.file,
            })),
            showDelay: q.showDelay ?? 0,
          }),
        ),
      })),
    })),
  };
}

const fromMedia = (files: EditorMedia[]): QuestionFile[] | null =>
  files.length
    ? files.map((f, order) => ({
        file: { md5: f.md5, type: f.type },
        order,
        displayTime: f.displayTime,
      }))
    : null;

const orNull = (s: string): string | null => (s.trim() ? s : null);

/**
 * The POST /v1/packages body. Mirrors the server's Joi scheme: type-specific
 * fields only on their type, final round questions are simple with no price.
 */
export function toUpload(pkg: EditorPackage): UploadContent {
  return {
    title: pkg.title.trim(),
    description: orNull(pkg.description),
    language: orNull(pkg.language),
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

function toUploadQuestion(q: EditorQuestion, order: number, final: boolean): UploadQuestion {
  const type: QuestionType = final ? "simple" : q.type;
  const out: UploadQuestion = {
    type,
    order,
    price: final ? null : q.price,
    text: orNull(q.text),
    questionComment: orNull(q.questionComment),
    answerText: orNull(q.answerText),
    answerHint: orNull(q.answerHint),
    answerDelay: q.answerDelay,
    showAnswerDuration: q.showAnswerDuration,
    questionFiles: fromMedia(q.questionFiles),
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
      break;
  }
  return out;
}
