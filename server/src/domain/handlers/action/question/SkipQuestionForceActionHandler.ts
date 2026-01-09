import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for force skipping a question (showman).
 */
export class SkipQuestionForceActionHandler
  implements GameActionHandler<EmptyInputData, EmptyOutputData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {
    //
  }

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<EmptyOutputData>> {
    const actionCtx = createActionContextFromAction(action);

    // Core force-skip logic in service layer (validates + updates state)
    const { game, question } =
      await this.socketIOQuestionService.handleQuestionForceSkip(actionCtx);

    // Progress round/game after question skipped
    const { isGameFinished, nextGameState } =
      await this.socketIOQuestionService.handleRoundProgression(game);

    // Build broadcasts (question finish + next round / game finished)
    const progressionResult =
      await this.gameProgressionCoordinator.processGameProgression({
        game,
        isGameFinished,
        nextGameState,
        questionFinishData: {
          answerFiles: question?.answerFiles ?? null,
          answerText: question?.answerText ?? null,
          nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
        },
      });

    return {
      success: progressionResult.success,
      data: {},
      broadcasts: progressionResult.broadcasts,
    };
  }
}
