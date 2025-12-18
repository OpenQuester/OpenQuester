import { GameService } from "application/services/game/GameService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import {
  GAME_QUESTION_ANSWER_TIME,
  SYSTEM_PLAYER_ID,
} from "domain/constants/game";
import {
  AUTO_BID_MINIMUM,
  DEFAULT_QUESTION_PRICE,
  MIN_TIMER_TTL_MS,
} from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/socket/round/FinalRoundHandler";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import {
  BroadcastEvent,
  ServiceResult,
} from "domain/types/service/ServiceResult";
import {
  FinalAnswerSubmitOutputData,
  FinalAutoLossEventData,
  FinalBidSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  FinalSubmitEndEventData,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import {
  StakeBidSubmitOutputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { PlayerKickBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { FinalRoundQuestionData } from "domain/types/socket/finalround/FinalRoundResults";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { FinalRoundPhaseCompletionHelper } from "domain/utils/FinalRoundPhaseCompletionHelper";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";

/**
 * Reason for player leaving the game
 */
export enum PlayerLeaveReason {
  DISCONNECT = "disconnect",
  LEAVE = "leave",
  KICK = "kick",
  BAN = "ban",
}

/**
 * Options for player leave operation
 */
export interface PlayerLeaveOptions {
  reason: PlayerLeaveReason;
  kickedBy?: number;
  bannedBy?: number;
  cleanupSession?: boolean;
  targetUserId?: number;
}

/**
 * Result from player leave operation
 */
export interface PlayerLeaveResult extends ServiceResult {
  game: Game;
  userId: number;
  wasInGame: boolean;
  shouldEmitLeave: boolean;
}

/**
 * Service consolidating all player leave logic
 * Handles: disconnect, voluntary leave, kick, and ban
 */
export class PlayerLeaveService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly socketQuestionStateService: SocketQuestionStateService,
    private readonly finalRoundService: FinalRoundService,
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Handle player leaving the game
   * Game-level locking handled by action executor
   */
  public async handlePlayerLeave(
    socketId: string,
    options: PlayerLeaveOptions
  ): Promise<PlayerLeaveResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const gameId = game.id;
    const userId = options.targetUserId ?? context.userSession.id;

    return await this.executePlayerLeave(
      game,
      gameId,
      socketId,
      userId,
      options
    );
  }

  /**
   * Handle game state cleanup when a player becomes inactive (e.g., restricted to spectator)
   * This handles: answering player, turn player, bidding states
   * WITHOUT removing the player from the game
   *
   * Used when restricting a player to spectator role
   */
  public async handlePlayerGameStateCleanup(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    const broadcasts: BroadcastEvent[] = [];

    // Handle stake bidding player
    const stakeBiddingBroadcasts = await this.handleStakeBiddingPlayerLeave(
      game,
      userId
    );
    broadcasts.push(...stakeBiddingBroadcasts);

    // Handle final bidding player
    const biddingBroadcasts = await this.handleFinalBiddingPlayerLeave(
      game,
      userId
    );
    broadcasts.push(...biddingBroadcasts);

    // Handle answering player
    const answeringBroadcasts = await this.handleAnsweringPlayerLeave(
      game,
      userId
    );
    broadcasts.push(...answeringBroadcasts);

    // Handle current turn player
    const turnPlayerBroadcasts = await this.handleTurnPlayerLeave(game, userId);
    broadcasts.push(...turnPlayerBroadcasts);

    // Handle media downloading state
    const mediaDownloadBroadcasts = await this.handleMediaDownloadPlayerLeave(
      game,
      userId
    );
    broadcasts.push(...mediaDownloadBroadcasts);

    return broadcasts;
  }

  private async executePlayerLeave(
    game: Game,
    gameId: string,
    socketId: string,
    userId: number,
    options: PlayerLeaveOptions
  ): Promise<PlayerLeaveResult> {
    // Check if player is still in the game
    if (!game.hasPlayer(userId)) {
      return {
        success: false,
        wasInGame: false,
        game,
        userId,
        shouldEmitLeave: false,
        broadcasts: [],
      };
    }

    const targetPlayer = game.getPlayer(userId, { fetchDisconnected: true });
    const wasPlayer = targetPlayer?.role === PlayerRole.PLAYER;

    // Handle stake bidding player leaving - must be done BEFORE removing player
    const stakeBiddingBroadcasts = await this.handleStakeBiddingPlayerLeave(
      game,
      userId
    );

    // Handle final bidding player leaving - must be done BEFORE removing player
    const biddingBroadcasts = await this.handleFinalBiddingPlayerLeave(
      game,
      userId
    );

    // Handle answering player leaving - must be done BEFORE removing player
    const answeringBroadcasts = await this.handleAnsweringPlayerLeave(
      game,
      userId
    );

    // Handle current turn player leaving - must be done BEFORE removing player
    const turnPlayerBroadcasts = await this.handleTurnPlayerLeave(game, userId);

    // If theme elimination was handled, re-fetch game to get updated state
    const themeEliminationHandled = turnPlayerBroadcasts.some(
      (b) => b.event === SocketIOGameEvents.THEME_ELIMINATE
    );
    if (themeEliminationHandled) {
      // Re-fetch game to ensure we have the latest state after theme elimination.
      // the caller holds the same `game` reference and needs to see updated state.
      const updatedGame = await this.gameService.getGameEntity(gameId);
      Object.assign(game, updatedGame);
    }

    // Remove player from game
    game.removePlayer(userId);

    // Remove from ready list
    if (game.gameState.readyPlayers) {
      game.gameState.readyPlayers = game.gameState.readyPlayers.filter(
        (playerId) => playerId !== userId
      );
    }

    // Handle media downloading state - must be done AFTER removing player
    // so we can check if all remaining players are ready
    const mediaDownloadBroadcasts = await this.handleMediaDownloadPlayerLeave(
      game,
      userId
    );

    // Update socket session
    if (options.cleanupSession !== false) {
      await this.socketUserDataService.update(socketId, {
        id: JSON.stringify(userId),
        gameId: JSON.stringify(null),
      });
    }

    await this.gameService.updateGame(game);

    // End player session to collect statistics if they were a player
    if (wasPlayer) {
      await this.playerGameStatsService.endPlayerSession(
        gameId,
        userId,
        new Date()
      );
    }

    // Build broadcasts based on reason
    const broadcasts = this.buildBroadcasts(gameId, userId, options);

    // Add bidding, answering, turn player, and media download broadcasts
    broadcasts.push(
      ...stakeBiddingBroadcasts,
      ...biddingBroadcasts,
      ...answeringBroadcasts,
      ...turnPlayerBroadcasts,
      ...mediaDownloadBroadcasts
    );

    return {
      success: true,
      wasInGame: true,
      game,
      userId,
      shouldEmitLeave: true,
      broadcasts,
    };
  }

  private buildBroadcasts(
    gameId: string,
    userId: number,
    options: PlayerLeaveOptions
  ): BroadcastEvent[] {
    const broadcasts: BroadcastEvent[] = [];

    switch (options.reason) {
      case PlayerLeaveReason.KICK:
        broadcasts.push({
          event: SocketIOGameEvents.PLAYER_KICKED,
          data: { playerId: userId } satisfies PlayerKickBroadcastData,
          room: gameId,
        });
        broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: userId } satisfies GameLeaveEventPayload,
          room: gameId,
        });
        break;

      case PlayerLeaveReason.BAN:
        // Ban restriction event is handled by PlayerRestrictionEventHandler
        // We only emit LEAVE here
        broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: userId } satisfies GameLeaveEventPayload,
          room: gameId,
        });
        break;

      case PlayerLeaveReason.LEAVE:
      case PlayerLeaveReason.DISCONNECT:
        broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: userId } satisfies GameLeaveEventPayload,
          room: gameId,
        });
        break;
    }

    return broadcasts;
  }

  /**
   * Handle player leaving during stake question bidding phase
   * Auto-passes for the leaving player, and if they were the only eligible bidder
   * or if only one player remains, that player wins automatically
   */
  private async handleStakeBiddingPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    // Check if in stake question bidding phase
    const stakeData = game.gameState.stakeQuestionData;
    if (!stakeData || !stakeData.biddingPhase) {
      return [];
    }

    // Check if the leaving player is in the bidding order
    if (!stakeData.biddingOrder.includes(userId)) {
      return [];
    }

    // Check if already passed
    if (stakeData.passedPlayers.includes(userId)) {
      return [];
    }

    const broadcasts: BroadcastEvent[] = [];

    // Auto-pass for the leaving player
    stakeData.passedPlayers.push(userId);
    stakeData.bids[userId] = null;

    // Emit the auto-pass bid event
    broadcasts.push({
      event: SocketIOGameEvents.STAKE_BID_SUBMIT,
      data: {
        playerId: userId,
        bidAmount: null,
        bidType: StakeBidType.PASS,
        isPhaseComplete: false,
        nextBidderId: null,
      } satisfies StakeBidSubmitOutputData,
      room: game.id,
    });

    // Check remaining eligible bidders (not passed, still in game)
    const remainingBidders = stakeData.biddingOrder.filter(
      (playerId) =>
        !stakeData.passedPlayers.includes(playerId) &&
        playerId !== userId &&
        game.hasPlayer(playerId)
    );

    // If only one bidder remains or no bidders remain, end bidding phase
    if (remainingBidders.length <= 1) {
      stakeData.biddingPhase = false;

      // Determine winner
      if (remainingBidders.length === 1) {
        // Last remaining player wins
        stakeData.winnerPlayerId = remainingBidders[0];
        // If they haven't bid yet, they get minimum bid (question price)
        if (stakeData.bids[remainingBidders[0]] === undefined) {
          const questionData = GameQuestionMapper.getQuestionAndTheme(
            game.package,
            game.gameState.currentRound!.id,
            stakeData.questionId
          );
          stakeData.bids[remainingBidders[0]] =
            questionData?.question.price || DEFAULT_QUESTION_PRICE;
          stakeData.highestBid = stakeData.bids[remainingBidders[0]];
        }
      } else if (stakeData.highestBid !== null) {
        // No remaining bidders but there was a highest bid - that player wins
        for (const [playerIdStr, bidAmount] of Object.entries(stakeData.bids)) {
          if (bidAmount === stakeData.highestBid) {
            stakeData.winnerPlayerId = parseInt(playerIdStr, 10);
            break;
          }
        }
      }

      // Emit winner event if there's a winner
      if (stakeData.winnerPlayerId !== null) {
        broadcasts.push({
          event: SocketIOGameEvents.STAKE_QUESTION_WINNER,
          data: {
            winnerPlayerId: stakeData.winnerPlayerId,
            finalBid: stakeData.highestBid,
          } satisfies StakeQuestionWinnerEventData,
          room: game.id,
        });
      } else {
        // No winner means question should be skipped
        // Clear stake data and move to choosing state
        game.gameState.stakeQuestionData = null;
        game.gameState.questionState = QuestionState.CHOOSING;
        await this.gameService.clearTimer(game.id);
      }
    } else {
      // Find next eligible bidder (not passed and not the leaving player)
      const nextBidderIndex = this.findNextEligibleBidderIndex(
        stakeData.biddingOrder,
        stakeData.currentBidderIndex,
        stakeData.passedPlayers,
        userId
      );

      stakeData.currentBidderIndex = nextBidderIndex;
      const nextBidderId = stakeData.biddingOrder[nextBidderIndex];

      // Replace the initial pass event (added above) with updated version including next bidder.
      // This avoids emitting two separate events for the same action.
      broadcasts[broadcasts.length - 1] = {
        event: SocketIOGameEvents.STAKE_BID_SUBMIT,
        data: {
          playerId: userId,
          bidAmount: null,
          bidType: StakeBidType.PASS,
          isPhaseComplete: false,
          nextBidderId,
        } satisfies StakeBidSubmitOutputData,
        room: game.id,
      };
    }

    game.gameState.stakeQuestionData = stakeData;
    return broadcasts;
  }

  /**
   * Handle player leaving during final round bidding phase
   */
  private async handleFinalBiddingPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    if (
      game.gameState.currentRound?.type !== PackageRoundType.FINAL ||
      game.gameState.questionState !== QuestionState.BIDDING
    ) {
      return [];
    }

    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (!finalRoundData) {
      return [];
    }

    // Check if player already submitted bid
    if (finalRoundData.bids[userId] !== undefined) {
      return [];
    }

    // Only auto-bid if player is actually a player (not spectator/showman)
    const player = game.getPlayer(userId, { fetchDisconnected: true });
    if (!player || player.role !== PlayerRole.PLAYER) {
      return [];
    }

    const broadcasts: BroadcastEvent[] = [];

    // Auto-bid minimum for the leaving player.
    // Using minimum bid (not 0) allows player to still participate if they reconnect,
    // while not giving them an unfair advantage from the auto-bid.
    FinalRoundStateManager.addBid(game, userId, AUTO_BID_MINIMUM);

    broadcasts.push({
      event: SocketIOGameEvents.FINAL_BID_SUBMIT,
      data: {
        playerId: userId,
        bidAmount: AUTO_BID_MINIMUM,
        isAutomatic: true,
      } satisfies FinalBidSubmitOutputData,
      room: game.id,
    });

    // Check if all bids are now submitted
    if (FinalRoundStateManager.areAllBidsSubmitted(game)) {
      // Clear timer before phase transition
      await this.gameService.clearTimer(game.id);

      // Transition to answering phase
      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.ANSWERING);

      // Get question data for the remaining theme
      const finalRoundHandler = this.roundHandlerFactory.create(
        PackageRoundType.FINAL
      ) as FinalRoundHandler;
      const remainingTheme = finalRoundHandler.getRemainingTheme(game);

      if (
        remainingTheme &&
        remainingTheme.questions &&
        remainingTheme.questions.length > 0
      ) {
        const questionData: FinalRoundQuestionData = {
          themeId: remainingTheme.id,
          themeName: remainingTheme.name,
          question: remainingTheme.questions[0],
        };

        broadcasts.push({
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          data: { questionData } satisfies FinalQuestionEventData,
          room: game.id,
        });
      }

      // Start answer timer
      const timer = await this.socketQuestionStateService.setupFinalAnswerTimer(
        game
      );

      broadcasts.push({
        event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        data: {
          phase: FinalRoundPhase.BIDDING,
          nextPhase: FinalRoundPhase.ANSWERING,
          timer: timer.value() ?? undefined,
        } satisfies FinalPhaseCompleteEventData,
        room: game.id,
      });
    }

    await this.gameService.updateGame(game);
    return broadcasts;
  }

  /**
   * Handle answering player leaving - auto-skip their answer with 0 points
   */
  private async handleAnsweringPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    const broadcasts: BroadcastEvent[] = [];

    // Check if this is a final round answering scenario (different logic)
    // In final round, multiple players answer simultaneously (no single answeringPlayer)
    if (
      game.gameState.currentRound?.type === PackageRoundType.FINAL &&
      game.gameState.questionState === QuestionState.ANSWERING
    ) {
      // Submit empty answer as auto-loss
      FinalRoundStateManager.addAnswer(game, userId, "");

      // Signal submission
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        data: {
          playerId: userId,
        } satisfies FinalAnswerSubmitOutputData,
        room: game.id,
      });

      // Signal auto-loss reason
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_AUTO_LOSS,
        data: {
          playerId: userId,
          reason: FinalAnswerLossReason.EMPTY_ANSWER,
        } satisfies FinalAutoLossEventData,
        room: game.id,
      });

      // Check if phase complete after answer submission
      const { isPhaseComplete, allReviews } =
        FinalRoundPhaseCompletionHelper.checkAnsweringPhaseCompletion(game);

      if (isPhaseComplete) {
        // Clear timer before phase transition
        await this.gameService.clearTimer(game.id);

        broadcasts.push({
          event: SocketIOGameEvents.FINAL_SUBMIT_END,
          data: {
            phase: FinalRoundPhase.ANSWERING,
            nextPhase: FinalRoundPhase.REVIEWING,
            allReviews,
          } satisfies FinalSubmitEndEventData,
          room: game.id,
        });
      }

      await this.gameService.updateGame(game);

      return broadcasts;
    }

    // For regular rounds, only handle if the leaving player is the current answering player
    if (game.gameState.answeringPlayer !== userId) {
      return [];
    }

    // Determine next state based on question type
    // For special questions (secret/stake), only one player is eligible to answer
    // If they leave, question is finished - go directly to CHOOSING
    // For normal questions, go to SHOWING to display the correct answer
    // Note: During ANSWERING phase, secretQuestionData and stakeQuestionData are cleared
    // so we check the question type from currentQuestion
    const currentQuestion = game.gameState.currentQuestion;
    const isSpecialQuestion =
      currentQuestion &&
      (currentQuestion.type === PackageQuestionType.SECRET ||
        currentQuestion.type === PackageQuestionType.STAKE);
    const nextState = isSpecialQuestion
      ? QuestionState.CHOOSING
      : QuestionState.SHOWING;

    // Auto-skip answer with 0 points
    const playerAnswerResult = game.handleQuestionAnswer(
      0,
      AnswerResultType.SKIP,
      nextState
    );

    // For special questions, need to mark the question as played and clear it
    if (isSpecialQuestion) {
      // Get current question from special question data
      const questionId =
        game.gameState.secretQuestionData?.questionId ||
        game.gameState.stakeQuestionData?.questionId;

      if (questionId) {
        const questionData = GameQuestionMapper.getQuestionAndTheme(
          game.package,
          game.gameState.currentRound!.id,
          questionId
        );

        if (questionData) {
          GameQuestionMapper.setQuestionPlayed(
            game,
            questionId,
            questionData.theme.id!
          );
        }
      }

      // Clear special question data and current question
      game.gameState.secretQuestionData = null;
      game.gameState.stakeQuestionData = null;
      game.gameState.currentQuestion = null;

      // Clear timer
      await this.gameService.clearTimer(game.id);

      broadcasts.push({
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: {
          answerResult: playerAnswerResult,
          timer: null,
        } satisfies QuestionAnswerResultEventPayload,
        room: game.id,
      });
    } else {
      // Normal question - set up showing timer
      const timer = await this.gameService.getTimer(
        game.id,
        QuestionState.SHOWING
      );

      if (timer) {
        game.setTimer(timer);
        const remainingTimeMs = timer.durationMs - timer.elapsedMs;
        const ttlMs = Math.max(remainingTimeMs, MIN_TIMER_TTL_MS);
        await this.gameService.saveTimer(timer, game.id, ttlMs);
      }

      broadcasts.push({
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: {
          answerResult: playerAnswerResult,
          timer,
        } satisfies QuestionAnswerResultEventPayload,
        room: game.id,
      });
    }

    return broadcasts;
  }

  /**
   * Handle current turn player leaving - clear or reassign turn
   */
  private async handleTurnPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    if (game.gameState.currentTurnPlayerId !== userId) {
      return [];
    }

    const broadcasts: BroadcastEvent[] = [];

    // Handle final round theme elimination if in that phase
    if (
      game.gameState.currentRound?.type === PackageRoundType.FINAL &&
      game.gameState.questionState === QuestionState.THEME_ELIMINATION
    ) {
      return await this.handleFinalRoundTurnPlayerLeave(game);
    }

    // For regular rounds, clear turn (showman must assign new turn player)
    game.gameState.currentTurnPlayerId = null;

    return broadcasts;
  }

  /**
   * Handle final round turn player leaving during theme elimination
   */
  private async handleFinalRoundTurnPlayerLeave(
    game: Game
  ): Promise<BroadcastEvent[]> {
    try {
      // Use existing final round service to handle timeout (auto-elimination)
      const result = await this.finalRoundService.handleThemeEliminationTimeout(
        game.id
      );

      const broadcasts: BroadcastEvent[] = [
        {
          event: SocketIOGameEvents.THEME_ELIMINATE,
          data: {
            themeId: result.themeId,
            eliminatedBy: SYSTEM_PLAYER_ID,
            nextPlayerId: result.nextPlayerId,
          } satisfies ThemeEliminateOutputData,
          room: game.id,
        },
      ];

      if (result.isPhaseComplete) {
        broadcasts.push({
          event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
          data: {
            phase: FinalRoundPhase.THEME_ELIMINATION,
            nextPhase: FinalRoundPhase.BIDDING,
          } satisfies FinalPhaseCompleteEventData,
          room: game.id,
        });
      }

      return broadcasts;
    } catch (error) {
      this.logger.warn(
        "Failed to handle final round turn player leave auto-elimination",
        {
          gameId: game.id,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return [];
    }
  }

  /**
   * Handle player leaving during media download phase
   * Checks if all remaining players are ready and transitions to SHOWING if so
   */
  private async handleMediaDownloadPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    // Only handle if in MEDIA_DOWNLOADING state
    if (game.gameState.questionState !== QuestionState.MEDIA_DOWNLOADING) {
      return [];
    }

    const broadcasts: BroadcastEvent[] = [];

    // Get active players (excluding the leaving player)
    const activePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME &&
        p.meta.id !== userId
    );

    // Check if all remaining active players have downloaded media
    const allPlayersReady = activePlayers.every((p) => p.mediaDownloaded);

    if (allPlayersReady && activePlayers.length > 0) {
      // Clear the media download timeout timer
      await this.gameService.clearTimer(game.id);

      // Set up the actual question showing timer
      const timer = await this.socketQuestionStateService.setupQuestionTimer(
        game,
        GAME_QUESTION_ANSWER_TIME,
        QuestionState.SHOWING
      );

      broadcasts.push({
        event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        data: {
          playerId: SYSTEM_PLAYER_ID,
          mediaDownloaded: true,
          allPlayersReady: true,
          timer: timer.value(),
        } satisfies MediaDownloadStatusBroadcastData,
        room: game.id,
      });
    }

    return broadcasts;
  }

  /**
   * Find the next eligible bidder index in circular bidding order.
   * Eligible = not passed and not the excluded player (leaving player).
   *
   * @param biddingOrder - Array of player IDs in bidding order
   * @param currentIndex - Current bidder's index
   * @param passedPlayers - Players who have already passed
   * @param excludePlayerId - Player to exclude (the one leaving)
   * @returns Index of next eligible bidder
   */
  private findNextEligibleBidderIndex(
    biddingOrder: number[],
    currentIndex: number,
    passedPlayers: number[],
    excludePlayerId: number
  ): number {
    const totalPlayers = biddingOrder.length;

    for (let offset = 1; offset <= totalPlayers; offset++) {
      const candidateIndex = (currentIndex + offset) % totalPlayers;
      const candidatePlayerId = biddingOrder[candidateIndex];

      const isPassed = passedPlayers.includes(candidatePlayerId);
      const isExcluded = candidatePlayerId === excludePlayerId;

      if (!isPassed && !isExcluded) {
        return candidateIndex;
      }
    }

    // Fallback: return next index (should not happen if called correctly)
    return (currentIndex + 1) % totalPlayers;
  }
}
