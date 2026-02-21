import { type Namespace } from "socket.io";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GameService } from "application/services/game/GameService";
import {
  PlayerLeaveReason,
  PlayerLeaveService,
} from "application/services/player/PlayerLeaveService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import {
  GameStartLogic,
  GameStartResult,
} from "domain/logic/game/GameStartLogic";
import { PlayerReadinessLogic } from "domain/logic/game/PlayerReadinessLogic";
import {
  PlayerRestrictionLogic,
  PlayerRestrictionResult,
  RestrictionUpdateInput,
} from "domain/logic/game/PlayerRestrictionLogic";
import {
  PlayerRoleChangeLogic,
  RoleChangeResult,
} from "domain/logic/game/PlayerRoleChangeLogic";
import {
  PlayerScoreChangeLogic,
  PlayerScoreChangeResult,
} from "domain/logic/game/PlayerScoreChangeLogic";
import {
  PlayerSlotChangeLogic,
  PlayerSlotChangeResult,
} from "domain/logic/game/PlayerSlotChangeLogic";
import { RoundProgressionLogic } from "domain/logic/game/RoundProgressionLogic";
import {
  TurnPlayerChangeLogic,
  TurnPlayerChangeResult,
} from "domain/logic/game/TurnPlayerChangeLogic";
import { ActionContext } from "domain/types/action/ActionContext";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameLobbyLeaveData } from "domain/types/game/GameRoomLeaveData";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ShowmanAction } from "domain/types/game/ShowmanAction";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Service for game lobby operations and player management.
 */
@singleton()
export class SocketIOGameService {
  constructor(
    private readonly socketUserDataService: SocketUserDataService,
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly playerLeaveService: PlayerLeaveService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger,
    @inject(DI_TOKENS.IOGameNamespace) private readonly gamesNsp: Namespace,
    private readonly packageStore: PackageStore
  ) {
    //
  }

  public getGameEntity(gameId: string, updatedTTL?: number): Promise<Game> {
    return this.gameService.getGameEntity(gameId, updatedTTL);
  }

