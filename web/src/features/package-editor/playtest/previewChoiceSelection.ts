import type { Question } from "@/game/protocol";
import { answerFormat } from "@/game/answerFormat";
import {
  ambiguousMediaPlaceholder,
  optionAnswer,
} from "@/features/game/play/question/optionAnswer";

export function previewChoiceSelection(
  q: Question,
  answer: string,
  order?: number,
): { choiceOrder?: number } | null {
  if (answerFormat(q) !== "select") return order === undefined ? {} : null;
  if (q.answerType === "select" && order === undefined && answer.trim()) return null;
  const options = [...(q.answers ?? [])].sort((a, b) => a.order - b.order);
  if (
    options.some((option) => !Number.isInteger(option.order) || option.order < 0) ||
    new Set(options.map((option) => option.order)).size !== options.length
  )
    return null;
  const normalize = (text: string | null | undefined) =>
    (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const matches =
    order === undefined
      ? ambiguousMediaPlaceholder(options, answer)
        ? []
        : options.filter(
            (option) => normalize(option.text) && normalize(option.text) === normalize(answer),
          )
      : options.filter((option) => option.order === order);
  if (matches.length !== 1)
    return order !== undefined || (q.answerType === "select" && answer.trim()) ? null : {};
  const selected = matches[0]!;
  if (
    order !== undefined &&
    normalize(answer) !== normalize(optionAnswer(selected.text, options.indexOf(selected), options))
  )
    return null;
  return { choiceOrder: selected.order };
}
