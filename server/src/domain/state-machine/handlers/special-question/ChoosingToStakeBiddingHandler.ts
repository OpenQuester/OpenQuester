import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { STAKE_QUESTION_BID_TIME } from "domain/constants/game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
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
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  ChoosingToStakeBiddingCtx,
  ChoosingToStakeBiddingMutationData,
} from "domain/types/socket/transition/choosing";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { Player } from "domain/entities/game/Player";
import { StakeQuestionPickedBroadcastData } from "src/domain/types/socket/events/game/StakeQuestionPickedEventPayload";

/**
 * Handles transition from CHOOSING to STAKE_BIDDING when a stake question is picked.
 * Sets up bidding order, stake data, and the bidding timer. Automatic nominal bid
 * is applied when the picker cannot afford the nominal price, but bidding remains
 * open for others to outbid via timer or subsequent bids.
 */
export class ChoosingToStakeBiddingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.CHOOSING;
  public readonly toPhase = GamePhase.STAKE_BIDDING;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService
  ) {
    super(gameService, timerService);
  }

  public canTransition(ctx: ChoosingToStakeBiddingCtx): boolean {
    const { game, trigger, payload } = ctx;

    if (!payload) return false;
    if (getGamePhase(game) !== this.fromPhase) return false;

    if (
      !TransitionGuards.canTransitionInRegularRound(
        game,
        QuestionState.CHOOSING
      )
    ) {
      return false;
    }

    if (trigger !== TransitionTrigger.USER_ACTION) return false;

    try {
      const { question } = QuestionPickLogic.validateQuestionPick(
        game,
        payload.questionId
      );

      if (question.type !== PackageQuestionType.STAKE) return false;

      return TransitionGuards.hasEligiblePlayers(game);
    } catch {
      return false;
    }
  }

  protected override validate(ctx: ChoosingToStakeBiddingCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(
    ctx: ChoosingToStakeBiddingCtx
  ): Promise<MutationResult> {
    const { game, payload, triggeredBy } = ctx;
    const pickerPlayerId = triggeredBy.playerId!;

    const { question, theme } = QuestionPickLogic.validateQuestionPick(
      game,
      payload!.questionId
    );

    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    const biddingOrder = this._calculateBiddingOrder(
      eligiblePlayers,
      pickerPlayerId
    );

    const stakeData: StakeQuestionGameData = {
      pickerPlayerId,
      questionId: question.id!,
      maxPrice: question.maxPrice ?? null,
      bids: {},
      passedPlayers: [],
      biddingOrder,
      currentBidderIndex: 0,
      highestBid: null,
      winnerPlayerId: null,
      biddingPhase: true,
    };

    const pickerPlayer = game.getPlayer(pickerPlayerId, {
      fetchDisconnected: true,
    });

    let automaticBid: PlayerBidData | null = null;
    const nominalBidAmount = question.price ?? 1;

    // Bid question price automatically if picker score is lower
    if (pickerPlayer && pickerPlayer.score < nominalBidAmount) {
      automaticBid = this._handleAutomaticNominalBid(
        stakeData,
        pickerPlayer,
        nominalBidAmount
      );
    }

    game.gameState.questionState = QuestionState.BIDDING;
    game.gameState.stakeQuestionData = stakeData;

    // Mark question played and reset media download statuses
    QuestionPickLogic.markQuestionPlayed(game, question.id!, theme.id!);
    QuestionPickLogic.resetMediaDownloadStatus(game);

    return {
      data: {
        pickerPlayerId,
        questionId: question.id!,
        maxPrice: stakeData.maxPrice,
        biddingOrder: stakeData.biddingOrder,
        timer: undefined,
        automaticBid,
      } satisfies ChoosingToStakeBiddingMutationData,
    };
  }

  /** Timer for bidding */
  protected async handleTimer(
    ctx: ChoosingToStakeBiddingCtx,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    await this.gameService.clearTimer(ctx.game.id);

    const timerEntity = await this.timerService.setupQuestionTimer(
      ctx.game,
      STAKE_QUESTION_BID_TIME,
      QuestionState.BIDDING
    );

    return { timer: timerEntity.value() ?? undefined };
  }

  protected collectBroadcasts(
    ctx: ChoosingToStakeBiddingCtx,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const data = mutationResult.data as
      | ChoosingToStakeBiddingMutationData
      | undefined;

    if (!data) return [];

    const broadcasts: BroadcastEvent[] = [];

    // Initial stake question pick broadcast
    broadcasts.push({
      event: SocketIOGameEvents.STAKE_QUESTION_PICKED,
      data: {
        pickerPlayerId: data.pickerPlayerId,
        questionId: data.questionId,
        maxPrice: data.maxPrice,
        biddingOrder: data.biddingOrder,
        timer: timerResult.timer ?? {
          durationMs: 0,
          elapsedMs: 0,
          startedAt: new Date(),
          resumedAt: null,
        },
      } satisfies StakeQuestionPickedBroadcastData,
      room: ctx.game.id,
    });

    // Automatic nominal bid (only when picker cannot afford nominal price)
    const stakeData = ctx.game.gameState.stakeQuestionData;
    if (data.automaticBid && stakeData) {
      const nextBidderId =
        stakeData.biddingOrder[stakeData.currentBidderIndex] ?? null;

      broadcasts.push({
        event: SocketIOGameEvents.STAKE_BID_SUBMIT,
        data: {
          playerId: data.automaticBid.playerId,
          bidAmount: data.automaticBid.bidAmount,
          bidType: StakeBidType.NORMAL,
          isPhaseComplete: false,
          nextBidderId,
          timer: timerResult.timer ?? null,
        },
        room: ctx.game.id,
      });
    }

    return broadcasts;
  }

  private _calculateBiddingOrder(
    eligiblePlayers: Player[],
    pickerPlayerId: number
  ): number[] {
    const pickerIndex = eligiblePlayers.findIndex(
      (p) => p.meta.id === pickerPlayerId
    );

    const normalizedIndex = pickerIndex >= 0 ? pickerIndex : 0;

    // If picker index 2, list will be [2, 3, 0, 1]
    return [
      ...eligiblePlayers.slice(normalizedIndex),
      ...eligiblePlayers.slice(0, normalizedIndex),
    ].map((p) => p.meta.id);
  }

  private _handleAutomaticNominalBid(
    stakeQuestionData: StakeQuestionGameData,
    currentPlayer: Player,
    questionPrice: number
  ): PlayerBidData {
    const autoBidAmount = questionPrice;
    stakeQuestionData.bids[currentPlayer.meta.id] = autoBidAmount;
    stakeQuestionData.highestBid = autoBidAmount;
    stakeQuestionData.winnerPlayerId = currentPlayer.meta.id;

    // Keep bidding open; move to next bidder if any
    stakeQuestionData.currentBidderIndex =
      (stakeQuestionData.currentBidderIndex + 1) %
      stakeQuestionData.biddingOrder.length;

    return {
      playerId: currentPlayer.meta.id,
      bidAmount: autoBidAmount,
    };
  }
}
