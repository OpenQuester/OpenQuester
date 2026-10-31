import type { MediaChange } from "./questionMediaHistory";
import { questionSteps, withQuestionSteps, type QuestionStep } from "./questionTimeline";

export function stepId(step: QuestionStep): string {
  return step.kind === "main"
    ? "main"
    : step.kind === "text"
      ? `text:${step.item.id}`
      : `media:${step.file.occurrenceId}`;
}

/** Move one occurrence and undo only that move, retaining later edits. */
export function moveTimeline(id: string, destination: number): MediaChange {
  return (question) => {
    const steps = questionSteps(question);
    const from = steps.findIndex((step) => stepId(step) === id);
    if (from < 0 || (question.mainTextFirst && id === "main")) return null;
    const to = Math.max(question.mainTextFirst ? 1 : 0, Math.min(destination, steps.length - 1));
    if (to === from) return null;
    const before = steps[from - 1] && stepId(steps[from - 1]!);
    const after = steps[from + 1] && stepId(steps[from + 1]!);
    const next = [...steps];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    return {
      question: withQuestionSteps(question, next),
      undo: (current) => {
        const list = questionSteps(current);
        const index = list.findIndex((step) => stepId(step) === id);
        if (index < 0) return current;
        const [moved] = list.splice(index, 1);
        const nextIndex = after ? list.findIndex((step) => stepId(step) === after) : -1;
        const previousIndex = before ? list.findIndex((step) => stepId(step) === before) : -1;
        const position = nextIndex >= 0 ? nextIndex : previousIndex >= 0 ? previousIndex + 1 : from;
        list.splice(
          Math.max(current.mainTextFirst ? 1 : 0, Math.min(position, list.length)),
          0,
          moved!,
        );
        return withQuestionSteps(current, list);
      },
    };
  };
}
