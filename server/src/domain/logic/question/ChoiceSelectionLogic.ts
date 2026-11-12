import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { AnswerType } from "domain/enums/package/AnswerType";
import { answerFormat } from "domain/logic/question/answerFormat";
import { type Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type PackageAnswerDTO } from "domain/types/dto/package/PackageAnswerDTO";

const normalize = (text: string | null | undefined): string =>
  (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Resolve only identities that the current package actually identifies uniquely. */
export class ChoiceSelectionLogic {
  public static hasAmbiguousMediaPlaceholder(
    options: PackageAnswerDTO[],
    answer: string | null
  ): boolean {
    const sorted = [...options].sort((a, b) => a.order - b.order);
    const normalizedAnswer = normalize(answer);
    return sorted.some((option, index) => {
      const mediaOnly = !!option.file && !normalize(option.text);
      // "1" can mean the first media-only option or a text answer containing "1".
      const legacyPlaceholder = String(index + 1);
      return mediaOnly && normalizedAnswer === legacyPlaceholder;
    });
  }

  /** Returns the unique selected option order, or null when it needs manual judging. */
  public static resolve(game: Game, answer: string | null, order?: number): number | null {
    const final = game.gameState.currentRound?.type === PackageRoundType.FINAL;
    const question = final
      ? game.gameState.finalRoundData?.questionData?.question
      : game.gameState.currentQuestion;
    const canSelectOption = answerFormat(question) === AnswerType.SELECT;

    if (!canSelectOption) {
      if (order !== undefined) {
        throw new ClientError(ClientResponse.INVALID_INPUT);
      }
      return null;
    }

    if (
      !final &&
      QuestionContentPlanLogic.selectionWaitsForPresentation(game) &&
      !QuestionContentPlanLogic.isPresentationComplete(game)
    ) {
      throw new ClientError(ClientResponse.CANNOT_SUBMIT_ANSWER);
    }
    if (question?.answerType === AnswerType.SELECT && order === undefined && answer?.trim()) {
      throw new ClientError(ClientResponse.INVALID_INPUT);
    }
    const options = question?.answers ?? [];
    if (order !== undefined && (!Number.isInteger(order) || order < 0)) {
      throw new ClientError(ClientResponse.INVALID_INPUT);
    }
    if (
      new Set(options.map((option) => option.order)).size !== options.length ||
      options.some((option) => !Number.isInteger(option.order) || option.order < 0)
    ) {
      throw new ClientError(ClientResponse.INVALID_INPUT);
    }
    const selected = this.findSelectedOption(options, answer, order);
    if (!selected) {
      return null;
    }

    if (order !== undefined && !this.matchesDisplayAnswer(options, selected, answer)) {
      throw new ClientError(ClientResponse.INVALID_INPUT);
    }
    if (!game.gameState.allPlay && !final) {
      this.rejectPreviouslyWrongOption(game, selected.order);
    }
    return selected.order;
  }

  /** The caller already checked that option orders are unique. */
  private static findSelectedOption(
    options: PackageAnswerDTO[],
    answer: string | null,
    order?: number
  ): PackageAnswerDTO | undefined {
    if (order === undefined && this.hasAmbiguousMediaPlaceholder(options, answer)) {
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
    return matches.length === 1 ? matches[0] : undefined;
  }

  /** Media-only options use their displayed position, prefixed when it conflicts with text. */
  public static matchesDisplayAnswer(
    options: readonly PackageAnswerDTO[],
    selected: PackageAnswerDTO,
    answer: string | null
  ): boolean {
    const text = normalize(selected.text);
    if (text) {
      return normalize(answer) === text;
    }

    const sorted = [...options].sort((a, b) => a.order - b.order);
    const texts = new Set(options.map((option) => normalize(option.text)));
    let placeholder = String(sorted.indexOf(selected) + 1);
    while (texts.has(placeholder)) {
      placeholder = `#${placeholder}`;
    }
    return normalize(answer) === placeholder;
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
