import { timerKey } from "domain/constants/redisKeys";
import { MEDIA_DOWNLOAD_TIMEOUT } from "domain/constants/game";
import { randomUUID } from "node:crypto";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionContext
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  FinalPhaseCompleteEventData,
  FinalQuestionEventData
} from "domain/types/socket/events/FinalRoundEventData";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundValidator } from "domain/validators/FinalRoundValidator";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { FinalBiddingToAnsweringMutationData } from "domain/types/socket/transition/final";
import { ClientError } from "domain/errors/ClientError";
import { ClientResponse } from "domain/enums/ClientResponse";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";

/**
 * Handles transition from FINAL_BIDDING to FINAL_ANSWERING phase.
 *
 * This transition occurs when all eligible players have submitted their bids
 * (either manually, automatically due to low score, or via timeout/leave).
 *
 * Entry points that can trigger this:
 * - User submits bid (FinalRoundService.handleFinalBidSubmit)
 * - Player leaves during bidding (FinalBiddingLeaveStrategy)
 * - Bidding timer expires (TimerExpirationService.handleBiddingExpiration)
 *
 * All three entry points now use this single handler through PhaseTransitionRouter.
 */
export class FinalBiddingToAnsweringHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.FINAL_BIDDING;
  public readonly toPhase = GamePhase.FINAL_ANSWERING;

  /**
   * Strict check for transition eligibility.
   *
   * Validates:
   * 1. Current phase must be FINAL_BIDDING (prevents re-triggering)
   * 2. Game in progress + final round + correct question/phase state
   * 3. All eligible bids must be submitted
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game } = ctx;

    // 1. Verify we're in the expected phase (defensive check)
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Validate game state for final round bidding
    if (
      !TransitionGuards.canTransitionInFinalRound(
        game,
        QuestionState.BIDDING,
        FinalRoundPhase.BIDDING
      )
    ) {
      return false;
    }

    // 3. All eligible players must have submitted bids
    return FinalRoundStateManager.areAllBidsSubmitted(game);
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
    FinalRoundValidator.validateBiddingPhase(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    // Transition to answering phase
    FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.ANSWERING);

    const originalQuestionData = ctx.resources?.finalRoundQuestionData ?? null;

    if (!originalQuestionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const question = originalQuestionData.question;
    const questionData =
      question.textItems == null
        ? originalQuestionData
        : {
            ...originalQuestionData,
            contentPlan: QuestionContentPlanLogic.build({
              text: question.text,
              textOrder: question.textOrder,
              textItems: question.textItems,
              files: question.questionFiles
            })
          };

    if (question.textItems != null && (question.questionFiles?.length ?? 0) > 0) {
      questionData.mediaPreparationId = randomUUID();
      MediaDownloadLogic.resetAllPlayerStatus(game);
      game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
    }

    // Store question data in game state so joining players can access it
    FinalRoundStateManager.setQuestionData(game, questionData);

    return {
      data: {
        questionData,
        fullQuestion: ctx.resources?.finalRoundFullQuestion ?? null
      } satisfies FinalBiddingToAnsweringMutationData
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    const durationMs =
      game.gameState.questionState === QuestionState.MEDIA_DOWNLOADING
        ? MEDIA_DOWNLOAD_TIMEOUT
        : game.settings.timers.finalAnswerMs +
          (game.gameState.finalRoundData?.questionData?.contentPlan?.totalMs ?? 0);
    const timer = new GameStateTimer(durationMs);
    game.gameState.timer = timer.start();

    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: durationMs
        }
      ]
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const broadcasts: BroadcastEvent[] = [];
    const mutationData = mutationResult.data as FinalBiddingToAnsweringMutationData;

    const { questionData, fullQuestion } = mutationData;

    // 1. Emit question data so players can see the question. With the full
    // question available, the showman's copy also carries the answer.
    broadcasts.push({
      event: SocketIOGameEvents.FINAL_QUESTION_DATA,
      data: {
        questionData: fullQuestion ? { ...questionData, question: fullQuestion } : questionData,
        ...(questionData.mediaPreparationId ? { timer: timerResult.timer } : {})
      } satisfies FinalQuestionEventData,
      room: ctx.game.id,
      roleFilter: Boolean(fullQuestion)
    });

    // 2. Emit phase complete event
    if (!questionData.mediaPreparationId)
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        data: {
          phase: FinalRoundPhase.BIDDING,
          nextPhase: FinalRoundPhase.ANSWERING,
          timer: timerResult.timer
        } satisfies FinalPhaseCompleteEventData,
        room: ctx.game.id
      });

    return broadcasts;
  }
}
