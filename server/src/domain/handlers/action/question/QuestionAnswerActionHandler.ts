import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GAME_QUESTION_ANSWER_SUBMIT_TIME } from "domain/constants/game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { QuestionAnswerRequestLogic } from "domain/logic/question/QuestionAnswerRequestLogic";
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
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player answering a question (buzzer press).
 *
 * Context-aware: receives prefetched game/player/timer from the executor's
 * IN pipeline. Saves elapsed timer via mutation, delegates state transition
 * to PhaseTransitionRouter (which still makes its own timer Redis calls),
 * and returns game-dirty flag for the OUT pipeline.
 *
 * Redis calls in context path:
 * - PhaseTransitionRouter.tryTransition() → clearTimer + setupQuestionTimer (~1-2 RT)
 * - All other I/O handled by executor pipelines
 */
export class QuestionAnswerActionHandler
  implements GameActionHandler<EmptyInputData, QuestionAnswerEventPayload>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly socketGameTimerService: SocketGameTimerService
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<QuestionAnswerEventPayload>> {
    const { game, currentPlayer } = ctx;

    // Pure validation
    QuestionAnswerRequestLogic.validate(game, currentPlayer);

    // Build save-elapsed-timer mutation (deferred to OUT pipeline)
    const timerMutations: DataMutation[] = [];

    if (game.gameState.timer) {
      const saveMutation =
        this.socketGameTimerService.buildSaveElapsedTimerMutation(
          game,
          GAME_QUESTION_ANSWER_SUBMIT_TIME,
          QuestionState.SHOWING
        );
      timerMutations.push(
        ...DataMutationConverter.mutationFromTimerMutations([saveMutation])
      );
    }

    // Execute state transition (SHOWING → ANSWERING)
    // Note: transition handlers still make their own Redis calls for timer management
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
    });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const timerDto = transitionResult.timer;
    const timer = timerDto ? GameStateTimer.fromDTO(timerDto) : null;

    if (!timer) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    // Build result with broadcasts
    const result = QuestionAnswerRequestLogic.buildResult({
      game,
      playerId: currentPlayer?.meta.id,
      timer,
    });

    const responseData: QuestionAnswerEventPayload = {
      userId: result.data.userId!,
      timer: timer.value()!,
    };

    return {
      success: true,
      data: responseData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...timerMutations,
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        ),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: game,
    };
  }
}
