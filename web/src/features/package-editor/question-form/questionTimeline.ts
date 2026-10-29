import type { DraftMedia, DraftQuestion, DraftTextItem } from "../packageDraft";

export type QuestionStep =
  { kind: "main" } | { kind: "media"; file: DraftMedia } | { kind: "text"; item: DraftTextItem };

/** The main text position counts files; additional text positions count all steps. */
export function questionSteps(question: DraftQuestion): QuestionStep[] {
  const steps: QuestionStep[] = question.questionFiles.map((file) => ({ kind: "media", file }));
  if (question.textPosition != null)
    steps.splice(
      question.mainTextFirst ? 0 : Math.max(0, Math.min(question.textPosition, steps.length)),
      0,
      { kind: "main" },
    );
  for (const item of [...(question.textItems ?? [])].sort((a, b) => a.order - b.order))
    steps.splice(Math.max(question.mainTextFirst ? 1 : 0, Math.min(item.order, steps.length)), 0, {
      kind: "text",
      item,
    });
  return steps;
}

/** Rewrite both projections from the ordered steps without changing their contents. */
export function withQuestionSteps(question: DraftQuestion, steps: QuestionStep[]): DraftQuestion {
  if (question.mainTextFirst) {
    const main = steps.find((step) => step.kind === "main");
    if (main) steps = [main, ...steps.filter((step) => step !== main)];
  }
  const mainIndex = steps.findIndex((step) => step.kind === "main");
  return {
    ...question,
    questionFiles: steps.flatMap((step) => (step.kind === "media" ? [step.file] : [])),
    textPosition:
      mainIndex < 0
        ? null
        : steps.slice(0, mainIndex).filter((step) => step.kind === "media").length,
    textItems:
      question.textItems == null && !steps.some((step) => step.kind === "text")
        ? undefined
        : steps.flatMap((step, order) => (step.kind === "text" ? [{ ...step.item, order }] : [])),
  };
}

/** Keep text steps anchored while existing attachment operations add, remove or reorder files. */
export function syncQuestionFiles(
  before: DraftQuestion,
  after: DraftQuestion,
  restore?: QuestionStep[],
): DraftQuestion {
  const ids = (q: DraftQuestion) => q.questionFiles.map((file) => file.occurrenceId);
  const oldIds = ids(before);
  const newIds = ids(after);
  if (oldIds.length === newIds.length && oldIds.every((id, i) => id === newIds[i])) return after;
  if (oldIds.some((id) => !id) || newIds.some((id) => !id)) return after;
  const original = questionSteps(before);
  const kept = original.filter(
    (step) => step.kind !== "media" || newIds.includes(step.file.occurrenceId),
  );
  const existing = after.questionFiles.filter((file) => oldIds.includes(file.occurrenceId));
  let next = 0;
  const steps = kept.map((step) =>
    step.kind === "media" ? { kind: "media" as const, file: existing[next++]! } : step,
  );
  const key = (step: QuestionStep) =>
    step.kind === "media"
      ? `media:${step.file.occurrenceId}`
      : step.kind === "text"
        ? `text:${step.item.id}`
        : "main";
  for (const file of after.questionFiles.filter((item) => !oldIds.includes(item.occurrenceId))) {
    const index = after.questionFiles.indexOf(file);
    let at = -1;
    if (restore) {
      const oldIndex = restore.findIndex(
        (step) => step.kind === "media" && step.file.occurrenceId === file.occurrenceId,
      );
      if (oldIndex >= 0) {
        for (const item of restore.slice(oldIndex + 1)) {
          const found = steps.findIndex((step) => key(step) === key(item));
          if (found >= 0) {
            at = found;
            break;
          }
        }
      }
    }
    if (at < 0) {
      for (const following of after.questionFiles.slice(index + 1)) {
        const found = steps.findIndex(
          (step) => step.kind === "media" && step.file.occurrenceId === following.occurrenceId,
        );
        if (found >= 0) {
          at = found;
          break;
        }
      }
    }
    steps.splice(at < 0 ? steps.length : at, 0, { kind: "media", file });
  }
  return withQuestionSteps(after, steps);
}
