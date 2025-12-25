import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";

export interface AnswerRequestResult {
  userId: number | undefined;
  gameId: string;
  timer: GameStateTimer;
}

export interface AnswerRequestBuildResultInput {
  game: Game;
  playerId: number | undefined;
  timer: GameStateTimer;
}

/**
 * Logic class for handling player answer request processing.
 * Extracts business logic from SocketIOQuestionService.handleQuestionAnswer.
 */
export class QuestionAnswerRequestLogic {
  public static validate(game: Game, currentPlayer: Player | null) {
    QuestionActionValidator.validateAnswerAction({
      game,
      currentPlayer,
      action: QuestionAction.ANSWER,
    });
  }
  /**
   * Build the result for answer request.
   */
  public static buildResult(
    input: AnswerRequestBuildResultInput
  ): AnswerRequestResult {
    const { game, playerId, timer } = input;

    return {
      userId: playerId,
      gameId: game.id,
      timer,
    };
  }
}
