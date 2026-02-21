import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { AnswerSubmittedBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";

export interface AnswerSubmittedResult {
  data: AnswerSubmittedBroadcastData;
  broadcasts: SocketEventBroadcast[];
  game: Game;
}

export interface AnswerSubmittedBuildResultInput {
  game: Game;
  answerText: string | null;
}

/**
 * Logic class for handling answer submission processing.
 */
export class AnswerSubmittedLogic {
  public static validate(game: Game, currentPlayer: Player | null) {
    GameStateValidator.validateGameInProgress(game);

    if (game.gameState.answeringPlayer !== currentPlayer?.meta.id) {
      throw new ClientError(ClientResponse.CANNOT_SUBMIT_ANSWER);
    }
  }

  /**
   * Build the result for answer submitted with broadcasts.
   */
  public static buildResult(
    input: AnswerSubmittedBuildResultInput
  ): AnswerSubmittedResult {
    const { game, answerText } = input;

    const broadcastData: AnswerSubmittedBroadcastData = {
      answerText,
    };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.ANSWER_SUBMITTED,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<AnswerSubmittedBroadcastData>,
    ];

    return { data: broadcastData, broadcasts, game };
  }
}
