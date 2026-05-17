import { timerKey } from "domain/constants/redisKeys";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
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
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalReviewingToGameFinishMutationData } from "domain/types/socket/transition/final";

/**
 * Handles transition from FINAL_REVIEWING → RESULTS (game finished).
 *
 * Trigger: All answers have been reviewed by showman.
 * Actions:
 * - Process round progression to finish game
 * - Emit GAME_FINISHED event
 * - Include final question/answer data
 */
export class FinalReviewingToGameFinishHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.FINAL_REVIEWING;
  public readonly toPhase = GamePhase.GAME_FINISHED;

  /**
   * Strict check for transition eligibility.
   *
   * Validates:
   * 1. Current phase must be FINAL_REVIEWING
   * 2. Game in progress + final round + correct question/phase state
   * 3. All answers must be reviewed
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Validate game state for final round reviewing
    if (
      !TransitionGuards.canTransitionInFinalRound(
        game,
        QuestionState.REVIEWING,
        FinalRoundPhase.REVIEWING
      )
    ) {
      return false;
    }

    // 3. All answers must be reviewed
    return FinalRoundStateManager.areAllAnswersReviewed(game);
  }

  /**
   * Mutate game state for game completion.
   */
  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    // Handle round progression (finishes the game)
    const roundHandler = RoundHandlerFactory.createFromGame(game);

    const nextRoundData = ctx.resources?.nextRound ?? null;

    const result = await roundHandler.handleRoundProgression(game, {
      forced: true,
      nextRound: nextRoundData
    });

    const questionAnswerData = ctx.resources?.finalQuestionAnswerData ?? null;

    return {
      data: {
        isGameFinished: result.isGameFinished,
        questionAnswerData: questionAnswerData ?? null
      } satisfies FinalReviewingToGameFinishMutationData
    };
  }

  /**
   * No timer setup needed - game is finished.
   */
  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    // Explicitly set timer to null in game state
    ctx.game.gameState.timer = null;

    return {
      timer: undefined,
      timerMutations: [{ op: "delete", key: timerKey(ctx.game.id) }]
    };
  }

  /**
   * Build broadcast events for game completion.
   */
  protected collectBroadcasts(
    ctx: TransitionContext,
    _mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    const { game } = ctx;

    return [
      {
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        room: game.id
      }
    ];
  }

}
