import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { ChoiceSelectionLogic } from "domain/logic/question/ChoiceSelectionLogic";

const normalize = (text: string | null | undefined) =>
  (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/**
 * Checks a selected choice against its explicit correct order and optional
 * text aliases. Legacy questions use the main answer and aliases as text;
 * ambiguous or unrecognized selections remain for the showman to judge.
 */
export class ChoiceAnswerLogic {
  /** true/false when the server can rule, null when the showman should */
  public static check(
    question: PackageQuestionDTO | null | undefined,
    picked: string | null,
    choiceOrder: number | null = null,
    explicitSelection = false
  ): boolean | null {
    if (question?.type !== PackageQuestionType.CHOICE || !picked?.trim()) {
      return null;
    }

    const answers = question.answers ?? [];
    const options = answers.map((a) => normalize(a.text)).filter(Boolean);
    const pick = normalize(picked);
    if (!explicitSelection) {
      if (ChoiceSelectionLogic.hasAmbiguousImagePlaceholder(answers, picked)) {
        return null;
      }
    }

    if (question.correctChoiceOrder != null) {
      if (!Number.isInteger(question.correctChoiceOrder) || question.correctChoiceOrder < 0) {
        return null;
      }
      const correct = answers.filter((answer) => answer.order === question.correctChoiceOrder);
      const selected = answers.filter((answer) => answer.order === choiceOrder);
      if (correct.length !== 1 || selected.length !== 1) {
        return null;
      }
      const alias = normalize(selected[0].text);
      return (
        selected[0].order === question.correctChoiceOrder ||
        (!!alias && (question.rightAnswers ?? []).some((answer) => normalize(answer) === alias))
      );
    }

    if (
      explicitSelection &&
      !answers.find((answer) => answer.order === choiceOrder)?.text?.trim()
    ) {
      return null;
    }
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
