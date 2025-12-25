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
    const { game, playerId } = result;

    const broadcastData: QuestionSkipBroadcastData = { playerId };

    // If player gave up (treated as wrong answer), broadcast ANSWER_RESULT
    if (result.gaveUp) {
      const broadcasts: SocketEventBroadcast<unknown>[] = [
        {
          event: SocketIOGameEvents.ANSWER_RESULT,
          data: {
            answerResult: result.answerResult,
            timer: result.timer,
          },
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
      ];
      return { success: true, data: broadcastData, broadcasts };
    }

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

      const broadcasts: SocketEventBroadcast<unknown>[] = [
        {
          event: SocketIOGameEvents.QUESTION_SKIP,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
        ...(progressionResult.broadcasts as SocketEventBroadcast<unknown>[]),
      ];

      return { success: true, data: broadcastData, broadcasts };
    }

    // Normal skip
    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.QUESTION_SKIP,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      },
    ];

    return { success: true, data: broadcastData, broadcasts };
  }
}
