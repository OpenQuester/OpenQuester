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
import { GAME_TTL_IN_SECONDS, SCORE_ABS_LIMIT } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { GameLobbyLeaveData } from "domain/types/game/GameRoomLeaveData";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ShowmanAction } from "domain/types/game/ShowmanAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
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

    // Check existing player restrictions FIRST before checking role availability
    const existingPlayer = game.getPlayer(user.id, { fetchDisconnected: true });
    if (existingPlayer) {
      // Banned players cannot join at all
      if (existingPlayer.isBanned) {
        throw new ClientError(ClientResponse.YOU_ARE_BANNED);
      }

      // Restricted players can only join as spectators
      if (existingPlayer.isRestricted && data.role !== PlayerRole.SPECTATOR) {
        throw new ClientError(ClientResponse.YOU_ARE_RESTRICTED);
      }
    }

    // Prevent NEW players from joining as PLAYER during final round
    // Existing disconnected players who were part of the final round can rejoin
    const isFinalRound =
      game.gameState.currentRound?.type === PackageRoundType.FINAL;
    const isNewPlayer =
      !existingPlayer || existingPlayer.role !== PlayerRole.PLAYER;
    if (isFinalRound && data.role === PlayerRole.PLAYER && isNewPlayer) {
      throw new ClientError(ClientResponse.CANNOT_JOIN_FINAL_ROUND_AS_PLAYER);
    }

    // Now check role availability after restriction checks
    if (data.role === PlayerRole.PLAYER && !game.checkFreeSlot()) {
      throw new ClientError(ClientResponse.GAME_IS_FULL);
    }

    // Check if showman slot is taken - use proper filtering that includes showmen
    const showman = game.players.find(
      (p) =>
        p.role === PlayerRole.SHOWMAN &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    // Joining player is showman and showman is taken
    const showmanAndTaken = data.role === PlayerRole.SHOWMAN && !!showman;

    if (showmanAndTaken && existingPlayer?.meta.id !== showman.meta.id) {
      throw new ClientError(ClientResponse.SHOWMAN_IS_TAKEN);
    }

    const player = await game.addPlayer(
      {
        id: user.id,
        username: user.username,
        avatar: user.avatar ?? null,
      },
      data.role
    );

    await this.socketUserDataService.update(socketId, {
      id: JSON.stringify(user.id),
      gameId: data.gameId,
    });
    await this.gameService.updateGame(game);

    // Initialize or clear player statistics in Redis for live tracking
    if (data.role === PlayerRole.PLAYER) {
      await this.managePlayerLiveSession(existingPlayer, data, user);
    }

    return { game, player };
  }

  /**
   * Manages player live session in Redis when player joins
   */
  private async managePlayerLiveSession(
    existingPlayer: Player | null,
    data: GameJoinData,
    user: UserDTO
  ): Promise<void> {
    if (!existingPlayer) {
      // New player - initialize session
      await this.playerGameStatsService.initializePlayerSession(
        data.gameId,
        user.id,
        new Date()
      );
    } else {
      // Existing player rejoining as player - clear leftAt time
      await this.playerGameStatsService.clearPlayerLeftAtTime(
        data.gameId,
        user.id
      );
    }
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

    const currentTurnPlayerId = game.getRandomTurnPlayer();

    const gameState: GameStateDTO = {
      currentRound: GameStateMapper.getGameRound(game.package, 0),
      isPaused: false,
      questionState: QuestionState.CHOOSING,
      answeredPlayers: null,
      answeringPlayer: null,
      currentQuestion: null,
      readyPlayers: null,
      timer: null,
      currentTurnPlayerId,
      skippedPlayers: null,
    };

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

    return game;
  }

  public async leaveLobby(socketId: string): Promise<GameLobbyLeaveData> {
    const result = await this.playerLeaveService.handlePlayerLeave(socketId, {
      reason: PlayerLeaveReason.LEAVE,
    });

    if (!result.shouldEmitLeave) {
      return { emit: false };
    }

    return {
      emit: true,
      data: { userId: result.userId, gameId: result.game.id },
      broadcasts: result.broadcasts,
    };
  }

  public async handleNextRound(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;

    this.socketGameValidationService.validateNextRound(
      context.currentPlayer,
      game
    );

    const currentRound = game.gameState.currentRound;
    const currentQuestion = game.gameState.currentQuestion;

    let questionData: PackageQuestionDTO | null = null;

    if (currentQuestion) {
      questionData =
        GameQuestionMapper.getQuestionAndTheme(
          game.package,
          currentRound!.id,
          currentQuestion.id!
        )?.question ?? null;
    }

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

    // If game is finished, complete the statistics collection
    if (isGameFinished) {
      await this.gameStatisticsCollectorService.finishCollection(game.id);
    }

    return { game, isGameFinished, nextGameState, questionData };
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
    const currentReadyPlayers = game.gameState.readyPlayers || [];

    // Update ready state
    let newReadyPlayers: number[];
    if (isReady) {
      // Add player to ready list if not already present
      newReadyPlayers = currentReadyPlayers.includes(playerId)
        ? currentReadyPlayers
        : [...currentReadyPlayers, playerId];
    } else {
      // Remove player from ready list
      newReadyPlayers = currentReadyPlayers.filter((id) => id !== playerId);
    }

    // Update game state
    game.gameState.readyPlayers = newReadyPlayers;
    await this.gameService.updateGame(game);

    // Check if auto-start should trigger
    const shouldAutoStart = game.isEveryoneReady();

    return {
      game,
      playerId,
      isReady,
      readyPlayers: newReadyPlayers,
      shouldAutoStart,
    };
  }

  public async handleAutoStart(gameId: string) {
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

    const currentTurnPlayerId = game.getRandomTurnPlayer();

    const gameState: GameStateDTO = {
      currentRound: GameStateMapper.getGameRound(game.package, 0),
      isPaused: false,
      questionState: QuestionState.CHOOSING,
      answeredPlayers: null,
      answeringPlayer: null,
      currentQuestion: null,
      readyPlayers: null, // Clear ready state when game starts
      timer: null,
      currentTurnPlayerId,
      skippedPlayers: null,
    };

    game.startedAt = new Date();
    game.gameState = gameState;
    await this.gameService.updateGame(game);

    return {
      game,
      gameState,
    };
  }

  /**
   * Changes player role
   */
  public async changePlayerRole(
    socketId: string,
    newRole: PlayerRole,
    targetPlayerId: number | null
  ): Promise<{ game: Game; targetPlayer: PlayerDTO; players: PlayerDTO[] }> {
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

    // Store original role before changing it
    const originalRole = targetPlayer.role;

    // Update player role
    targetPlayer.role = newRole;

    // If changing to player, assign a slot
    if (newRole === PlayerRole.PLAYER) {
      const firstFreeSlot = this._getFirstFreeSlotIndex(game);
      if (firstFreeSlot === -1) {
        throw new ClientError(ClientResponse.GAME_IS_FULL);
      }
      targetPlayer.gameSlot = firstFreeSlot;

      // Clear leftAt time if changing to player role
      await this.playerGameStatsService.clearPlayerLeftAtTime(
        game.id,
        targetPlayerId
      );
    } else if (newRole === PlayerRole.SPECTATOR) {
      targetPlayer.gameSlot = null;

      // End player session if they were previously a player
      if (originalRole === PlayerRole.PLAYER) {
        await this.playerGameStatsService.endPlayerSession(
          game.id,
          targetPlayerId,
          new Date()
        );
      }
    }

    await this.gameService.updateGame(game);

    return {
      game,
      targetPlayer: targetPlayer.toDTO(),
      players: game.players.map((p) => p.toDTO()),
    };
  }

  /**
   * Updates player restrictions (mute/restrict/ban)
   */
  public async updatePlayerRestrictions(
    socketId: string,
    targetPlayerId: number,
    restrictions: { muted: boolean; restricted: boolean; banned: boolean }
  ): Promise<{
    game: Game;
    targetPlayer: PlayerDTO;
    wasRemoved: boolean;
    newRole?: PlayerRole;
  }> {
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

    // Store original role before making any changes
    const originalRole = targetPlayer.role;
    let newRole: PlayerRole | undefined;

    // Update restrictions
    targetPlayer.isMuted = restrictions.muted;
    targetPlayer.isRestricted = restrictions.restricted;
    targetPlayer.isBanned = restrictions.banned;

    // If player is banned, save the game first to persist the ban flag
    if (restrictions.banned) {
      await this.gameService.updateGame(game);

      // Now remove them from the game using PlayerLeaveService
      const leaveResult = await this.playerLeaveService.handlePlayerLeave(
        socketId,
        {
          reason: PlayerLeaveReason.BAN,
          targetUserId: targetPlayerId,
          bannedBy: currentPlayer!.meta.id,
          cleanupSession: false,
        }
      );

      // Force disconnect banned user's socket
      await this.forceDisconnectUserSocket(targetPlayerId);

      return {
        game: leaveResult.game,
        targetPlayer: targetPlayer.toDTO(),
        wasRemoved: true,
        newRole,
      };
    } else if (
      restrictions.restricted &&
      targetPlayer.role === PlayerRole.PLAYER
    ) {
      // If player is restricted (but not banned), change role to spectator
      targetPlayer.role = PlayerRole.SPECTATOR;
      targetPlayer.gameSlot = null;
      newRole = PlayerRole.SPECTATOR;

      // Clean up player statistics if they were a player
      if (originalRole === PlayerRole.PLAYER) {
        await this.playerGameStatsService.endPlayerSession(
          game.id,
          targetPlayerId,
          new Date()
        );
      }
    }

    await this.gameService.updateGame(game);

    return {
      game,
      targetPlayer: targetPlayer.toDTO(),
      wasRemoved: false,
      newRole,
    };
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
   * Changes player score
   */
  public async changePlayerScore(
    socketId: string,
    targetPlayerId: number,
    newScore: number
  ): Promise<{ game: Game; targetPlayerId: number; newScore: number }> {
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

    // Update score
    const appliedScore = ValueUtils.clampAbs(newScore, SCORE_ABS_LIMIT);
    targetPlayer.score = appliedScore;

    await this.gameService.updateGame(game);

    return {
      game,
      targetPlayerId,
      newScore: appliedScore,
    };
  }

  /**
   * Changes turn player
   */
  public async changeTurnPlayer(
    socketId: string,
    newTurnPlayerId: number | null
  ): Promise<{ game: Game; newTurnPlayerId: number | null }> {
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

    // Update turn player
    game.gameState.currentTurnPlayerId = newTurnPlayerId;

    await this.gameService.updateGame(game);

    return {
      game,
      newTurnPlayerId,
    };
  }

  /**
   * Changes player slot
   */
  public async changePlayerSlot(
    socketId: string,
    targetSlot: number,
    targetPlayerId?: number
  ): Promise<{
    game: Game;
    playerId: number;
    newSlot: number;
    updatedPlayers: PlayerDTO[];
  }> {
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

    // Update slot
    targetPlayer.gameSlot = targetSlot;

    await this.gameService.updateGame(game);

    return {
      game,
      playerId: targetPlayer.meta.id,
      newSlot: targetSlot,
      updatedPlayers: game.players.map((p) => p.toDTO()),
    };
  }

  /**
   * **Warning:** This method bypasses host check, so it can be used only in
   * automated flows (e.g. when everyone leaves and game is finished)
   */
  public async deleteGameInternally(gameId: string) {
    await this.gameService.deleteInternally(gameId);
  }

  /**
   * Helper method to get first free slot index
   */
  private _getFirstFreeSlotIndex(game: Game): number {
    const occupiedSlots = new Set(
      game.players
        .filter((p) => p.role === PlayerRole.PLAYER && p.gameSlot !== null)
        .map((p) => p.gameSlot)
    );

    for (let i = 0; i < game.maxPlayers; i++) {
      if (!occupiedSlots.has(i)) {
        return i;
      }
    }

    return -1;
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
