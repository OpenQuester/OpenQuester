import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
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
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameNextRoundEventPayload>> {
    const { game, isGameFinished, nextGameState, questionData } =
      await this.socketIOGameService.handleNextRound(
        createActionContextFromAction(ctx.action)
      );

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
      mutations: [
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          progressionResult.broadcasts
        ),
      ],
      broadcastGame: game,
    };
  }
}
