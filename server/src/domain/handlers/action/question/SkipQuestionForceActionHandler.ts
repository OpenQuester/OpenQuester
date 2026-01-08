import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import { QuestionAction } from "domain/types/game/QuestionAction";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ShowingToShowingAnswerPayload } from "domain/types/socket/transition/showing";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";

/**
 * Stateless action handler for force skipping a question (showman).
 */
export class SkipQuestionForceActionHandler
  implements GameActionHandler<EmptyInputData, EmptyOutputData>
{
  constructor(
    private readonly socketGameContextService: SocketGameContextService,
    private readonly gameService: GameService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {
    //
  }

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<EmptyOutputData>> {
    const ctx = createActionContextFromAction(action);
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    QuestionActionValidator.validateForceSkipAction({
      game,
      currentPlayer,
      action: QuestionAction.FORCE_SKIP,
    });

    const transitionResult =
      await this.phaseTransitionRouter.tryTransition<ShowingToShowingAnswerPayload>(
        {
          game,
          trigger: TransitionTrigger.USER_ACTION,
          triggeredBy: {
            playerId: currentPlayer?.meta.id,
            isSystem: false,
          },
          payload: {
            forceSkip: true,
          },
        }
      );

    if (!transitionResult) {
      throw new Error("Force skip transition not allowed in current state");
    }

    await this.gameService.updateGame(game);

    return {
      success: true,
      data: {},
      broadcasts:
        transitionResult.broadcasts as SocketEventBroadcast<unknown>[],
    };
  }
}
