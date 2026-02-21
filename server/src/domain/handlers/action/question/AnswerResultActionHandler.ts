import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { QuestionAnswerResultLogic } from "domain/logic/question/QuestionAnswerResultLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultData } from "domain/types/socket/game/AnswerResultData";
import {
  type AnsweringToShowingAnswerMutationData,
  type AnswerResultTransitionPayload,
} from "domain/types/socket/transition/answering";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Stateless action handler for answer result (showman marking answer).
 *
 * Context-aware: receives prefetched game/player/timer from the executor's
 * IN pipeline. Uses PhaseTransitionRouter for state transition (1-2 RT for
 * timer ops, unavoidable) and PlayerGameStatsService for stats (2 RT,
 * unavoidable, separate key namespace). All other I/O handled by pipelines.
 */
export class AnswerResultActionHandler
  implements
    GameActionHandler<AnswerResultData, QuestionAnswerResultEventPayload>
{
  constructor(
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly logger: ILogger
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<AnswerResultData>
  ): Promise<ActionHandlerResult<QuestionAnswerResultEventPayload>> {
    const { game, currentPlayer } = ctx;
    const data = ctx.action.payload;

    // Validate answer result action (pure — checks role, round, question state)
    QuestionActionValidator.validateAnswerResultAction({
      game,
      currentPlayer,
      action: QuestionAction.ANSWER_RESULT,
    });

    // Route state transition (ANSWERING → SHOWING or SHOWING_ANSWER)
    // Transition handlers make their own timer Redis calls (1-2 RT)
    const transitionResult =
      await this.phaseTransitionRouter.tryTransition<AnswerResultTransitionPayload>(
        {
          game,
          trigger: TransitionTrigger.USER_ACTION,
          triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
          payload: {
            answerType: data.answerType,
            scoreResult: data.scoreResult,
            questionType:
              game.gameState.currentQuestion?.type ??
              PackageQuestionType.SIMPLE,
          },
        }
      );

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const resultData = transitionResult.data as
      | AnsweringToShowingAnswerMutationData
      | undefined;

    const playerAnswerResult = resultData?.playerAnswerResult ?? null;

    // Update player stats (2 RT, separate key namespace, non-critical)
    if (playerAnswerResult) {
      try {
        await this.playerGameStatsService.updatePlayerAnswerStats(
          game.id,
          playerAnswerResult.player,
          data.answerType,
          playerAnswerResult.score
        );
      } catch (error) {
        this.logger.warn("Failed to update player answer statistics", {
          prefix: LogPrefix.SOCKET_QUESTION,
          gameId: game.id,
          playerId: playerAnswerResult.player,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const timerDto = transitionResult.timer;

    const responseData = QuestionAnswerResultLogic.buildSocketPayload({
      answerResult: playerAnswerResult!,
      timer: timerDto ?? null,
    });

    return {
      success: true,
      data: responseData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        ),
        ...DataMutationConverter.mutationFromServiceBroadcasts(
          transitionResult.broadcasts,
          game.id
        ),
      ],
      broadcastGame: game,
    };
  }
}
