import { type Namespace } from "socket.io";

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
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { GameJoinLogic } from "domain/logic/game/GameJoinLogic";
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
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { GameLobbyLeaveData } from "domain/types/game/GameRoomLeaveData";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ShowmanAction } from "domain/types/game/ShowmanAction";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { GameJoinData } from "domain/types/socket/game/GameJoinData";
import { GameJoinResult } from "domain/types/socket/game/GameJoinResult";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

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
    private readonly logger: ILogger,
    private readonly gameNamespace: Namespace
  ) {
    //
  }

  public getGameEntity(gameId: string, updatedTTL?: number): Promise<Game> {
    return this.gameService.getGameEntity(gameId, updatedTTL);
  }

  /**
   * Join player to game.
   *
   * Flow:
   * 1. Fetch game and check existing player
   * 2. Validate preconditions (via Logic class)
   * 3. Add player to game
   * 4. Update socket session
   * 5. Manage player statistics
   * 6. Return result (via Logic.buildResult)
   */
  public async joinPlayer(
    data: GameJoinData,
    user: UserDTO,
    socketId: string
  ): Promise<GameJoinResult> {
    const game = await this.gameService.getGameEntity(
      data.gameId,
      GAME_TTL_IN_SECONDS
    );

    GameStateValidator.validateGameNotFinished(game);

    // Check existing player
    const existingPlayer = game.getPlayer(user.id, { fetchDisconnected: true });

    // Validate using Logic class
    GameJoinLogic.validate({
      game,
      userId: user.id,
      role: data.role,
      existingPlayer,
      targetSlot: data.targetSlot,
      password: data.password,
    });

    // Add player to game
    const player = await game.addPlayer(
      {
        id: user.id,
        username: user.username,
        avatar: user.avatar ?? null,
      },
      data.role,
      data.targetSlot
    );

    // Update socket session
    await this.socketUserDataService.update(socketId, {
      id: JSON.stringify(user.id),
      gameId: data.gameId,
    });
    await this.gameService.updateGame(game);

    // Manage player statistics based on Logic class checks
    if (GameJoinLogic.shouldInitializeStats(existingPlayer, data.role)) {
      await this.playerGameStatsService.initializePlayerSession(
        data.gameId,
        user.id,
        new Date()
      );
    } else if (GameJoinLogic.shouldClearLeftAt(existingPlayer, data.role)) {
      await this.playerGameStatsService.clearPlayerLeftAtTime(
        data.gameId,
        user.id
      );
    }

    return GameJoinLogic.buildResult({ game, player });
  }

  public async startGame(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;

    this.socketGameValidationService.validateShowmanRole(
      context.currentPlayer,
      ShowmanAction.START
    );

    GameStateValidator.validateGameNotFinished(game);

    if (ValueUtils.isValidDate(game.startedAt)) {
      throw new ClientError(ClientResponse.GAME_ALREADY_STARTED);
    }

    const gameState = GameStartLogic.buildInitialGameState(game);

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
        gameId: game.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return GameStartLogic.buildResult(game);
  }

  public async leaveLobby(
    socketId: string,
    reason: PlayerLeaveReason = PlayerLeaveReason.LEAVE
  ): Promise<GameLobbyLeaveData> {
    const result = await this.playerLeaveService.handlePlayerLeave(socketId, {
      reason,
    });

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
      data: { userId: result.userId, gameId: result.game.id },
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
  public async handleNextRound(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;

    this.socketGameValidationService.validateNextRound(
      context.currentPlayer,
      game
    );

    // Get current question data using Logic class
    const questionData = RoundProgressionLogic.getCurrentQuestionData(game);

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

  public async handleGameUnpause(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;

    this.socketGameValidationService.validateGameUnpause(
      context.currentPlayer,
      game
    );

    return this.socketGameTimerService.unpauseGameTimer(game);
  }

  public async handleGamePause(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;

    this.socketGameValidationService.validateGamePause(
      context.currentPlayer,
      game
    );

    return this.socketGameTimerService.pauseGameTimer(game);
  }

  public async removePlayerAuth(socketId: string) {
    return this.socketUserDataService.remove(socketId);
  }

  public async setPlayerReadiness(socketId: string, isReady: boolean) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

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

    const gameState = GameStartLogic.buildInitialGameState(game);

    game.startedAt = new Date();
    game.gameState = gameState;
    await this.gameService.updateGame(game);

    return GameStartLogic.buildResult(game);
  }

  /**
   * Changes player role
   */
  public async changePlayerRole(
    socketId: string,
    newRole: PlayerRole,
    targetPlayerId: number | null
  ): Promise<RoleChangeResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const { game, currentPlayer } = context;

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
    socketId: string,
    targetPlayerId: number,
    restrictions: RestrictionUpdateInput
  ): Promise<PlayerRestrictionResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const { game, currentPlayer } = context;

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: true,
    });

    if (!targetPlayer) {
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
        socketId,
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
        this.logger.debug(`No active socket found for banned user ${userId}`);
        return;
      }

      // Get the specific socket and disconnect it
      const socket = this.gameNamespace.sockets.get(socketId);
      if (socket) {
        this.logger.debug(
          `Force disconnecting socket ${socketId} for banned user ${userId}`
        );
        socket.disconnect(true); // Force disconnect
      } else {
        this.logger.debug(
          `Socket ${socketId} not found in namespace for user ${userId}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to force disconnect user ${userId}:`,
        error as object
      );
    }
  }

  /**
   * Kicks a player from the game
   */
  public async kickPlayer(
    socketId: string,
    targetPlayerId: number
  ): Promise<{
    game: Game;
    targetPlayerId: number;
    broadcasts: BroadcastEvent[];
  }> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const { game, currentPlayer } = context;

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.socketGameValidationService.validatePlayerManagement(currentPlayer);

    // Use PlayerLeaveService to handle the removal
    const result = await this.playerLeaveService.handlePlayerLeave(socketId, {
      reason: PlayerLeaveReason.KICK,
      targetUserId: targetPlayerId,
      kickedBy: currentPlayer.meta.id,
      cleanupSession: false,
    });

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
    socketId: string,
    targetPlayerId: number,
    newScore: number
  ): Promise<PlayerScoreChangeResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const { game, currentPlayer } = context;

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
    socketId: string,
    newTurnPlayerId: number | null
  ): Promise<TurnPlayerChangeResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const { game, currentPlayer } = context;

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
    socketId: string,
    targetSlot: number,
    targetPlayerId?: number
  ): Promise<PlayerSlotChangeResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const { game, currentPlayer } = context;

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
    gameId: string,
    gameState: GameStateDTO
  ): Promise<Map<string, GameStateDTO>> {
    // If game is not provided but gameId is, fetch the game
    const game = await this.gameService.getGameEntity(gameId);

    if (!game) {
      throw new ServerError(
        `Game not found for broadcast filtering: ${gameId}`
      );
    }

    // Use the injected question service for broadcast map
    return this.socketIOQuestionService.getGameStateBroadcastMap(
      socketIds,
      game,
      gameState
    );
  }
}
