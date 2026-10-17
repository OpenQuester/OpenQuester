import { questionMedia, type EditorPackage, type EditorQuestion } from "./model";

/**
 * Package checks from docs/specs/package-validation-spec.md. Critical issues
 * block publishing (the server would reject the package or the game couldn't
 * play it); warnings and info never block saving or publishing.
 */
export type Severity = "critical" | "warning" | "info";
export type Health = "good" | "needsAttention" | "broken";

export type IssueTarget =
  | { kind: "package" }
  | { kind: "round"; id: string }
  | { kind: "theme"; id: string; roundId: string }
  | { kind: "question"; id: string; themeId: string; roundId: string };

export interface Issue {
  /** Stable per rule and item, used as a React key. */
  id: string;
  severity: Severity;
  /** Key under editor.issues.* */
  code: IssueCode;
  args?: Record<string, string | number>;
  target: IssueTarget;
  /** Round › theme › price, for the issue list. */
  where: string;
}

export type IssueCode =
  | "noTitle"
  | "noRounds"
  | "roundNoName"
  | "roundNoThemes"
  | "themeNoName"
  | "themeNoQuestions"
  | "questionEmpty"
  | "noPrice"
  | "priceRange"
  | "missingMedia"
  | "choiceOptions"
  | "choiceEmptyOption"
  | "choiceNoCorrect"
  | "secretPrices"
  | "multipleFinals"
  | "finalNotLast"
  | "finalOneQuestion"
  | "finalTypeIgnored"
  | "noAnswer"
  | "numberAnswerMissing"
  | "pointAnswerMissing"
  | "longText"
  | "noLanguage"
  | "noDescription"
  | "noTags";

export const MAX_PRICE = 1_000_000;
const LONG_TEXT = 600;

export interface Report {
  health: Health;
  issues: Issue[];
  critical: number;
  warnings: number;
  /** Worst severity per round, theme and question id, for badges. */
  byNode: Map<string, Severity>;
}

const rank: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };

export function validate(pkg: EditorPackage, hasMedia: (md5: string) => boolean): Report {
  const issues: Issue[] = [];
  const add = (
    severity: Severity,
    code: IssueCode,
    target: IssueTarget,
    where: string,
    args?: Issue["args"],
  ) => {
    const node = target.kind === "package" ? "package" : target.id;
    issues.push({ id: `${code}:${node}`, severity, code, target, where, args });
  };
  const pk = { kind: "package" } as const;

  if (!pkg.title.trim()) add("critical", "noTitle", pk, "");
  if (pkg.rounds.length === 0) add("critical", "noRounds", pk, "");
  if (pkg.logo && !hasMedia(pkg.logo.md5)) add("critical", "missingMedia", pk, "");

  const finals = pkg.rounds.filter((r) => r.type === "final");
  if (finals.length > 1) add("critical", "multipleFinals", pk, "");
  else if (finals.length === 1 && pkg.rounds[pkg.rounds.length - 1]?.type !== "final")
    add("critical", "finalNotLast", { kind: "round", id: finals[0]!.id }, finals[0]!.name);

  for (const round of pkg.rounds) {
    const rName = round.name.trim() || "—";
    const final = round.type === "final";
    if (!round.name.trim()) add("critical", "roundNoName", { kind: "round", id: round.id }, rName);
    if (round.themes.length === 0)
      add("critical", "roundNoThemes", { kind: "round", id: round.id }, rName);

    for (const theme of round.themes) {
      const tName = theme.name.trim() || "—";
      const tTarget = { kind: "theme", id: theme.id, roundId: round.id } as const;
      const tWhere = `${rName} › ${tName}`;
      if (!theme.name.trim()) add("critical", "themeNoName", tTarget, tWhere);
      if (theme.questions.length === 0) add("critical", "themeNoQuestions", tTarget, tWhere);
      else if (final && theme.questions.length > 1)
        add("critical", "finalOneQuestion", tTarget, tWhere, { count: theme.questions.length });

      for (const q of theme.questions) {
        const where = final ? tWhere : `${tWhere} › ${q.price ?? "—"}`;
        const target = {
          kind: "question",
          id: q.id,
          themeId: theme.id,
          roundId: round.id,
        } as const;
        checkQuestion(
          q,
          final,
          (severity, code, args) => add(severity, code, target, where, args),
          hasMedia,
        );
      }
    }
  }

  if (!pkg.language) add("info", "noLanguage", pk, "");
  if (!pkg.description.trim()) add("info", "noDescription", pk, "");
  if (pkg.tags.length === 0) add("info", "noTags", pk, "");

  issues.sort((a, b) => rank[b.severity] - rank[a.severity]);
  const byNode = new Map<string, Severity>();
  const mark = (id: string, s: Severity) => {
    const prev = byNode.get(id);
    if (!prev || rank[s] > rank[prev]) byNode.set(id, s);
  };
  for (const i of issues) {
    if (i.severity === "info") continue;
    const t = i.target;
    if (t.kind === "round") mark(t.id, i.severity);
    if (t.kind === "theme") {
      mark(t.id, i.severity);
      mark(t.roundId, i.severity);
    }
    if (t.kind === "question") {
      mark(t.id, i.severity);
      mark(t.themeId, i.severity);
      mark(t.roundId, i.severity);
    }
  }
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  return {
    health: critical ? "broken" : warnings ? "needsAttention" : "good",
    issues,
    critical,
    warnings,
    byNode,
  };
}

function checkQuestion(
  q: EditorQuestion,
  final: boolean,
  add: (severity: Severity, code: IssueCode, args?: Issue["args"]) => void,
  hasMedia: (md5: string) => boolean,
) {
  if (!q.text.trim() && q.questionFiles.length === 0) add("critical", "questionEmpty");
  if (!final) {
    if (q.price == null) add("critical", "noPrice");
    else if (q.price < 0 || q.price > MAX_PRICE) add("critical", "priceRange", { max: MAX_PRICE });
  } else if (q.type !== "simple") add("warning", "finalTypeIgnored");
  const missing = questionMedia(q).filter((m) => !hasMedia(m.md5)).length;
  if (missing) add("critical", "missingMedia", { count: missing });

  const type = final ? "simple" : q.type;
  if (type === "choice") {
    if (q.options.length < 2 || q.options.length > 8)
      add("critical", "choiceOptions", { count: q.options.length });
    if (q.options.some((o) => !o.text.trim() && !o.file)) add("critical", "choiceEmptyOption");
    if (!q.options.some((o) => o.text.trim() && o.text.trim() === q.answerText.trim()))
      add("warning", "choiceNoCorrect");
  } else if (!q.answerText.trim() && q.answerFiles.length === 0) add("warning", "noAnswer");

  // A number or point answer needs its target, or the server couldn't judge it
  if (type !== "choice" && q.answerType === "number" && !Number.isFinite(q.answerNumber))
    add("critical", "numberAnswerMissing");
  if (type !== "choice" && q.answerType === "point") {
    const hasPicture = q.questionFiles.some((f) => f.type === "image");
    const validPoint =
      q.answerPoint &&
      [q.answerPoint.x, q.answerPoint.y].every(
        (coordinate) => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1,
      );
    if (!validPoint || !hasPicture) add("critical", "pointAnswerMissing");
  }
  if (
    type === "secret" &&
    q.allowedPrices.length > 0 &&
    (q.allowedPrices.length < 2 || q.allowedPrices.length > 5)
  )
    add("critical", "secretPrices", { count: q.allowedPrices.length });
  if (q.text.length > LONG_TEXT || q.answerText.length > LONG_TEXT) add("warning", "longText");
}
