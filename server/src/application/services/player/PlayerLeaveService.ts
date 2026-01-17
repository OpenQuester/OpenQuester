import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GameService } from "application/services/game/GameService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  AnsweringPlayerLeaveLogic,
  AnsweringScenarioType,
} from "domain/logic/player-leave/AnsweringPlayerLeaveLogic";
import { FinalBiddingPlayerLeaveLogic } from "domain/logic/player-leave/FinalBiddingPlayerLeaveLogic";
import { MediaDownloadPlayerLeaveLogic } from "domain/logic/player-leave/MediaDownloadPlayerLeaveLogic";
import { StakeBiddingPlayerLeaveLogic } from "domain/logic/player-leave/StakeBiddingPlayerLeaveLogic";
import {
  TurnPlayerLeaveLogic,
  TurnPlayerScenarioType,
} from "domain/logic/player-leave/TurnPlayerLeaveLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  BroadcastEvent,
  ServiceResult,
} from "domain/types/service/ServiceResult";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import { PlayerKickBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { StakeBiddingToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { AnswerResultTransitionPayload } from "domain/types/socket/transition/answering";

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
 * Service consolidating all player leave logic.
 * Handles: disconnect, voluntary leave, kick, and ban.
 */
@singleton()
export class PlayerLeaveService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly finalRoundService: FinalRoundService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
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
    const finalBiddingBroadcasts = await this.handleFinalBiddingPlayerLeave(
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
      ...finalBiddingBroadcasts,
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
   * Handle player leaving during stake question bidding phase.
   *
   * Flow:
   * 1. Validate and process auto-pass
   * 2. If bidding complete with winner, try transition via router
   * 3. Otherwise handle question skip or continue bidding
   */
  private async handleStakeBiddingPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    // Validate using Logic class
    const validation = StakeBiddingPlayerLeaveLogic.validate(game, userId);
    if (!validation.isEligible) {
      return [];
    }

    // Process auto-pass using Logic class
    const mutationResult = StakeBiddingPlayerLeaveLogic.processAutoPass(
      game,
      userId
    );

    // Handle question skip if no winner
    if (mutationResult.questionSkipped) {
      StakeBiddingPlayerLeaveLogic.handleQuestionSkip(game);
      await this.gameService.clearTimer(game.id);

      // Build result using Logic class (skip broadcast only)
      return StakeBiddingPlayerLeaveLogic.buildResult({
        game,
        mutationResult,
      }).broadcasts;
    }

    // Build auto-pass broadcast
    const broadcasts = StakeBiddingPlayerLeaveLogic.buildResult({
      game,
      mutationResult,
    }).broadcasts;

    // Try transition to ANSWERING if bidding complete with winner
    if (mutationResult.isBiddingComplete && mutationResult.winnerId !== null) {
      const transitionResult = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.PLAYER_LEFT,
        triggeredBy: { playerId: userId, isSystem: false },
        payload: {
          isPhaseComplete: true,
          winnerPlayerId: mutationResult.winnerId,
          finalBid: mutationResult.winningBid,
        } satisfies StakeBiddingToAnsweringPayload,
      });

      if (transitionResult) {
        // Add transition broadcasts (QUESTION_DATA with timer)
        broadcasts.push(...transitionResult.broadcasts);
      }
    }

    return broadcasts;
  }

  /**
   * Handle player leaving during final round bidding phase.
   */
  private async handleFinalBiddingPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    // Validate using Logic class
    const validation = FinalBiddingPlayerLeaveLogic.validate(game, userId);
    if (!validation.isEligible) {
      return [];
    }

    // Process auto-bid using Logic class
    const mutationResult = FinalBiddingPlayerLeaveLogic.processAutoBid(
      game,
      userId
    );

    // Try phase transition (BIDDING -> ANSWERING) if bids now complete
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
    });

    await this.gameService.updateGame(game);

    // Build result using Logic class
    const result = FinalBiddingPlayerLeaveLogic.buildResult({
      game,
      mutationResult,
      transitionResult,
    });

    return result.broadcasts;
  }

  /**
   * Handle answering player leaving - auto-skip their answer with 0 points.
   */
  private async handleAnsweringPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    // Validate and determine scenario using Logic class
    const validation = AnsweringPlayerLeaveLogic.validate(game, userId);
    if (!validation.isEligible) {
      return [];
    }

    // Handle final round answering scenario
    if (validation.scenarioType === AnsweringScenarioType.FINAL_ROUND) {
      return await this._handleFinalRoundAnsweringLeave(game, userId);
    }

    // Handle regular round answering scenario
    return await this._handleRegularRoundAnsweringLeave(game, userId);
  }

  /**
   * Handle final round answering player leave - auto-loss for the player.
   */
  private async _handleFinalRoundAnsweringLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    // Process auto-loss using Logic class
    const wasProcessed = AnsweringPlayerLeaveLogic.processFinalRoundAutoLoss(
      game,
      userId
    );

    // Try phase transition (ANSWERING -> REVIEWING) if now complete
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
    });

    await this.gameService.updateGame(game);

    // Build result using Logic class
    const result = AnsweringPlayerLeaveLogic.buildFinalRoundResult({
      game,
      userId,
      wasProcessed,
      transitionResult,
    });

    return result.broadcasts;
  }

  /**
   * Handle regular round answering player leave - auto-skip with 0 points.
   *
   * Flow:
   * 1. Get current question type
   * 2. Try transition to SHOWING_ANSWER via router
   * 3. Handler processes auto-skip, timer, and broadcasts
   */
  private async _handleRegularRoundAnsweringLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    const currentQuestion = game.gameState.currentQuestion;
    const questionType = currentQuestion?.type ?? PackageQuestionType.SIMPLE;

    // Try transition to SHOWING_ANSWER with SKIP answer type and 0 score
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
      payload: {
        answerType: AnswerResultType.SKIP,
        scoreResult: 0,
        questionType,
      } satisfies AnswerResultTransitionPayload,
    });

    if (transitionResult) {
      return transitionResult.broadcasts;
    }

    return [];
  }

  /**
   * Handle current turn player leaving - clear or reassign turn.
   *
   * Flow:
   * 1. Validate and determine scenario (via Logic class)
   * 2. Process turn player leave based on scenario
   * 3. Return result (via Logic.buildResult)
   */
  private async handleTurnPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    // Validate and determine scenario using Logic class
    const validation = TurnPlayerLeaveLogic.validate(game, userId);
    if (!validation.isEligible) {
      return [];
    }

    // Handle final round theme elimination scenario
    if (
      validation.scenarioType ===
      TurnPlayerScenarioType.FINAL_ROUND_THEME_ELIMINATION
    ) {
      return await this._handleFinalRoundTurnPlayerLeave(game);
    }

    // Handle regular round turn player leave (no broadcasts needed)
    TurnPlayerLeaveLogic.processRegularRoundLeave(game);
    return [];
  }

  /**
   * Handle final round turn player leaving during theme elimination.
   *
   * Uses FinalRoundService.handleThemeEliminationTimeout for auto-elimination.
   */
  private async _handleFinalRoundTurnPlayerLeave(
    game: Game
  ): Promise<BroadcastEvent[]> {
    try {
      // Use existing final round service to handle timeout (auto-elimination)
      const result = await this.finalRoundService.handleThemeEliminationTimeout(
        game.id
      );

      // Build result using Logic class
      const leaveResult = TurnPlayerLeaveLogic.buildFinalRoundResult(
        game,
        result
      );
      return leaveResult.broadcasts;
    } catch (error) {
      this.logger.warn(
        "Failed to handle final round turn player leave auto-elimination",
        {
          prefix: LogPrefix.GAME,
          gameId: game.id,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return [];
    }
  }

  /**
   * Handle player leaving during media download phase.
   *
   * Flow:
   * 1. Validate preconditions (via Logic class)
   * 2. Check if all remaining players are ready
   * 3. Setup showing timer if transitioning
   * 4. Return result (via Logic.buildResult)
   */
  private async handleMediaDownloadPlayerLeave(
    game: Game,
    userId: number
  ): Promise<BroadcastEvent[]> {
    // Attempt transition using the phase transition router
    // If all remaining players (after userId is removed) are ready, transition to SHOWING
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
    });

    if (!transitionResult) {
      return [];
    }

    // Since transition succeeded, it means all players are ready.
    const timer = transitionResult.timer ?? null;

    return MediaDownloadPlayerLeaveLogic.buildResult({
      game,
      timer,
      leftUserId: userId,
    }).broadcasts;
  }
}
