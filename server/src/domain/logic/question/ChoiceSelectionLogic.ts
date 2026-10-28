import { type Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type PackageAnswerDTO } from "domain/types/dto/package/PackageAnswerDTO";
import { PackageFileType } from "domain/enums/package/PackageFileType";

const normalize = (text: string | null | undefined) =>
  (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Resolve only identities that the current package actually identifies uniquely. */
export class ChoiceSelectionLogic {
  public static hasAmbiguousImagePlaceholder(
    options: PackageAnswerDTO[],
    answer: string | null
  ): boolean {
    const sorted = [...options].sort((a, b) => a.order - b.order);
    return sorted.some(
      (option, index) =>
        option.file?.type === PackageFileType.IMAGE &&
        !normalize(option.text) &&
        normalize(answer) === String(index + 1)
    );
  }

  public static resolve(game: Game, answer: string | null, order?: number): number | null {
    const question = game.gameState.currentQuestion;
    if (
      question?.type !== PackageQuestionType.CHOICE ||
      game.gameState.allPlay ||
      game.gameState.currentRound?.type === PackageRoundType.FINAL
    ) {
      if (order !== undefined) {
        throw new ClientError(ClientResponse.INVALID_INPUT);
      }
      return null;
    }

    const options = question.answers ?? [];
    if (order === undefined && this.hasAmbiguousImagePlaceholder(options, answer)) {
      return null;
    }
    const selected =
      order === undefined
        ? options.filter(
            (option) => normalize(answer) && normalize(option.text) === normalize(answer)
          )
        : options.filter((option) => option.order === order);
    if (order !== undefined && selected.length !== 1) {
      throw new ClientError(ClientResponse.INVALID_INPUT);
    }

    if (
      selected.length !== 1 ||
      options.filter((option) => option.order === selected[0].order).length !== 1
    ) {
      return null;
    }

    const option = selected[0];
    if (order !== undefined) {
      const sorted = [...options].sort((a, b) => a.order - b.order);
      const texts = new Set(options.map((item) => normalize(item.text)));
      let expected = String(sorted.indexOf(option) + 1);
      while (texts.has(expected)) {
        expected = `#${expected}`;
      }
      if (normalize(answer) !== (normalize(option.text) || normalize(expected))) {
        throw new ClientError(ClientResponse.INVALID_INPUT);
      }
    }
    if (
      (game.gameState.answeredPlayers ?? []).some(
        (attempt) =>
          attempt.answerType === AnswerResultType.WRONG && attempt.choiceOrder === option.order
      )
    ) {
      throw new ClientError(ClientResponse.ALREADY_ANSWERED_QUESTION);
    }

    return option.order;
  }
}
