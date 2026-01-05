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
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from STAKE_BIDDING to ANSWERING phase.
 *
 * This transition occurs when:
 * - All eligible players have bid/passed
 * - Only one player remains (others all passed)
 * - Stake bidding timer expires
 *
 * Entry points:
 * - Player submits final bid (SpecialQuestionService.handleStakeBidSubmit)
 * - Stake bidding timer expires (TimerExpirationService)
 * - Player leaves during bidding
 */
export class StakeBiddingToAnsweringHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.STAKE_BIDDING;
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
   * 1. Current phase must be STAKE_BIDDING
   * 2. Bidding phase must be complete (determined by payload or timer)
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger, payload } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Must have stake bidding data
    if (!TransitionGuards.isStakeBiddingPhase(game)) {
      return false;
    }

    // 3. Check if bidding is complete
    if (trigger === TransitionTrigger.USER_ACTION) {
      // Check if payload indicates phase completion
      return payload?.isPhaseComplete === true;
    }

    if (trigger === TransitionTrigger.TIMER_EXPIRED) {
      // Timer expiration forces completion
      return true;
    }

    return false;
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game, payload } = ctx;
    const stakeData = game.gameState.stakeQuestionData!;

    // Get winner (from payload or stake data)
    const winnerPlayerId =
      (payload?.winnerPlayerId as number) ?? stakeData.winnerPlayerId!;

    // Get question data
    let questionData: SimplePackageQuestionDTO | null = null;
    const questionResult = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
      stakeData.questionId
    );

    if (questionResult) {
      questionData = GameQuestionMapper.mapToSimpleQuestion(
        questionResult.question
      );
      game.gameState.currentQuestion = questionData;
    }

    // Transition to answering state
    game.gameState.questionState = QuestionState.ANSWERING;
    game.gameState.answeringPlayer = winnerPlayerId;
    game.gameState.stakeQuestionData = {
      ...stakeData,
      biddingPhase: false,
      winnerPlayerId,
    };

    return {
      data: {
        winnerPlayerId,
        finalBid: stakeData.highestBid,
        questionData,
      },
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    // Clear bidding timer
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
    const winnerPlayerId = mutationResult.data?.winnerPlayerId as number;
    const finalBid = mutationResult.data?.finalBid as number | null;
    const questionData = mutationResult.data
      ?.questionData as SimplePackageQuestionDTO | null;

    // 1. STAKE_QUESTION_WINNER - announces winner
    broadcasts.push({
      event: SocketIOGameEvents.STAKE_QUESTION_WINNER,
      data: {
        winnerPlayerId,
        finalBid,
      } satisfies StakeQuestionWinnerEventData,
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
