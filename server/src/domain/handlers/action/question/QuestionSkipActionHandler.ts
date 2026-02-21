import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { PlayerSkipLogic } from "domain/logic/question/PlayerSkipLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { QuestionAction } from "domain/types/game/QuestionAction";
import {
  EmptyInputData,
  QuestionSkipBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { SpecialRegularQuestionUtils } from "domain/utils/QuestionUtils";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { DataMutationConverter } from "../../../types/action/DataMutation";

/**
 * Stateless action handler for player skipping question.
 *
 * Context-aware: receives prefetched game/player/timer from the executor's
 * IN pipeline. Three execution paths:
 * - Give-up (special question answering phase): applies penalty, clears timer,
 *   updates stats (2 RT — separate key namespace, unavoidable)
 * - All-players-skipped: marks skip then transitions via PhaseTransitionRouter
 *   (1-2 RT for timer ops in transition, unavoidable currently)
 * - Normal skip: pure mutation, all I/O in pipelines (0 RT in handler)
 */
export class QuestionSkipActionHandler
  implements GameActionHandler<EmptyInputData, QuestionSkipBroadcastData>
{
  constructor(
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly logger: ILogger
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<QuestionSkipBroadcastData>> {
    const { game, currentPlayer } = ctx;

    // Validate skip action (pure — checks role, question state, eligibility)
    QuestionActionValidator.validatePlayerSkipAction({
      game,
      currentPlayer,
      action: QuestionAction.PLAYER_SKIP,
    });

    // Check if this skip should be treated as a "give up" with penalty
    if (SpecialRegularQuestionUtils.isGiveUpScenario(game)) {
      return await this._executeGiveUp(ctx);
    }

    // Regular skip: mark player as skipped (pure mutation)
    PlayerSkipLogic.processRegularSkip(game, currentPlayer!);

    // Check if all players have skipped after this skip
    if (game.haveAllPlayersSkipped()) {
      return await this._executeAllSkipped(ctx);
    }

    // Normal skip — pure result, all I/O via executor pipelines
    const result = PlayerSkipLogic.buildRegularSkipResult({
      game,
      playerId: currentPlayer!.meta.id,
    });

    return {
      success: true,
      data: result.data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: game,
    };
  }

  /**
   * Give-up path: special question answering phase — applies penalty,
   * clears timer via mutation, updates stats (2 RT unavoidable).
   */
  private async _executeGiveUp(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<QuestionSkipBroadcastData>> {
    const { game, currentPlayer } = ctx;

    // Process give up: applies penalty, sets wrong answer state (pure mutation)
    const mutation = PlayerSkipLogic.processGiveUp(game, currentPlayer!);

    // Update statistics — 2 RT (getStats + updateStats on separate key namespace)
    // Non-critical: swallow errors to avoid failing the action
    try {
      await this.playerGameStatsService.updatePlayerAnswerStats(
        game.id,
        mutation.playerAnswerResult.player,
        AnswerResultType.WRONG,
        mutation.playerAnswerResult.score
      );
    } catch (error) {
      this.logger.warn("Failed to update player answer statistics on give up", {
        prefix: LogPrefix.SOCKET_QUESTION,
        gameId: game.id,
        playerId: mutation.playerAnswerResult.player,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Set question state to SHOWING_ANSWER (pure mutation)
    game.setQuestionState(QuestionState.SHOWING_ANSWER);

    // Build clear-timer mutation (deferred to OUT pipeline instead of direct Redis DEL)
    const clearTimerMutation =
      this.socketGameTimerService.buildClearTimerMutation(game.id);

    // Build result with ANSWER_RESULT broadcast
    const result = PlayerSkipLogic.buildGiveUpResult({
      game,
      playerId: currentPlayer!.meta.id,
      mutation,
      timer: null,
    });

    return {
      success: true,
      data: result.data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations([
          clearTimerMutation,
        ]),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: game,
    };
  }

  /**
   * All-players-skipped path: triggers phase transition via router.
   * Transition handlers still make their own timer Redis calls (1-2 RT).
   */
  private async _executeAllSkipped(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<QuestionSkipBroadcastData>> {
    const { game, currentPlayer } = ctx;

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.CONDITION_MET,
      triggeredBy: { isSystem: true },
    });

    if (!transitionResult) {
      throw new Error("All players skipped but transition was not allowed");
    }

    // Build skip broadcast + transition broadcasts
    const skipResult = PlayerSkipLogic.buildRegularSkipResult({
      game,
      playerId: currentPlayer!.meta.id,
    });

    return {
      success: true,
      data: skipResult.data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        ),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          skipResult.broadcasts
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
