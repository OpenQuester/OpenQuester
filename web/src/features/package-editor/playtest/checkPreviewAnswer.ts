import type { Question } from "@/game/protocol";

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Mirrors AnswerCheckLogic; null means that the showman must judge. */
export function checkPreviewAnswer(q: Question, answer: string): boolean | null {
  if (!answer.trim()) return null;
  if (q.type === "choice") {
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
    const values = answer
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map(Number);
    if (
      values.length !== 2 ||
      values.some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
      !q.answerPoint
    )
      return null;
    const { x, y, imageAspectRatio } = q.answerPoint;
    if (imageAspectRatio == null || !Number.isFinite(imageAspectRatio) || imageAspectRatio <= 0)
      return null;
    const radius = q.answerDeviation ?? 0.05;
    if (radius === 0)
      return values[0]!.toFixed(3) === x.toFixed(3) && values[1]!.toFixed(3) === y.toFixed(3);
    return (
      Math.hypot(values[0]! - x, (values[1]! - y) / imageAspectRatio) <=
      radius + Number.EPSILON * 8 * Math.max(1, radius)
    );
  }
  return null;
}
