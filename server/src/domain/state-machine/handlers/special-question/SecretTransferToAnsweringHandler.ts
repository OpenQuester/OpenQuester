import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionTrigger,
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  SecretTransferToAnsweringCtx,
  SecretTransferToAnsweringMutationData,
} from "domain/types/socket/transition/special-question";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from SECRET_QUESTION_TRANSFER to ANSWERING phase.
 *
 * This transition occurs when:
 * - Showman or player selects a player to receive the secret question
 *
 * Entry points:
 * - Showman or player transfers question (SpecialQuestionService.handleSecretQuestionTransfer)
 */
export class SecretTransferToAnsweringHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.SECRET_QUESTION_TRANSFER;
  public readonly toPhase = GamePhase.ANSWERING;

  /**
   * Check if this transition should occur.
   *
   * Validates:
   * 1. Current phase must be SECRET_QUESTION_TRANSFER
   * 2. Must be user action with target player ID
   */
  public canTransition(ctx: SecretTransferToAnsweringCtx): boolean {
    const { game, trigger, payload } = ctx;

    if (!payload) {
      return false;
    }

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Must have secret transfer data
    if (!TransitionGuards.isSecretTransferPhase(game)) {
      return false;
    }

    // 3. Must be user action or system timeout with target player
    if (
      trigger !== TransitionTrigger.USER_ACTION &&
      trigger !== TransitionTrigger.TIMER_EXPIRED
    ) {
      return false;
    }

    // 4. Must have target player in payload
    const targetPlayerId = payload.targetPlayerId;

    if (!targetPlayerId) {
      return false;
    }

    // 5. Target player must be eligible
    return TransitionGuards.isPlayerEligible(game, targetPlayerId);
  }

  protected override validate(ctx: SecretTransferToAnsweringCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(
    ctx: SecretTransferToAnsweringCtx
  ): Promise<MutationResult> {
    const { game, payload } = ctx;
    const secretData = game.gameState.secretQuestionData!;
    const targetPlayerId = payload!.targetPlayerId;
    const fromPlayerId = secretData.pickerPlayerId;

    const questionData = ctx.resources?.simpleQuestion ?? null;
    if (questionData) {
      game.gameState.currentQuestion = questionData;
    }

    // Transition to answering state
    game.setQuestionState(QuestionState.ANSWERING);
    game.gameState.answeringPlayer = targetPlayerId;
    game.gameState.secretQuestionData = null;

    return {
      data: {
        fromPlayerId,
        targetPlayerId,
        questionId: secretData.questionId,
        questionData,
      } satisfies SecretTransferToAnsweringMutationData,
    };
  }

  protected async handleTimer(
    ctx: SecretTransferToAnsweringCtx,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    // Setup answering timer
    const timer = new GameStateTimer(GAME_QUESTION_ANSWER_TIME);
    game.gameState.timer = timer.start();

    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: GAME_QUESTION_ANSWER_TIME,
        },
      ],
    };
  }

  protected collectBroadcasts(
    _ctx: SecretTransferToAnsweringCtx,
    _mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    // Handled in afterBroadcast of socket handler for personalized emissions
    return [];
  }
}
