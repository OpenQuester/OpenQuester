import type { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { scriptPointImageOrder } from "domain/logic/question/PointImageLogic";
import { authoredContentGroups } from "domain/logic/question/authoredContentGroups";

/** Cross-field reference and expanded-content checks after the strict wire schema. */
export function validateQuestionScript(question: PackageQuestionDTO): boolean {
  const program = question.script;
  if (!program) {
    return true;
  }
  const counts = { question: 0, answer: 0 };
  let format = "text";
  let target = -1;
  for (const step of program.steps) {
    if (step.op === "setAnswerType") {
      format = step.answerType;
      if (format === "number" && !Number.isFinite(question.answerNumber)) {
        return false;
      }
      if (format === "point" && !question.answerPoint) {
        return false;
      }
      if (format === "select") {
        const selected = step.optionOrders ?? [];
        if (
          selected.length < 2 ||
          new Set(selected).size !== selected.length ||
          !selected.includes(step.correctChoiceOrder!) ||
          selected.some(
            (order) => question.answers?.filter((option) => option.order === order).length !== 1
          )
        ) {
          return false;
        }
      }
    }
    if (step.op === "showContent") {
      if (step.revealRight) {
        counts[step.phase]++;
        if (format !== "point") {
          target = -1;
        }
        continue;
      }
      const files = step.phase === "question" ? question.questionFiles : question.answerFiles;
      const texts =
        step.phase === "question"
          ? question.textItems
          : (question.answerTextItems ?? program.answerTextItems);
      const orderSet = new Set(step.orders);
      const selectedFiles = files?.filter((item) => orderSet.has(item.order));
      const selectedTexts = texts?.filter((item) => orderSet.has(item.order));
      const available = [...(selectedFiles ?? []), ...(selectedTexts ?? [])];
      if (
        !step.orders.length ||
        orderSet.size !== step.orders.length ||
        step.orders.some((order) => available.filter((item) => item.order === order).length !== 1)
      ) {
        return false;
      }
      const groups = authoredContentGroups({ files: selectedFiles, textItems: selectedTexts });
      counts[step.phase] += groups.length;
      if (groups.some((group) => group.filter((item) => "media" in item).length > 10)) {
        return false;
      }
      target = scriptPointImageOrder(selectedFiles, selectedTexts);
    }
    if (step.op === "askAnswer" && format === "point" && target === -1) {
      return false;
    }
  }
  return counts.question <= 30 && counts.answer <= 30;
}
