import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";

export interface AnswerRequestData {
  userId: number | undefined;
  gameId: string;
  timer: GameStateTimer;
}

export interface AnswerRequestResult {
  data: AnswerRequestData;
  broadcasts: SocketEventBroadcast[];
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
   * Build the result for answer request with broadcasts.
   */
  public static buildResult(
    input: AnswerRequestBuildResultInput
  ): AnswerRequestResult {
    const { game, playerId, timer } = input;

    const broadcastData: QuestionAnswerEventPayload = {
      userId: playerId!,
      timer: timer.value()!,
    };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.QUESTION_ANSWER,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<QuestionAnswerEventPayload>,
    ];

    return {
      data: { userId: playerId, gameId: game.id, timer },
      broadcasts,
    };
  }
}
