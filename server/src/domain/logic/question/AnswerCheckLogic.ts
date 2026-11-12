import { answerFormat } from "domain/logic/question/answerFormat";
import { AnswerType } from "domain/enums/package/AnswerType";
import { ChoiceAnswerLogic } from "domain/logic/question/ChoiceAnswerLogic";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

/** Point answers within 5% of the picture's width count as right by default */
export const DEFAULT_POINT_DEVIATION = 0.05;

/**
 * Checks answers the server can judge on its own (SIGame "select", "number"
 * and "point" answer types). Returns null when the showman should judge.
 */
export class AnswerCheckLogic {
  public static check(
    question: PackageQuestionDTO | null | undefined,
    answer: string | null,
    choiceOrder: number | null = null
  ): boolean | null {
    if (!question || !answer?.trim()) {
      return null;
    }

    if (answerFormat(question) === AnswerType.SELECT) {
      return ChoiceAnswerLogic.check(question, answer, choiceOrder, choiceOrder !== null);
    }

    switch (question.answerType) {
      case AnswerType.NUMBER:
        return this._checkNumber(question, answer);
      case AnswerType.POINT:
        return this._checkPoint(question, answer);
      default:
        return null;
    }
  }

  /** "1 234,5" → 1234.5; null when it isn't a number */
  public static parseNumber(text: string): number | null {
    const cleaned = text.trim().replace(/[\s ]/g, "").replace(",", ".");
    if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(cleaned)) {
      return null;
    }

    const value = Number(cleaned);

    return Number.isFinite(value) ? value : null;
  }

  /** "0.42,0.61" → { x: 0.42, y: 0.61 }; null when it isn't a point */
  public static parsePoint(text: string): { x: number; y: number } | null {
    const parts = text
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) {
      return null;
    }

    return { x: parts[0], y: parts[1] };
  }

  private static _checkNumber(question: PackageQuestionDTO, answer: string): boolean | null {
    const right = question.answerNumber;
    const value = this.parseNumber(answer);
    if (right === null || right === undefined || value === null) {
      return null;
    }

    return Math.abs(value - right) <= Math.max(0, question.answerDeviation ?? 0);
  }

  private static _checkPoint(question: PackageQuestionDTO, answer: string): boolean | null {
    const right = question.answerPoint;
    const point = this.parsePoint(answer);
    if (!right || !point) {
      return null;
    }

    if (right.sourceGeometry) {
      const { kind, aspectRatio } = right.sourceGeometry;
      if (kind !== "sigame" || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
        return null;
      }
      const radius = Math.max(0.02, question.answerDeviation ?? 0);
      return Math.hypot((point.x - right.x) * aspectRatio, point.y - right.y) <= radius;
    }

    const radius = question.answerDeviation ?? DEFAULT_POINT_DEVIATION;
    const aspect = right.imageAspectRatio;
    if (aspect === undefined) return Math.hypot(point.x - right.x, point.y - right.y) <= radius;
    if (!Number.isFinite(aspect) || aspect <= 0) return null;
    if (radius === 0) {
      // The web point protocol serializes each normalized coordinate to three decimals.
      return point.x.toFixed(3) === right.x.toFixed(3) && point.y.toFixed(3) === right.y.toFixed(3);
    }
    const distance = Math.hypot(point.x - right.x, (point.y - right.y) / aspect);
    // The client sends decimal coordinates; permit only floating-point rounding at the edge.
    return distance <= radius + Number.EPSILON * 8 * Math.max(1, radius);
  }
}
