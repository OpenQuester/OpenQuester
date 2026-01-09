import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
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
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
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

    // Get question data
    let questionData: SimplePackageQuestionDTO | null = null;
    const questionResult = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
      secretData.questionId
    );

    if (questionResult) {
      questionData = GameQuestionMapper.mapToSimpleQuestion(
        questionResult.question
      );
      game.gameState.currentQuestion = questionData;
    }

    // Transition to answering state
    game.gameState.questionState = QuestionState.ANSWERING;
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

    // Clear any existing timer
    await this.gameService.clearTimer(game.id);

    // Setup answering timer
    const timerEntity = await this.timerService.setupQuestionTimer(
      game,
      GAME_QUESTION_ANSWER_TIME,
      QuestionState.ANSWERING
    );

    return {
      timer: timerEntity.value() ?? undefined,
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
