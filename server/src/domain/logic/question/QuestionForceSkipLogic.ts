import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";

import { BroadcastEvent } from "domain/types/service/ServiceResult";

export interface ForceSkipResult {
  game: Game;
  question: PackageQuestionDTO;
  broadcasts?: BroadcastEvent[];
}

export interface ForceSkipBuildResultInput {
  game: Game;
  question: PackageQuestionDTO;
  broadcasts?: BroadcastEvent[];
}

/**
 * Logic class for handling question force skip by showman.
 * Marks the current question as played and returns question data.
 */
export class QuestionForceSkipLogic {
  /**
   * Get the question to be skipped based on current game state.
   * Handles normal questions, stake questions, and secret questions.
   * @param game Game entity
   * @param questionData Pre-fetched question+theme data from PackageStore
   */
  public static getQuestionToSkip(
    game: Game,
    questionData: { question: PackageQuestionDTO; theme: PackageThemeDTO } | null
  ): {
    question: PackageQuestionDTO;
    themeId: number;
  } {
    if (!questionData?.question || !questionData.theme.id) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    return {
      question: questionData.question,
      themeId: questionData.theme.id,
    };
  }

  /**
   * Process the force skip: marks question as played.
   */
  public static processForceSkip(
    game: Game,
    question: PackageQuestionDTO,
    themeId: number
  ): void {
    GameQuestionMapper.setQuestionPlayed(game, question.id!, themeId);
  }

  /**
   * Build the result for force skip operation.
   */
  public static buildResult(input: ForceSkipBuildResultInput): ForceSkipResult {
    const { game, question, broadcasts } = input;

    return {
      game,
      question,
      broadcasts,
    };
  }
}
