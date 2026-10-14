import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

const normalize = (text: string | null | undefined) =>
  (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/**
 * Checks a picked option of a choice question against its right answer, the
 * way SIGame checks "select" answers. The server only rules when the pick is
 * one of the options and exactly one option is the right answer; otherwise
 * the showman judges as usual.
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
    const right = normalize(question.answerText);

    if (!options.includes(pick) || !right) {
      return null;
    }

    if (options.filter((o) => o === right).length !== 1) {
      return null;
    }

    return pick === right;
  }
}
