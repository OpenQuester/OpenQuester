import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
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
    answer: string | null
  ): boolean | null {
    if (!question || !answer?.trim()) return null;

    if (question.type === PackageQuestionType.CHOICE) {
      return ChoiceAnswerLogic.check(question, answer);
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
    if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(cleaned)) return null;

    const value = Number(cleaned);

    return Number.isFinite(value) ? value : null;
  }

  /** "0.42,0.61" → { x: 0.42, y: 0.61 }; null when it isn't a point */
  public static parsePoint(text: string): { x: number; y: number } | null {
    const parts = text.split(/[,;\s]+/).filter(Boolean).map(Number);
    if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) {
      return null;
    }

    return { x: parts[0], y: parts[1] };
  }

  private static _checkNumber(question: PackageQuestionDTO, answer: string): boolean | null {
    const right = question.answerNumber;
    const value = this.parseNumber(answer);
    if (right === null || right === undefined || value === null) return null;

    return Math.abs(value - right) <= Math.max(0, question.answerDeviation ?? 0);
  }

  private static _checkPoint(question: PackageQuestionDTO, answer: string): boolean | null {
    const right = question.answerPoint;
    const point = this.parsePoint(answer);
    if (!right || !point) return null;

    const radius = question.answerDeviation ?? DEFAULT_POINT_DEVIATION;

    return Math.hypot(point.x - right.x, point.y - right.y) <= radius;
  }
}
