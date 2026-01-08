import { GameService } from "application/services/game/GameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
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
    private readonly gameService: GameService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {
    //
  }

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<QuestionSkipBroadcastData>> {
    const result = await this.socketIOQuestionService.handlePlayerSkip(
      createActionContextFromAction(action)
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
      const transitionResult = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.CONDITION_MET,
        triggeredBy: { isSystem: true },
      });

      if (!transitionResult) {
        throw new Error("All players skipped but transition was not allowed");
      }

      await this.gameService.updateGame(game);

      const broadcasts: SocketEventBroadcast[] = [
        ...result.broadcasts,
        ...transitionResult.broadcasts,
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
