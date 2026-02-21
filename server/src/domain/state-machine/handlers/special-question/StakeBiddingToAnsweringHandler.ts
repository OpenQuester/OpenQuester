import { GameService } from "application/services/game/GameService";
import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
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
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import {
  StakeBiddingToAnsweringCtx,
  StakeBiddingToAnsweringMutationData,
} from "domain/types/socket/transition/special-question";

/**
 * Handles transition from STAKE_BIDDING to ANSWERING phase.
 *
 * This transition occurs when:
 * - All eligible players have bid/passed
 * - Only one player remains (others all passed)
 * - Stake bidding timer expires and all passed (one player left)
 *
 * Entry points:
 * - Player submits last bid (SpecialQuestionService.handleStakeBidSubmit)
 * - Stake bidding timer expires (TimerExpirationService)
 * - Player leaves during bidding
 */
export class StakeBiddingToAnsweringHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.STAKE_BIDDING;
  public readonly toPhase = GamePhase.ANSWERING;

  constructor(
    gameService: GameService,
    private readonly packageStore: PackageStore
  ) {
    super(gameService);
  }

  /**
   * Check if this transition should occur.
   *
   * Validates:
   * 1. Current phase must be STAKE_BIDDING
   * 2. Bidding phase must be complete (determined by payload)
   * 3. Must have a winner
   */
  public canTransition(ctx: StakeBiddingToAnsweringCtx): boolean {
    const { game, trigger, payload } = ctx;

    if (!payload) {
      return false;
    }

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Must have stake question data
    if (!game.gameState?.stakeQuestionData) {
      return false;
    }

    // 3. Check if bidding is complete based on payload
    if (
      trigger === TransitionTrigger.USER_ACTION ||
      trigger === TransitionTrigger.TIMER_EXPIRED ||
      trigger === TransitionTrigger.CONDITION_MET ||
      trigger === TransitionTrigger.PLAYER_LEFT
    ) {
      // Check if payload indicates phase completion with a winner
      return (
        payload.isPhaseComplete === true && payload.winnerPlayerId !== null
      );
    }

    return false;
  }

  protected override validate(ctx: StakeBiddingToAnsweringCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(
    ctx: StakeBiddingToAnsweringCtx
  ): Promise<MutationResult> {
    const { game, payload } = ctx;
    const stakeData = game.gameState.stakeQuestionData!;

    // Get winner (from payload or stake data)
    const winnerPlayerId = payload?.winnerPlayerId ?? stakeData.winnerPlayerId!;

    // Get question data
    let questionData: SimplePackageQuestionDTO | null = null;
    const questionResult = await this.packageStore.getQuestionWithTheme(
      game.id,
      stakeData.questionId
    );

    if (questionResult) {
      questionData = GameQuestionMapper.mapToSimpleQuestion(
        questionResult.question
      );
      game.gameState.currentQuestion = questionData;
    }

    game.setQuestionState(QuestionState.ANSWERING);
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
      } satisfies StakeBiddingToAnsweringMutationData,
    };
  }

  protected async handleTimer(
    ctx: StakeBiddingToAnsweringCtx,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    // Setup answering timer so winner can request to answer
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
    ctx: StakeBiddingToAnsweringCtx,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const { game } = ctx;
    const broadcasts: BroadcastEvent[] = [];
    const data = mutationResult.data as
      | StakeBiddingToAnsweringMutationData
      | undefined;

    if (!data) return broadcasts;

    // 1. STAKE_QUESTION_WINNER - announces winner
    broadcasts.push({
      event: SocketIOGameEvents.STAKE_QUESTION_WINNER,
      data: {
        winnerPlayerId: data.winnerPlayerId,
        finalBid: data.finalBid,
      } satisfies StakeQuestionWinnerEventData,
      room: game.id,
    });

    // 2. QUESTION_DATA - sends question to all players
    if (data.questionData && timerResult.timer) {
      broadcasts.push({
        event: SocketIOGameEvents.QUESTION_DATA,
        data: {
          data: data.questionData,
          timer: timerResult.timer,
          questionEligiblePlayers: game.getQuestionEligiblePlayers(),
        } satisfies GameQuestionDataEventPayload,
        room: game.id,
      });
    }

    return broadcasts;
  }
}
