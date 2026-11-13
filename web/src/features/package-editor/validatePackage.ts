import { answerFormat } from "@/game/answerFormat";
import { readSecretRules } from "@/game/secretRules";
import { scriptReferenceIssue } from "@/game/questionScript";
import { questionLimitIssues } from "@/features/upload/contentLimits";
import { invalidSelectSource } from "@/features/upload/siqCompatibility";
import { draftPointImage, toUploadQuestion } from "./packageDraft";
import { questionMedia, type DraftPackage, type DraftQuestion } from "./packageDraft";

/**
 * Package checks from docs/specs/package-validation-spec.md. Critical issues
 * block publishing (the server would reject the package or the game couldn't
 * play it); warnings and info never block saving or publishing.
 */
export type ValidationSeverity = "critical" | "warning" | "info";
export type PackageHealth = "good" | "needsAttention" | "broken";

export type PackageIssueTarget =
  | { kind: "package" }
  | { kind: "round"; id: string }
  | { kind: "theme"; id: string; roundId: string }
  | { kind: "question"; id: string; themeId: string; roundId: string };

export interface PackageValidationIssue {
  /** Stable per rule and item, used as a React key. */
  id: string;
  severity: ValidationSeverity;
  /** Key under editor.issues.* */
  code: PackageIssueCode;
  args?: Record<string, string | number>;
  target: PackageIssueTarget;
  /** Round › theme › price, for the issue list. */
  where: string;
}

export type PackageIssueCode =
  | "compatibilityNeedsRepair"
  | "secretRulesInvalid"
  | "realPriceRange"
  | "contentNeedsRepair"
  | "answerDurationInvalid"
  | "contentTimingInvalid"
  | "scriptRepair"
  | "noTitle"
  | "noRounds"
  | "roundNoName"
  | "roundNoThemes"
  | "themeNoName"
  | "themeNoQuestions"
  | "contentStepLimit"
  | "contentFileLimit"
  | "questionEmpty"
  | "noPrice"
  | "priceRange"
  | "missingMedia"
  | "choiceOptions"
  | "choiceEmptyOption"
  | "choiceNoCorrect"
  | "choiceCorrectUnresolved"
  | "secretPrices"
  | "realPriceConflict"
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

export interface PackageValidationReport {
  health: PackageHealth;
  issues: PackageValidationIssue[];
  critical: number;
  warnings: number;
  /** Worst severity per round, theme and question id, for badges. */
  byNode: Map<string, ValidationSeverity>;
}

const rank: Record<ValidationSeverity, number> = { critical: 3, warning: 2, info: 1 };

