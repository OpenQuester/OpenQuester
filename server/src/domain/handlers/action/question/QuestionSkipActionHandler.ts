import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  QuestionSkipBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player skipping question.
 */
export class QuestionSkipActionHandler
  implements GameActionHandler<EmptyInputData, QuestionSkipBroadcastData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<QuestionSkipBroadcastData>> {
    const result = await this.socketIOQuestionService.handlePlayerSkip(
      action.socketId
    );
    const { game } = result;

    // If player gave up (treated as wrong answer), use broadcasts from result
    if (result.gaveUp) {
      return {
        success: true,
        data: result.data,
        broadcasts: result.broadcasts,
      };
    }

    // Check if all players have skipped after this skip
    if (game.haveAllPlayersSkipped()) {
      const { question, game: updatedGame } =
        await this.socketIOQuestionService.handleAutomaticQuestionSkip(game);

      const { isGameFinished, nextGameState } =
        await this.socketIOQuestionService.handleRoundProgression(updatedGame);

      const progressionResult =
        await this.gameProgressionCoordinator.processGameProgression({
          game: updatedGame,
          isGameFinished,
          nextGameState,
          questionFinishData: question
            ? {
                answerFiles: question.answerFiles ?? null,
                answerText: question.answerText ?? null,
                nextTurnPlayerId:
                  updatedGame.gameState.currentTurnPlayerId ?? null,
              }
            : null,
        });

      // Combine skip broadcast with progression broadcasts
      const broadcasts: SocketEventBroadcast[] = [
        ...result.broadcasts,
        ...progressionResult.broadcasts,
      ];

      return { success: true, data: result.data, broadcasts };
    }

    // Normal skip - just use broadcasts from result
    return {
      success: true,
      data: result.data,
      broadcasts: result.broadcasts,
    };
  }
}
