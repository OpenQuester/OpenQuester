import type { ImportWarning } from "./types";

export interface HtmlRemovalQuestion {
  roundIndex: number;
  themeIndex: number;
  questionIndex: number;
  round: string;
  theme: string;
  price: string;
}
export interface HtmlRemovalReport {
  questions: HtmlRemovalQuestion[];
  totalQuestions: number;
}
export class HtmlConfirmationRequiredError extends Error {
  constructor(public readonly report: HtmlRemovalReport) {
    super("htmlConfirmationRequired");
  }
}
export class PackageImportCancelledError extends Error {
  constructor() {
    super("packageImportCancelled");
  }
}

const childElements = (parent: Element | null, name: string): Element[] =>
  parent ? Array.from(parent.children).filter((e) => e.localName === name) : [];
const child = (parent: Element | null, name: string) => childElements(parent, name)[0] ?? null;
const lower = (s: string | null) => (s ?? "").trim().toLowerCase();
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export function scanSiq(
  pkg: Element,
  names: string[],
  remove: boolean,
  nonEmptyNames: string[] = names,
): HtmlRemovalReport {
  const report: HtmlRemovalReport = { questions: [], totalQuestions: 0 };
  const paths = new Set(names.map((n) => decode(n).toLowerCase()));
  // A ZIP worker can return aliases in any order. Prefer a media target only
  // when every possible match at a lookup step is nonempty.
  const nonEmpty = new Set(nonEmptyNames);
  const exact = new Map<string, boolean[]>();
  const folded = new Map<string, boolean[]>();
  const add = (map: Map<string, boolean[]>, key: string, usable: boolean) => {
    const values = map.get(key) ?? [];
    values.push(usable);
    map.set(key, values);
  };
  for (const name of names) {
    for (const key of new Set([name, decode(name)])) {
      add(exact, key, nonEmpty.has(name));
      add(folded, key.toLowerCase(), nonEmpty.has(name));
    }
  }
  const hasMedia = (path: string) => {
    let encoded = path;
    try {
      encoded = encodeURI(path);
    } catch {
      /* Keep the literal path. */
    }
    return [path, decode(path), encoded].some((candidate) => {
      const matches = exact.get(candidate) ?? folded.get(candidate.toLowerCase());
      return matches != null && matches.every(Boolean);
    });
  };
  const mediaFolders: Record<string, string> = {
    image: "Images",
    audio: "Audio",
    voice: "Audio",
    video: "Video",
  };
  const rounds = childElements(child(pkg, "rounds"), "round");
  rounds.forEach((r, ri) => {
    let removedThemes = 0;
    childElements(child(r, "themes"), "theme").forEach((t, ti) => {
      const qs = childElements(child(t, "questions"), "question");
      let removed = 0;
      qs.forEach((q, qi) => {
        report.totalQuestions++;
        const structural =
          lower(q.getAttribute("type")) === "html" ||
          lower(child(q, "type")?.getAttribute("name") ?? null) === "html" ||
          Array.from(q.getElementsByTagName("*")).some((e) => {
            if (e.localName !== "item" && e.localName !== "atom") return false;
            const kind = lower(e.getAttribute("type"));
            if (kind === "html") return true;
            const rawValue = (e.textContent ?? "").trim();
            const value = decode(rawValue);
            const isRef = lower(e.getAttribute("isRef")) === "true";
            const media =
              kind === "image" || kind === "audio" || kind === "video" || kind === "voice";
            const markedRef = value.startsWith("@") && !!kind && kind !== "text" && kind !== "say";
            if (!isRef && !media && !markedRef) return false;
            const path = value.replace(/^@/, "").toLowerCase();
            if (!path.startsWith("html/") || !paths.has(path)) return false;
            const folder = mediaFolders[e.getAttribute("type") ?? ""];
            // SiqReader resolves known media inside its type folder before this fallback.
            const mediaPath = folder && `${folder}/${rawValue.replace(/^@/, "")}`;
            return !mediaPath || !hasMedia(mediaPath);
          });
        if (!structural) return;
        report.questions.push({
          roundIndex: ri,
          themeIndex: ti,
          questionIndex: qi,
          round: r.getAttribute("name") ?? "-",
          theme: t.getAttribute("name") ?? "-",
          price: q.getAttribute("price") ?? "",
        });
        if (remove) {
          q.remove();
          removed++;
        }
      });
      if (remove && removed && removed === qs.length) {
        t.remove();
        removedThemes++;
      }
    });
    if (remove && removedThemes && !childElements(child(r, "themes"), "theme").length) r.remove();
  });
  return report;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const normalize = (values: unknown[]) => {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => {
      const order = (v: unknown, i: number) => {
        if (!obj(v)) return i;
        const n = v.order;
        if (typeof n === "number") return n;
        if (typeof n === "string" && n.trim() && !isNaN(+n)) return +n;
        return i;
      };
      return order(a.value, a.index) - order(b.value, b.index);
    });
  sorted.forEach(({ value }, index) => {
    if (obj(value)) value.order = index;
  });
};
const isHtmlFile = (v: unknown) =>
  obj(v) && lower(typeof v.type === "string" ? v.type : null) === "html";
export function scanOq(p: Json, remove: boolean): HtmlRemovalReport {
  const report: HtmlRemovalReport = { questions: [], totalQuestions: 0 };
  const rounds = arr(p.rounds);
  p.rounds = rounds.filter((r, ri) => {
    if (!obj(r)) return true;
    const themes = arr(r.themes);
    let removedThemes = 0;
    const keptThemes = themes.filter((t, ti) => {
      if (!obj(t)) return true;
      const qs = arr(t.questions);
      let removed = 0;
      const kept = qs.filter((q, qi) => {
        if (!obj(q)) return true;
        report.totalQuestions++;
        const html =
          lower(typeof q.type === "string" ? q.type : null) === "html" ||
          [...arr(q.questionFiles), ...arr(q.answerFiles), ...arr(q.answers)].some(
            (f) => obj(f) && isHtmlFile(f.file),
          );
        if (!html) return true;
        report.questions.push({
          roundIndex: ri,
          themeIndex: ti,
          questionIndex: qi,
          round: String(r.name ?? "-"),
          theme: String(t.name ?? "-"),
          price: String(q.price ?? ""),
        });
        removed++;
        return !remove;
      });
      if (remove && removed) {
        t.questions = kept;
        normalize(kept);
      }
      if (remove && removed && !kept.length) {
        removedThemes++;
        return false;
      }
      return true;
    });
    if (remove && removedThemes) {
      r.themes = keptThemes;
      normalize(keptThemes);
    }
    return !(remove && removedThemes && !keptThemes.length);
  });
  if (remove && report.questions.length) normalize(arr(p.rounds));
  return report;
}
export function removalWarnings(report: HtmlRemovalReport): ImportWarning[] {
  return report.questions.map((q) => ({
    code: "htmlQuestionRemoved",
    where: `${q.round} › ${q.theme} › ${q.questionIndex + 1} › ${q.price}`,
  }));
}
export function requireRemoval(report: HtmlRemovalReport, allowed: boolean) {
  if (report.questions.length && !allowed) throw new HtmlConfirmationRequiredError(report);
  if (report.questions.length && report.questions.length === report.totalQuestions)
    throw new Error("allHtmlQuestions");
}