export function validatePackage(
  pkg: DraftPackage,
  hasMedia: (md5: string) => boolean,
): PackageValidationReport {
  const issues: PackageValidationIssue[] = [];
  const add = (
    severity: ValidationSeverity,
    code: PackageIssueCode,
    target: PackageIssueTarget,
    where: string,
    args?: PackageValidationIssue["args"],
  ) => {
    const node = target.kind === "package" ? "package" : target.id;
    const scope = args?.context ? `:${args.context}:${args.step ?? ""}` : "";
    issues.push({ id: `${code}:${node}${scope}`, severity, code, target, where, args });
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
  const byNode = new Map<string, ValidationSeverity>();
  const mark = (id: string, s: ValidationSeverity) => {
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

export function checkQuestion(
  q: DraftQuestion,
  final: boolean,
  add: (
    severity: ValidationSeverity,
    code: PackageIssueCode,
    args?: PackageValidationIssue["args"],
  ) => void,
  hasMedia: (md5: string) => boolean,
) {
  const award = q.type === "secret" && q.secretRules?.outcome === "award";
  const repairs = q.compatibilityIssues?.filter(
    (issue) => issue.severity === "critical" || issue.resolution === "needsRepair",
  );
  if (repairs?.some((issue) => issue.code === "contentNeedsRepair"))
    add("critical", "contentNeedsRepair");
  if (repairs?.some((issue) => issue.code !== "contentNeedsRepair"))
    add("critical", "compatibilityNeedsRepair");
  if (
    q.answerDurationMs != null &&
    (!Number.isInteger(q.answerDurationMs) ||
      q.answerDurationMs < 0 ||
      q.answerDurationMs > 2147483647)
  )
    add("critical", "answerDurationInvalid");
  const textItems = [...(q.textItems ?? []), ...(q.answerTextItems ?? [])];
  if (
    [...textItems, ...(q.script?.answerTextItems ?? [])].some(
      (item) => !item.text.trim() && (item.durationMs == null || item.durationMs === 0),
    ) ||
    [...textItems, { durationMs: q.textDurationMs }].some(
      (item) =>
        item.durationMs != null &&
        (!Number.isInteger(item.durationMs) || item.durationMs <= 0 || item.durationMs > 120_000),
    )
  )
    add("critical", "contentTimingInvalid");
  if (
    q.realPrice != null &&
    (!Number.isSafeInteger(q.realPrice) || q.realPrice < 0 || q.realPrice > MAX_PRICE)
  )
    add("critical", "realPriceRange");
  try {
    if (q.type === "secret") readSecretRules(q.secretRules);
    if (
      q.type === "secret" &&
      ((q.secretRules && q.allowedPrices.length) ||
        (q.realPrice != null && q.secretRules?.priceRule))
    )
      throw new Error();
  } catch {
    add("critical", "secretRulesInvalid");
  }
  if (
    !award &&
    !q.script &&
    !q.text.trim() &&
    !q.textItems?.some((item) => item.text.trim()) &&
    q.questionFiles.length === 0
  )
    add("critical", "questionEmpty");
  if (!final) {
    if (q.price == null) add("critical", "noPrice");
    else if (q.price < 0 || q.price > MAX_PRICE) add("critical", "priceRange", { max: MAX_PRICE });
  } else if (q.type !== "simple" && !q.script) add("warning", "finalTypeIgnored");
  const upload = toUploadQuestion(q, 0, final);
  const scriptIssue = scriptReferenceIssue(upload);
  if (scriptIssue) add("critical", "scriptRepair", { detail: scriptIssue });
  for (const { phase, actual, max, step } of questionLimitIssues(upload)) {
    add("critical", step === undefined ? "contentStepLimit" : "contentFileLimit", {
      context: phase,
      actual,
      max,
      ...(step === undefined ? {} : { step }),
    });
  }
  const missing = questionMedia(q).filter((m) => !hasMedia(m.md5)).length;
  if (missing) add("critical", "missingMedia", { count: missing });

  const type = final ? "simple" : q.type;
  if (type === "secret" && q.allowedPrices.length > 0 && q.realPrice != null)
    add("critical", "realPriceConflict");
  const numeric = answerFormat(q) !== "select" && q.answerType === "number";
  if (!q.script && answerFormat(q) === "select") {
    if (q.options.length < 2) add("critical", "choiceOptions", { count: q.options.length });
    if (q.options.some((o) => !o.text.trim() && !o.file)) add("critical", "choiceEmptyOption");
    if (
      invalidSelectSource(q.selectSource, q.options) ||
      (q.answerType === "select" && q.correctChoiceOptionId === undefined) ||
      q.correctChoiceOptionId === null ||
      (q.correctChoiceOptionId !== undefined &&
        !q.options.some((o) => o.id === q.correctChoiceOptionId))
    )
      add("critical", "choiceCorrectUnresolved");
    else if (
      q.correctChoiceOptionId === undefined &&
      !q.options.some((o) => o.text.trim() && o.text.trim() === q.answerText.trim())
    )
      add("warning", "choiceNoCorrect");
  } else if (
    !q.script &&
    !award &&
    (numeric ? !Number.isFinite(q.answerNumber) : !q.answerText.trim()) &&
    q.answerFiles.length === 0
  )
    add("warning", "noAnswer");

  // A number or point answer needs its target, or the server couldn't judge it
  if (
    !q.script &&
    !award &&
    answerFormat(q) !== "select" &&
    q.answerType === "number" &&
    !Number.isFinite(q.answerNumber)
  )
    add("critical", "numberAnswerMissing");
  if (!q.script && !award && answerFormat(q) !== "select" && q.answerType === "point") {
    const hasPicture = !!draftPointImage(q);
    const validPoint =
      q.answerPoint &&
      [q.answerPoint.x, q.answerPoint.y].every(
        (coordinate) => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1,
      );
    const source = q.answerPoint?.sourceGeometry;
    const validSource =
      !source ||
      (source.kind === "sigame" && Number.isFinite(source.aspectRatio) && source.aspectRatio > 0);
    if (!validPoint || !hasPicture || !validSource) add("critical", "pointAnswerMissing");
  }
  if (
    type === "secret" &&
    q.allowedPrices.length > 0 &&
    (q.allowedPrices.length < 2 ||
      q.allowedPrices.length > 5 ||
      q.allowedPrices.some(
        (price) => !Number.isSafeInteger(price) || price < 0 || price > MAX_PRICE,
      ))
  )
    add("critical", "secretPrices", { count: q.allowedPrices.length });
  if (q.text.length > LONG_TEXT || (!numeric && q.answerText.length > LONG_TEXT))
    add("warning", "longText");
}
