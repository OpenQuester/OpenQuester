import { type Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type PackageAnswerDTO } from "domain/types/dto/package/PackageAnswerDTO";
import { PackageFileType } from "domain/enums/package/PackageFileType";

const normalize = (text: string | null | undefined): string =>
  (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Resolve only identities that the current package actually identifies uniquely. */
export class ChoiceSelectionLogic {
  public static hasAmbiguousImagePlaceholder(
    options: PackageAnswerDTO[],
    answer: string | null
  ): boolean {
    const sorted = [...options].sort((a, b) => a.order - b.order);
    const normalizedAnswer = normalize(answer);
    return sorted.some((option, index) => {
      const imageOnly = option.file?.type === PackageFileType.IMAGE && !normalize(option.text);
      // "1" can mean the first image-only option or a text answer containing "1".
      const legacyPlaceholder = String(index + 1);
      return imageOnly && normalizedAnswer === legacyPlaceholder;
    });
  }

  /** Returns the unique selected option order, or null when it needs manual judging. */
  public static resolve(game: Game, answer: string | null, order?: number): number | null {
    const question = game.gameState.currentQuestion;
    const canSelectOption =
      question?.type === PackageQuestionType.CHOICE &&
      !game.gameState.allPlay &&
      game.gameState.currentRound?.type !== PackageRoundType.FINAL;

    if (!canSelectOption) {
      if (order !== undefined) {
        throw new ClientError(ClientResponse.INVALID_INPUT);
      }
      return null;
    }

    const options = question.answers ?? [];
    const selected = this.findSelectedOption(options, answer, order);
    if (!selected) {
      return null;
    }

    if (order !== undefined) {
      this.validateExplicitAnswer(options, selected, answer);
    }
    this.rejectPreviouslyWrongOption(game, selected.order);
    return selected.order;
  }

  /** A legacy text match is usable only if both its text and order are unique. */
  private static findSelectedOption(
    options: PackageAnswerDTO[],
    answer: string | null,
    order?: number
  ): PackageAnswerDTO | undefined {
    if (order === undefined && this.hasAmbiguousImagePlaceholder(options, answer)) {
      return undefined;
    }

    const normalizedAnswer = normalize(answer);
    const matches =
      order === undefined
        ? options.filter(
            (option) => normalizedAnswer && normalize(option.text) === normalizedAnswer
          )
        : options.filter((option) => option.order === order);
    if (order !== undefined && matches.length !== 1) {
      throw new ClientError(ClientResponse.INVALID_INPUT);
    }
    if (matches.length !== 1) {
      return undefined;
    }

    const selected = matches[0];
    return options.filter((option) => option.order === selected.order).length === 1
      ? selected
      : undefined;
  }

  /** Image-only options use their displayed position, prefixed when it conflicts with text. */
  private static validateExplicitAnswer(
    options: PackageAnswerDTO[],
    selected: PackageAnswerDTO,
    answer: string | null
  ): void {
    const sorted = [...options].sort((a, b) => a.order - b.order);
    const texts = new Set(options.map((option) => normalize(option.text)));
    let placeholder = String(sorted.indexOf(selected) + 1);
    while (texts.has(placeholder)) {
      placeholder = `#${placeholder}`;
    }
    if (normalize(answer) !== (normalize(selected.text) || normalize(placeholder))) {
      throw new ClientError(ClientResponse.INVALID_INPUT);
    }
  }

  private static rejectPreviouslyWrongOption(game: Game, order: number): void {
    const alreadyWrong = (game.gameState.answeredPlayers ?? []).some(
      (attempt) => attempt.answerType === AnswerResultType.WRONG && attempt.choiceOrder === order
    );
    if (alreadyWrong) {
      throw new ClientError(ClientResponse.ALREADY_ANSWERED_QUESTION);
    }
  }
}
