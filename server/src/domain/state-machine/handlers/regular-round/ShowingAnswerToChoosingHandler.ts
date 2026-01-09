import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionContext,
  TransitionTrigger,
} from "domain/state-machine/types";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { AnswerShowEndEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { ShowingAnswerToChoosingMutationData } from "domain/types/socket/transition/showing";

/**
 * Handles transition from SHOWING_ANSWER to CHOOSING phase in regular rounds.
 *
 * This transition occurs when:
 * - Show answer timer expires
 * - Showman manually skips the answer display
 *
 * Entry points:
 * - Show answer timer expires (TimerExpirationService.handleShowAnswerExpiration)
 * - Showman skips answer display (SocketIOQuestionService.handleSkipShowAnswer)
 */
export class ShowingAnswerToChoosingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.SHOWING_ANSWER;
  public readonly toPhase = GamePhase.CHOOSING;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService,
    private readonly roundHandlerFactory: RoundHandlerFactory
  ) {
    super(gameService, timerService);
  }

  /**
   * Check if this transition should occur.
   *
   * Validates:
   * 1. Current phase must be SHOWING_ANSWER
   * 2. Game in progress with simple round
   * 3. Triggered by timer expiration or user action (showman skip)
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Must be simple round in SHOWING_ANSWER state
    if (
      !TransitionGuards.canTransitionInRegularRound(
        game,
        QuestionState.SHOWING_ANSWER
      )
    ) {
      return false;
    }

    // 3. Must be timer expiration or user action
    if (
      trigger !== TransitionTrigger.TIMER_EXPIRED &&
      trigger !== TransitionTrigger.USER_ACTION
    ) {
      return false;
    }

    const isRoundFinished = game.isAllQuestionsPlayed() ?? false;
    if (isRoundFinished) {
      const nextRound = game.getNextRound();

      // If no next round or next round is final, other handlers should process
      if (nextRound === null || nextRound.type === PackageRoundType.FINAL) {
        return false;
      }
    }

    return true;
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    // Check if all questions in round are played -> need round progression
    const isRoundFinished = game.isAllQuestionsPlayed() ?? false;
    let nextGameState: GameStateDTO | null = null;

    if (isRoundFinished) {
      const roundHandler = this.roundHandlerFactory.createFromGame(game);
      const progressionResult = await roundHandler.handleRoundProgression(game);

      nextGameState = progressionResult.nextGameState;
    }

    // Reset to choosing state only when continuing in the same round
    if (!isRoundFinished) {
      game.resetToChoosingState();
    }

    return {
      data: {
        isRoundFinished,
        isGameFinished: false,
        nextGameState,
      } satisfies ShowingAnswerToChoosingMutationData,
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    // Clear the show answer timer
    await this.gameService.clearTimer(ctx.game.id);

    // Explicitly set timer to null in game state
    ctx.game.gameState.timer = null;

    return { timer: undefined };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    const { game } = ctx;
    const broadcasts: BroadcastEvent[] = [];
    const mutationData =
      mutationResult.data as ShowingAnswerToChoosingMutationData;
    const nextGameState = mutationData.nextGameState;

    // 1. ANSWER_SHOW_END - signals end of answer display
    broadcasts.push({
      event: SocketIOGameEvents.ANSWER_SHOW_END,
      data: {} satisfies AnswerShowEndEventPayload,
      room: game.id,
    });

    // 2. NEXT_ROUND if round progression occurred
    if (nextGameState) {
      broadcasts.push({
        event: SocketIOGameEvents.NEXT_ROUND,
        data: {
          gameState: nextGameState,
        } satisfies GameNextRoundEventPayload,
        room: game.id,
      });
    }

    return broadcasts;
  }
}
