import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  type DataMutation,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for skipping the show-answer phase.
 * Only the showman can skip this phase to speed up gameplay.
 */
export class SkipShowAnswerActionHandler
  implements GameActionHandler<EmptyInputData, EmptyOutputData>
{
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<EmptyOutputData>> {
    const { game, currentPlayer } = ctx;

    if (currentPlayer?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_SKIP_SHOW_ANSWER);
    }

    if (game.gameState.questionState !== QuestionState.SHOWING_ANSWER) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: currentPlayer.meta.id, isSystem: false },
    });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const mutations: DataMutation[] = [
      DataMutationConverter.saveGameMutation(game),
      ...DataMutationConverter.mutationFromTimerMutations(
        transitionResult.timerMutations
      ),
      ...DataMutationConverter.mutationFromServiceBroadcasts(
        transitionResult.broadcasts,
        game.id
      ),
    ];

    if (game.finishedAt) {
      mutations.push(DataMutationConverter.gameCompletionMutation(game.id));
    }

    return {
      success: true,
      data: {},
      mutations,
    };
  }
}
