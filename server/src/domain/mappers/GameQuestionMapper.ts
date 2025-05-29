import { Game } from "domain/entities/game/Game";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { PackageDTO } from "../types/dto/package/PackageDTO";

export class GameQuestionMapper {
  /**
   * Retrieve DTO of question by package data, round and questionId (from DB)
   * @param pack package DTO
   * @param roundOrder order of round in theme
   * @param questionId question id from DB
   */
  public static getQuestionAndTheme(
    pack: PackageDTO,
    roundId: number,
    questionId: number
  ) {
    const round = pack.rounds.find((round) => round.id === roundId);
    if (!round?.themes?.length) {
      return null;
    }

    for (const theme of round.themes) {
      const question = theme.questions.find((q) => q.id === questionId);
      if (question) {
        return { question, theme };
      }
    }

    return null;
  }

  public static mapToSimpleQuestion(
    question: PackageQuestionDTO
  ): SimplePackageQuestionDTO {
    return {
      id: question.id,
      answerDelay: question.answerDelay,
      isHidden: question.isHidden,
      order: question.order,
      price: question.price,
      subType: question.subType,
      type: question.type,
      allowedPrices: question.allowedPrices,
      answers: question.answers,
      maxPrice: question.maxPrice,
      priceMultiplier: question.priceMultiplier,
      questionComment: question.questionComment,
      questionFiles: question.questionFiles,
      showDelay: question.showDelay,
      text: question.text,
      transferType: question.transferType,
    };
  }

  public static setQuestionPlayed(
    game: Game,
    questionID: number,
    themeId: number
  ) {
    const question = this._getQuestionFromCurrentRound(
      game,
      questionID,
      themeId
    );

    if (!question) {
      return;
    }

    question.isPlayed = true;
  }

  public static isQuestionPlayed(
    game: Game,
    questionID: number,
    themeId: number
  ) {
    const question = this._getQuestionFromCurrentRound(
      game,
      questionID,
      themeId
    );

    return question ? question.isPlayed : undefined;
  }

  public static getPlayedAndAllQuestions(gameState: GameStateDTO) {
    const played = [];
    const all = [];

    if (!gameState.currentRound) {
      return { played: [], all: [] };
    }

    for (const theme of gameState.currentRound.themes) {
      for (const question of theme.questions) {
        all.push(question);
        if (question.isPlayed) played.push(question);
      }
    }

    return { played, all };
  }

  private static _getQuestionFromCurrentRound(
    game: Game,
    questionID: number,
    themeId: number
  ) {
    const currentRound = game.gameState.currentRound;

    if (!currentRound) {
      return;
    }

    const theme = currentRound.themes.find((theme) => theme.id === themeId);

    if (!theme) {
      return;
    }

    const question = theme.questions.find(
      (question) => question.id === questionID
    );

    return question;
  }
}
