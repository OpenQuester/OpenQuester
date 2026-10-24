import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { AnswerResultUseCase } from "application/usecases/question/AnswerResultUseCase";
import { PlayerSkipLogic } from "domain/logic/question/PlayerSkipLogic";
import { QuestionValueLogic } from "domain/logic/question/QuestionValueLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionAction } from "domain/types/game/QuestionAction";
import {
  EmptyInputData,
  QuestionSkipBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { SpecialRegularQuestionUtils } from "domain/utils/QuestionUtils";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";

/**
 * Handles player skipping a question.
 *
 * Context-aware: receives prefetched game/player/timer from the executor's
 * IN pipeline. Three execution paths:
 * - Give-up: uses the standard wrong-answer ruling and answer reveal
 * - All-players-skipped: marks skip then transitions via PhaseTransitionRouter
 *   (1-2 RT for timer ops in transition, unavoidable currently)
 * - Normal skip: pure mutation, all I/O in pipelines (0 RT in handler)
 */
export class QuestionSkipUseCase implements GameActionHandler<
  EmptyInputData,
  QuestionSkipBroadcastData
> {
  constructor(
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly transitionResourceService: TransitionResourceService,
    private readonly answerResultUseCase: AnswerResultUseCase
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
      action: QuestionAction.PLAYER_SKIP
    });

    // Check if this skip should be treated as a "give up" with penalty
    if (SpecialRegularQuestionUtils.isGiveUpScenario(game)) {
      const result = await this.answerResultUseCase.judge(game, currentPlayer!.meta.id, {
        scoreResult: -QuestionValueLogic.effectiveValue(game),
        answerType: AnswerResultType.WRONG
      });
      return { ...result, data: { playerId: currentPlayer!.meta.id } };
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
      playerId: currentPlayer!.meta.id
    });

    return {
      success: true,
      data: result.data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(result.broadcasts)
      ],
      broadcastGame: game
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
      resources: await this.transitionResourceService.getCurrentQuestionWithTheme(game)
    });

    if (!transitionResult) {
      throw new Error("All players skipped but transition was not allowed");
    }

    // Build skip broadcast + transition broadcasts
    const skipResult = PlayerSkipLogic.buildRegularSkipResult({
      game,
      playerId: currentPlayer!.meta.id
    });

    return {
      success: true,
      data: skipResult.data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations(transitionResult.timerMutations),
        ...DataMutationConverter.mutationFromSocketBroadcasts(skipResult.broadcasts),
        ...DataMutationConverter.mutationFromServiceBroadcasts(transitionResult.broadcasts, game.id)
      ],
      broadcastGame: game
    };
  }
}
