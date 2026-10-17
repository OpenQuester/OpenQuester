import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

const normalize = (text: string | null | undefined) =>
  (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/**
 * Checks a picked option of a choice question against its right answer, the
 * way SIGame checks "select" answers. The server only rules when the pick is
 * one of the options and at least one option is a right answer (the main
 * answer or one of `rightAnswers`); otherwise the showman judges as usual.
 */
export class ChoiceAnswerLogic {
  /** true/false when the server can rule, null when the showman should */
  public static check(
    question: PackageQuestionDTO | null | undefined,
    picked: string | null
  ): boolean | null {
    if (question?.type !== PackageQuestionType.CHOICE || !picked?.trim()) {
      return null;
    }

    const options = (question.answers ?? []).map((a) => normalize(a.text)).filter(Boolean);
    const pick = normalize(picked);
    // The main answer and any extra right answers, as far as they are options
    const rights = new Set(
      [question.answerText, ...(question.rightAnswers ?? [])]
        .map(normalize)
        .filter((r) => r && options.includes(r))
    );

    if (!options.includes(pick) || rights.size === 0) {
      return null;
    }

    return rights.has(pick);
  }
}
