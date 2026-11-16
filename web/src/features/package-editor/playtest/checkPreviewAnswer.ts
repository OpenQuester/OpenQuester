import { answerFormat } from "@/game/answerFormat";
import type { Question } from "@/game/protocol";
import { parsePointAnswer } from "@/game/pointAnswer";
import { ambiguousMediaPlaceholder } from "@/features/game/play/question/optionAnswer";
import { pointAnswerRadius } from "@/lib/pointGeometry";

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Mirrors AnswerCheckLogic; null means that the showman must judge. */
export function checkPreviewAnswer(
  q: Question,
  answer: string,
  choiceOrder: number | null = null,
  explicitSelection = false,
): boolean | null {
  if (!answer.trim()) return null;
  if (answerFormat(q) === "select") {
    const answers = q.answers ?? [];
    if (!explicitSelection && ambiguousMediaPlaceholder(answers, answer)) return null;
    if (q.correctChoiceOrder != null) {
      if (!Number.isInteger(q.correctChoiceOrder) || q.correctChoiceOrder < 0) return null;
      const correct = answers.filter((option) => option.order === q.correctChoiceOrder);
      const selected = answers.filter((option) => option.order === choiceOrder);
      if (correct.length !== 1 || selected.length !== 1) return null;
      if (q.answerType === "select") return selected[0]!.order === q.correctChoiceOrder;
      const alias = normalize(selected[0]!.text);
      return (
        selected[0]!.order === q.correctChoiceOrder ||
        (!!alias && (q.rightAnswers ?? []).some((item) => normalize(item) === alias))
      );
    }
    if (explicitSelection && !answers.find((option) => option.order === choiceOrder)?.text?.trim())
      return null;
    const options = (q.answers ?? []).map((option) => normalize(option.text)).filter(Boolean);
    const rights = [q.answerText, ...(q.rightAnswers ?? [])]
      .map(normalize)
      .filter((v) => v && options.includes(v));
    const picked = normalize(answer);
    return options.includes(picked) && rights.length ? rights.includes(picked) : null;
  }
  if (q.answerType === "number") {
    const clean = answer.trim().replace(/\s/g, "").replace(",", ".");
    if (
      !/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(clean) ||
      !Number.isFinite(Number(clean)) ||
      q.answerNumber == null
    )
      return null;
    return Math.abs(Number(clean) - q.answerNumber) <= Math.max(0, q.answerDeviation ?? 0);
  }
  if (q.answerType === "point") {
    const picked = parsePointAnswer(answer);
    if (!picked || !q.answerPoint) return null;
    const { x, y, imageAspectRatio, sourceGeometry } = q.answerPoint;
    const radius = pointAnswerRadius(q.answerPoint, q.answerDeviation);
    if (sourceGeometry) {
      if (
        sourceGeometry.kind !== "sigame" ||
        !Number.isFinite(sourceGeometry.aspectRatio) ||
        sourceGeometry.aspectRatio <= 0
      )
        return null;
      return Math.hypot((picked.x - x) * sourceGeometry.aspectRatio, picked.y - y) <= radius;
    }
    if (imageAspectRatio == null || !Number.isFinite(imageAspectRatio) || imageAspectRatio <= 0)
      return null;
    if (radius === 0)
      return picked.x.toFixed(3) === x.toFixed(3) && picked.y.toFixed(3) === y.toFixed(3);
    return (
      Math.hypot(picked.x - x, (picked.y - y) / imageAspectRatio) <=
      radius + Number.EPSILON * 8 * Math.max(1, radius)
    );
  }
  return null;
}
