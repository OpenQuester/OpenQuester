import { authoredContentGroups, isVisual } from "@/game/authoredContentGroups";
import { scriptContent } from "@/game/questionScript";
import type { UploadContent, UploadQuestion } from "./types";

export const MAX_CONTENT_STEPS = 30;
export const MAX_CONTENT_FILES_PER_STEP = 10;

export type TimelinePhase = "question" | "answer";
export interface TimelineGroupSize {
  files: number;
  visuals: number;
}

export interface TimelineLimitIssue {
  phase: TimelinePhase;
  actual: number;
  max: number;
  /** When absent, the limit applies to the total number of steps. */
  step?: number;
}

export interface ImportLimitIssue extends TimelineLimitIssue {
  round: string;
  theme: string;
  number: number;
}

export class PackageContentLimitError extends Error {
  constructor(public readonly issues: ImportLimitIssue[]) {
    super("contentLimits");
  }
}

export function questionGroupSizes(question: UploadQuestion, phase: TimelinePhase) {
  if (question.script) {
    return question.script.steps.flatMap((step) => {
      if (step.op !== "showContent" || step.phase !== phase) return [];
      if (step.revealRight) return [{ files: 0, visuals: 0 }];
      return authoredContentGroups(scriptContent(question, step)).map((group) => {
        const media = group.flatMap((entry) => ("media" in entry ? [entry.media] : []));
        return { files: media.length, visuals: media.filter(isVisual).length };
      });
    });
  }
  const groups =
    phase === "question"
      ? authoredContentGroups({ ...question, files: question.questionFiles })
      : authoredContentGroups({ files: question.answerFiles, textItems: question.answerTextItems });
  return groups.map((group) => {
    const files = group.flatMap((entry) => ("media" in entry ? [entry.media] : []));
    return { files: files.length, visuals: files.filter(isVisual).length };
  });
}

export function timelineLimitIssues(phase: TimelinePhase, groups: TimelineGroupSize[]) {
  const issues: TimelineLimitIssue[] = [];
  if (groups.length > MAX_CONTENT_STEPS)
    issues.push({ phase, actual: groups.length, max: MAX_CONTENT_STEPS });
  groups.forEach(({ files }, index) => {
    if (files > MAX_CONTENT_FILES_PER_STEP)
      issues.push({ phase, step: index + 1, actual: files, max: MAX_CONTENT_FILES_PER_STEP });
  });
  return issues;
}

export function questionLimitIssues(question: UploadQuestion) {
  return (["question", "answer"] as const).flatMap((phase) =>
    timelineLimitIssues(phase, questionGroupSizes(question, phase)),
  );
}

export function assertImportContentLimits(content: UploadContent) {
  const issues = content.rounds.flatMap((round) =>
    round.themes.flatMap((theme) =>
      theme.questions.flatMap((question, index) =>
        questionLimitIssues(question).map((issue) => ({
          ...issue,
          round: round.name,
          theme: theme.name,
          number: index + 1,
        })),
      ),
    ),
  );
  if (issues.length) throw new PackageContentLimitError(issues);
}
