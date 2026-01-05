import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
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
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { SecretQuestionTransferBroadcastData } from "domain/types/socket/game/SecretQuestionTransferData";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from SECRET_QUESTION_TRANSFER to ANSWERING phase.
 *
 * This transition occurs when:
 * - Showman selects a player to receive the secret question
 *
 * Entry points:
 * - Showman transfers question (SpecialQuestionService.handleSecretQuestionTransfer)
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
  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger, payload } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Must have secret transfer data
    if (!TransitionGuards.isSecretTransferPhase(game)) {
      return false;
    }

    // 3. Must be user action with target player
    if (trigger !== TransitionTrigger.USER_ACTION) {
      return false;
    }

    // 4. Must have target player in payload
    const targetPlayerId = payload?.targetPlayerId as number | undefined;
    if (!targetPlayerId) {
      return false;
    }

    // 5. Target player must be eligible
    return TransitionGuards.isPlayerEligible(game, targetPlayerId);
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game, payload } = ctx;
    const secretData = game.gameState.secretQuestionData!;
    const targetPlayerId = payload!.targetPlayerId as number;
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
      },
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
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
    ctx: TransitionContext,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const { game } = ctx;
    const broadcasts: BroadcastEvent[] = [];
    const fromPlayerId = mutationResult.data?.fromPlayerId as number;
    const targetPlayerId = mutationResult.data?.targetPlayerId as number;
    const questionData = mutationResult.data
      ?.questionData as SimplePackageQuestionDTO | null;

    // 1. SECRET_QUESTION_TRANSFER - notifies of transfer
    broadcasts.push({
      event: SocketIOGameEvents.SECRET_QUESTION_TRANSFER,
      data: {
        fromPlayerId,
        toPlayerId: targetPlayerId,
        questionId: mutationResult.data?.questionId as number,
      } satisfies SecretQuestionTransferBroadcastData,
      room: game.id,
    });

    // 2. QUESTION_DATA - sends question to all players
    if (questionData && timerResult.timer) {
      broadcasts.push({
        event: SocketIOGameEvents.QUESTION_DATA,
        data: {
          data: questionData,
          timer: timerResult.timer,
        } satisfies GameQuestionDataEventPayload,
        room: game.id,
      });
    }

    return broadcasts;
  }
}
