import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

export interface ForceSkipResult {
  game: Game;
  question: PackageQuestionDTO;
}

export interface ForceSkipBuildResultInput {
  game: Game;
  question: PackageQuestionDTO;
}

/**
 * Logic class for handling question force skip by showman.
 * Marks the current question as played and returns question data.
 */
export class QuestionForceSkipLogic {
  /**
   * Get the question to be skipped based on current game state.
   * Handles normal questions, stake questions, and secret questions.
   */
  public static getQuestionToSkip(game: Game): {
    question: PackageQuestionDTO;
    themeId: number;
  } {
    const gameState = game.gameState;
    let questionData;

    if (gameState.currentQuestion) {
      // Normal question flow
      questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        gameState.currentRound!.id,
        gameState.currentQuestion.id!
      );
    } else if (gameState.stakeQuestionData) {
      // Stake question flow
      questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        gameState.currentRound!.id,
        gameState.stakeQuestionData.questionId
      );
    } else if (gameState.secretQuestionData) {
      // Secret question flow
      questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        gameState.currentRound!.id,
        gameState.secretQuestionData.questionId
      );
    }

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
    const { game, question } = input;

    return {
      game,
      question,
    };
  }
}
