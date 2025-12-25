import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for advancing to next round.
 */
export class NextRoundActionHandler
  implements GameActionHandler<EmptyInputData, GameNextRoundEventPayload>
{
  constructor(
    private readonly socketIOGameService: SocketIOGameService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<GameNextRoundEventPayload>> {
    const { game, isGameFinished, nextGameState, questionData } =
      await this.socketIOGameService.handleNextRound(action.socketId);

    const progressionResult =
      await this.gameProgressionCoordinator.processGameProgression({
        game,
        isGameFinished,
        nextGameState,
        questionFinishData: questionData
          ? {
              answerFiles: questionData.answerFiles ?? null,
              answerText: questionData.answerText ?? null,
              nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
            }
          : null,
      });

    return {
      success: progressionResult.success,
      data: progressionResult.data as GameNextRoundEventPayload,
      broadcasts:
        progressionResult.broadcasts as SocketEventBroadcast<unknown>[],
    };
  }
}