  public async startGame(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    this.socketGameValidationService.validateShowmanRole(
      currentPlayer,
      ShowmanAction.START
    );

    GameStateValidator.validateGameNotFinished(game);

    if (ValueUtils.isValidDate(game.startedAt)) {
      throw new ClientError(ClientResponse.GAME_ALREADY_STARTED);
    }

    const firstRound = await this.packageStore.getRound(game.id, 0);
    const gameState = GameStartLogic.buildInitialGameState(game, firstRound);

    game.startedAt = new Date();
    game.gameState = gameState;
    await this.gameService.updateGame(game);

    // Start collecting game statistics
    try {
      await this.gameStatisticsCollectorService.startCollection(
        game.id,
        game.startedAt,
        game.createdBy,
        game
      );
    } catch (error) {
      this.logger.warn("Failed to start statistics collection", {
        prefix: LogPrefix.STATS,
        gameId: game.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return GameStartLogic.buildResult(game);
  }

  public async leaveLobby(
    socketId: string,
    userData: SocketRedisUserData | null,
    game: Game
  ): Promise<GameLobbyLeaveData> {
    const result = await this.playerLeaveService.handlePlayerLeave(
      socketId,
      game,
      userData,
      {
        reason: PlayerLeaveReason.LEAVE,
      }
    );

    if (!result.shouldEmitLeave) {
      return { emit: false };
    }

    const activePlayers = result.game.players.filter(
      (p) => p.gameStatus === PlayerGameStatus.IN_GAME
    );

    const gameNotStartedOrFinished =
      result.game.startedAt === null || result.game.finishedAt !== null;

    if (activePlayers.length === 0 && gameNotStartedOrFinished) {
      await this.deleteGameInternally(result.game.id);
    }

    return {
      emit: true,
      data: { userId: result.userId, game: result.game },
      broadcasts: result.broadcasts,
    };
  }

  /**
   * Handle progression to next round.
   *
   * Flow:
   * 1. Fetch context and validate
   * 2. Get current question data (via Logic class)
   * 3. Clear timer
   * 4. Execute round progression via handler
   * 5. Persist and return result (via Logic.buildResult)
   */
  public async handleNextRound(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    this.socketGameValidationService.validateNextRound(currentPlayer, game);

    // Get current question data using Logic class
    const currentQuestionId = game.gameState.currentQuestion?.id ?? null;
    const questionDataRaw = currentQuestionId
      ? await this.packageStore.getQuestion(game.id, currentQuestionId)
      : null;
    const questionData = RoundProgressionLogic.getCurrentQuestionData(
      game,
      questionDataRaw
    );

    // Clear any active timer before round progression to prevent stale expirations
    await this.gameService.clearTimer(game.id);

    const roundHandler = this.roundHandlerFactory.createFromGame(game);
    roundHandler.validateRoundProgression(game);

    const { isGameFinished, nextGameState } =
      await roundHandler.handleRoundProgression(game, {
        forced: true,
      });

    if (isGameFinished || nextGameState) {
      await this.gameService.updateGame(game);
    }

    // Note: Statistics collection is handled by GameProgressionCoordinator
    // which is called by the action handler after this method returns

    return RoundProgressionLogic.buildResult({
      game,
      isGameFinished,
      nextGameState,
      questionData,
    });
  }

  public async handleGameUnpause(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    this.socketGameValidationService.validateGameUnpause(currentPlayer, game);

    return this.socketGameTimerService.unpauseGameTimer(game);
  }

  public async handleGamePause(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    this.socketGameValidationService.validateGamePause(currentPlayer, game);

    return this.socketGameTimerService.pauseGameTimer(game);
  }

  public async removePlayerAuth(socketId: string) {
    return this.socketUserDataService.remove(socketId);
  }

  public async setPlayerReadiness(ctx: ActionContext, isReady: boolean) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    // Validate player can set ready state
    this.socketGameValidationService.validatePlayerReadyState(
      currentPlayer,
      game
    );

    const playerId = currentPlayer!.meta.id;

    // Update ready state via Logic class
    const newReadyPlayers = PlayerReadinessLogic.updateReadyState(
      game,
      playerId,
      isReady
    );

    await this.gameService.updateGame(game);

    // Check if auto-start should trigger
    const shouldAutoStart = PlayerReadinessLogic.shouldAutoStart(game);

    return PlayerReadinessLogic.buildResult({
      game,
      playerId,
      isReady,
      readyPlayers: newReadyPlayers,
      shouldAutoStart,
    });
  }

  public async handleAutoStart(
    gameId: string
  ): Promise<GameStartResult | null> {
    // Use existing start game logic but fetch game by ID
    const game = await this.gameService.getGameEntity(gameId);

    try {
      GameStateValidator.validateGameNotFinished(game);
    } catch {
      return null;
    }

    if (ValueUtils.isValidDate(game.startedAt)) {
      // Game already started, no need to auto-start
      return null;
    }

    const firstRound = await this.packageStore.getRound(game.id, 0);
    const gameState = GameStartLogic.buildInitialGameState(game, firstRound);

    game.startedAt = new Date();
    game.gameState = gameState;
    await this.gameService.updateGame(game);

    return GameStartLogic.buildResult(game);
  }

  /**
   * Changes player role
   */
  public async changePlayerRole(
    actionContext: ActionContext,
    newRole: PlayerRole,
    targetPlayerId: number | null
  ): Promise<RoleChangeResult> {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(actionContext);

    targetPlayerId = targetPlayerId ?? currentPlayer!.meta.id;

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.socketGameValidationService.validatePlayerRoleChange(
      currentPlayer,
      targetPlayer,
      newRole,
      game
    );

    // Process role change via Logic class
    const mutation = PlayerRoleChangeLogic.processRoleChange(
      game,
      targetPlayer,
      newRole
    );

    // Handle statistics based on role change
    if (newRole === PlayerRole.PLAYER) {
      // Clear leftAt time if changing to player role
      await this.playerGameStatsService.clearPlayerLeftAtTime(
        game.id,
        targetPlayerId
      );
    } else if (newRole === PlayerRole.SPECTATOR && mutation.wasPlayer) {
      // End player session if they were previously a player
      await this.playerGameStatsService.endPlayerSession(
        game.id,
        targetPlayerId,
        new Date()
      );
    }

    await this.gameService.updateGame(game);

    return PlayerRoleChangeLogic.buildResult({ game, targetPlayer });
  }

  /**
   * Updates player restrictions (mute/restrict/ban).
   *
   * Flow:
   * 1. Fetch context and validate
   * 2. Apply restrictions (via Logic class)
   * 3. Handle ban (remove from game) or restriction (change to spectator)
   * 4. Persist and return result (via Logic.buildResult)
   */
  public async updatePlayerRestrictions(
    actionContext: ActionContext,
    userData: SocketRedisUserData | null,
    game: Game,
    targetPlayerId: number,
    restrictions: RestrictionUpdateInput
  ): Promise<PlayerRestrictionResult> {
    const currentPlayer = game.getPlayer(userData!.id, {
      fetchDisconnected: false,
    });

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: true,
    });

    if (!targetPlayer || !currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.socketGameValidationService.validatePlayerManagement(currentPlayer);

    // Apply restrictions using Logic class
    const mutation = PlayerRestrictionLogic.applyRestrictions(
      targetPlayer,
      restrictions
    );

    // Handle ban scenario
    if (mutation.shouldBan) {
      await this.gameService.updateGame(game);

      const leaveResult = await this.playerLeaveService.handlePlayerLeave(
        actionContext.socketId,
        game,
        userData,
        {
          reason: PlayerLeaveReason.BAN,
          targetUserId: targetPlayerId,
          bannedBy: currentPlayer!.meta.id,
          cleanupSession: false,
        }
      );

      await this.forceDisconnectUserSocket(targetPlayerId);

      return PlayerRestrictionLogic.buildBanResult({
        game: leaveResult.game,
        targetPlayer,
        restrictions,
      });
    }

    // Handle restriction to spectator scenario
    if (mutation.shouldRestrictToSpectator) {
      const gameStateCleanupBroadcasts =
        await this.playerLeaveService.handlePlayerGameStateCleanup(
          game,
          targetPlayerId
        );

      if (PlayerRestrictionLogic.wasPlayerRole(mutation.originalRole)) {
        await this.playerGameStatsService.endPlayerSession(
          game.id,
          targetPlayerId,
          new Date()
        );
      }

      await this.gameService.updateGame(game);

      return PlayerRestrictionLogic.buildRestrictResult({
        game,
        targetPlayer,
        newRole: mutation.newRole!,
        restrictions,
        gameStateCleanupBroadcasts,
      });
    }

    // Simple restriction update (no role change)
    await this.gameService.updateGame(game);
    return PlayerRestrictionLogic.buildSimpleResult({
      game,
      targetPlayer,
      restrictions,
    });
  }

  /**
   * Forces disconnection of the socket for a specific user
   */
  private async forceDisconnectUserSocket(userId: number): Promise<void> {
    try {
      // Find the user's socket ID efficiently using Redis lookup
      const socketId = await this.socketUserDataService.findSocketIdByUserId(
        userId
      );

      if (!socketId) {
        this.logger.debug(`No active socket found for banned user ${userId}`, {
          prefix: LogPrefix.SOCKET,
          userId,
        });
        return;
      }

      // Force disconnect across all instances via Redis adapter
      this.logger.debug(
        `Force disconnecting socket ${socketId} for banned user ${userId}`,
        {
          prefix: LogPrefix.SOCKET,
          userId,
          socketId,
        }
      );

      this.gamesNsp.in(socketId).disconnectSockets(true);
    } catch (error) {
      this.logger.error(`Failed to force disconnect user ${userId}`, {
        prefix: LogPrefix.SOCKET,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Kicks a player from the game
   */
  public async kickPlayer(
    actionContext: ActionContext,
    game: Game,
    userData: SocketRedisUserData | null,
    targetPlayerId: number
  ): Promise<{
    game: Game;
    targetPlayerId: number;
    broadcasts: BroadcastEvent[];
  }> {
    const currentPlayer = game.getPlayer(userData!.id, {
      fetchDisconnected: false,
    });

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer || !currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.socketGameValidationService.validatePlayerManagement(currentPlayer);

    // Use PlayerLeaveService to handle the removal
    const result = await this.playerLeaveService.handlePlayerLeave(
      actionContext.socketId,
      game,
      userData,
      {
        reason: PlayerLeaveReason.KICK,
        targetUserId: targetPlayerId,
        kickedBy: currentPlayer.meta.id,
        cleanupSession: false,
      }
    );

    return {
      game: result.game,
      targetPlayerId,
      broadcasts: result.broadcasts || [],
    };
  }

  /**
   * Changes player score.
   *
   * Flow:
   * 1. Fetch context and validate
   * 2. Apply score change (via Logic class)
   * 3. Persist and return result (via Logic.buildResult)
   */
  public async changePlayerScore(
    ctx: ActionContext,
    targetPlayerId: number,
    newScore: number
  ): Promise<PlayerScoreChangeResult> {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.socketGameValidationService.validatePlayerScoreChange(currentPlayer);

    // Apply score change using Logic class
    const appliedScore = PlayerScoreChangeLogic.applyScore(
      game,
      targetPlayerId,
      newScore
    );

    await this.gameService.updateGame(game);

    return PlayerScoreChangeLogic.buildResult({
      game,
      targetPlayerId,
      newScore: appliedScore,
    });
  }

  /**
   * Changes turn player.
   *
   * Flow:
   * 1. Fetch context and validate
   * 2. Apply turn change (via Logic class)
   * 3. Persist and return result (via Logic.buildResult)
   */
  public async changeTurnPlayer(
    ctx: ActionContext,
    newTurnPlayerId: number | null
  ): Promise<TurnPlayerChangeResult> {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.socketGameValidationService.validateTurnPlayerChange(
      currentPlayer,
      game,
      newTurnPlayerId
    );

    // Apply turn change using Logic class
    TurnPlayerChangeLogic.applyTurnChange(game, newTurnPlayerId);

    await this.gameService.updateGame(game);

    return TurnPlayerChangeLogic.buildResult({ game, newTurnPlayerId });
  }

  /**
   * Changes player slot.
   *
   * Flow:
   * 1. Fetch context and validate
   * 2. Apply slot change (via Logic class)
   * 3. Persist and return result (via Logic.buildResult)
   */
  public async changePlayerSlot(
    ctx: ActionContext,
    targetSlot: number,
    targetPlayerId?: number
  ): Promise<PlayerSlotChangeResult> {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    targetPlayerId = targetPlayerId ?? currentPlayer.meta.id;

    // Determine which player's slot to change
    let targetPlayer: Player | null;

    if (targetPlayerId !== currentPlayer.meta.id) {
      // Showman changing another player's slot
      targetPlayer = game.getPlayer(targetPlayerId, {
        fetchDisconnected: false,
      });
      if (!targetPlayer) {
        throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
      }
    } else {
      // Player changing their own slot
      targetPlayer = currentPlayer;
    }

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.socketGameValidationService.validatePlayerSlotChange(
      currentPlayer,
      game,
      targetSlot,
      targetPlayer
    );

    // Apply slot change using Logic class
    PlayerSlotChangeLogic.applySlotChange(targetPlayer, targetSlot);

    await this.gameService.updateGame(game);

    return PlayerSlotChangeLogic.buildResult({
      game,
      player: targetPlayer,
      newSlot: targetSlot,
    });
  }

  /**
   * **Warning:** This method bypasses host check, so it can be used only in
   * automated flows (e.g. when everyone leaves and game is finished)
   */
  public async deleteGameInternally(gameId: string) {
    await this.gameService.deleteInternally(gameId);
  }

  public async getGameStateBroadcastMap(
    socketIds: string[],
    game: Game
  ): Promise<Map<string, GameStateDTO>> {
    // Use the injected question service for broadcast map
    return this.socketIOQuestionService.getGameStateBroadcastMap(
      socketIds,
      game
    );
  }
}
