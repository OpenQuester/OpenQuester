import { GameService } from "application/services/game/GameService";
import { GAME_QUESTION_ANSWER_SUBMIT_TIME } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
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
import { ShowingToAnsweringMutationData } from "domain/types/socket/transition/showing";

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
    gameService: GameService
  ) {
    super(gameService);
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
    // Check of player already answered is done in service layer
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
    game.setQuestionState(QuestionState.ANSWERING);

    return {
      data: {
        playerId,
      } satisfies ShowingToAnsweringMutationData,
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    const timer = new GameStateTimer(GAME_QUESTION_ANSWER_SUBMIT_TIME);
    game.gameState.timer = timer.start();

    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: GAME_QUESTION_ANSWER_SUBMIT_TIME,
        },
      ],
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const mutationData = mutationResult.data as ShowingToAnsweringMutationData;
    const playerId = mutationData.playerId;

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
