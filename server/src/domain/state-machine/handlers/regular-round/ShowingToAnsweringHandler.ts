import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { GAME_QUESTION_ANSWER_SUBMIT_TIME } from "domain/constants/game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
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
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from SHOWING to ANSWERING phase in regular rounds.
 *
 * This transition occurs when a player buzzes to answer a question.
 *
 * Entry points:
 * - Player buzzes (SocketIOQuestionService.handleQuestionAnswer)
 */
export class ShowingToAnsweringHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.SHOWING;
  public readonly toPhase = GamePhase.ANSWERING;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService
  ) {
    super(gameService, timerService);
  }

  /**
   * Check if this transition should occur.
   *
   * Validates:
   * 1. Current phase must be SHOWING
   * 2. Game in progress with question in SHOWING state
   * 3. Must be triggered by user action with a player ID
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger, triggeredBy } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Must be in SHOWING state (any round type)
    if (
      !TransitionGuards.canTransitionInAnyRound(game, QuestionState.SHOWING)
    ) {
      return false;
    }

    // 3. Must be user action with valid player
    if (trigger !== TransitionTrigger.USER_ACTION || !triggeredBy.playerId) {
      return false;
    }

    // 4. Player must be eligible to answer
    return TransitionGuards.isPlayerEligible(game, triggeredBy.playerId);
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game, triggeredBy } = ctx;
    const playerId = triggeredBy.playerId!;

    // Set answering player and transition state
    game.gameState.answeringPlayer = playerId;
    game.gameState.questionState = QuestionState.ANSWERING;

    return {
      data: {
        playerId,
      },
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    // Clear any existing showing timer
    await this.gameService.clearTimer(game.id);

    // Setup answering timer WITHOUT saving game (caller is responsible for persistence)
    const timer = new GameStateTimer(GAME_QUESTION_ANSWER_SUBMIT_TIME);
    game.gameState.timer = timer.start();

    // Save timer to Redis for expiration tracking
    await this.gameService.saveTimer(timer.value()!, game.id);

    return {
      timer: timer.value() ?? undefined,
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const playerId = mutationResult.data?.playerId as number;

    return [
      {
        event: SocketIOGameEvents.QUESTION_ANSWER,
        data: {
          userId: playerId,
          timer: timerResult.timer!,
        } satisfies QuestionAnswerEventPayload,
        room: ctx.game.id,
      },
    ];
  }
}
