import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { UserService } from "application/services/user/UserService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
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
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ShowmanAction } from "domain/types/game/ShowmanAction";
import { GameJoinData } from "domain/types/socket/game/GameJoinData";
import { GameJoinResult } from "domain/types/socket/game/GameJoinResult";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class SocketIOGameService {
  constructor(
    private readonly socketUserDataService: SocketUserDataService,
    private readonly gameService: GameService,
    private readonly userService: UserService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    //
  }

  public getGameEntity(gameId: string, updatedTTL?: number): Promise<Game> {
    return this.gameService.getGameEntity(gameId, updatedTTL);
  }

  public async joinPlayer(
    data: GameJoinData,
    socketId: string
  ): Promise<GameJoinResult> {
    const user = await this._fetchUser(socketId);
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

    // Now check role availability after restriction checks
    if (data.role === PlayerRole.PLAYER && !game.checkFreeSlot()) {
      throw new ClientError(ClientResponse.GAME_IS_FULL);
    }

    if (data.role === PlayerRole.SHOWMAN && game.checkShowmanSlotIsTaken()) {
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

    return { game, player };
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

    return game;
  }

  public async leaveLobby(socketId: string): Promise<GameLobbyLeaveData> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const gameId = game.id;
    const userSession = context.userSession;

    if (!game.hasPlayer(userSession.id)) {
      return { emit: false };
    }

    game.removePlayer(userSession.id);

    // Remove player from ready list if they were ready
    if (game.gameState.readyPlayers) {
      game.gameState.readyPlayers = game.gameState.readyPlayers.filter(
        (playerId) => playerId !== userSession.id
      );
    }

    await this.socketUserDataService.update(socketId, {
      id: JSON.stringify(userSession.id),
      gameId: JSON.stringify(null),
    });
    await this.gameService.updateGame(game);

    return { emit: true, data: { userId: userSession.id, gameId } };
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

    const roundHandler = this.roundHandlerFactory.createFromGame(game);
    roundHandler.validateRoundProgression(game);

    const { isGameFinished, nextGameState } =
      await roundHandler.handleRoundProgression(game, {
        forced: true,
      });

    if (isGameFinished || nextGameState) {
      await this.gameService.updateGame(game);
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

    // Update player role
    targetPlayer.role = newRole;

    // If changing to player, assign a slot
    if (newRole === PlayerRole.PLAYER) {
      const firstFreeSlot = this._getFirstFreeSlotIndex(game);
      if (firstFreeSlot === -1) {
        throw new ClientError(ClientResponse.GAME_IS_FULL);
      }
      targetPlayer.gameSlot = firstFreeSlot;
    } else if (newRole === PlayerRole.SPECTATOR) {
      targetPlayer.gameSlot = null;
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
  ): Promise<{ game: Game; targetPlayer: PlayerDTO; wasRemoved: boolean }> {
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

    // Update restrictions
    targetPlayer.isMuted = restrictions.muted;
    targetPlayer.isRestricted = restrictions.restricted;
    targetPlayer.isBanned = restrictions.banned;

    // If player is banned, remove them from the game
    if (restrictions.banned) {
      game.removePlayer(targetPlayerId);

      // Remove from ready players list if they were ready
      if (game.gameState.readyPlayers) {
        game.gameState.readyPlayers = game.gameState.readyPlayers.filter(
          (playerId) => playerId !== targetPlayerId
        );
      }
    } else if (
      restrictions.restricted &&
      targetPlayer.role === PlayerRole.PLAYER
    ) {
      // If player is restricted (but not banned), change role to spectator
      targetPlayer.role = PlayerRole.SPECTATOR;
      targetPlayer.gameSlot = null;
    }

    await this.gameService.updateGame(game);

    return {
      game,
      targetPlayer: targetPlayer.toDTO(),
      wasRemoved: restrictions.banned,
    };
  }

  /**
   * Kicks a player from the game
   */
  public async kickPlayer(
    socketId: string,
    targetPlayerId: number
  ): Promise<{ game: Game; targetPlayerId: number }> {
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

    // Remove player from the game
    game.removePlayer(targetPlayerId);

    // Remove from ready players list if they were ready
    if (game.gameState.readyPlayers) {
      game.gameState.readyPlayers = game.gameState.readyPlayers.filter(
        (playerId) => playerId !== targetPlayerId
      );
    }

    await this.gameService.updateGame(game);

    return {
      game,
      targetPlayerId,
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
    targetPlayer.score = newScore;

    await this.gameService.updateGame(game);

    return {
      game,
      targetPlayerId,
      newScore,
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

    if (
      targetPlayerId !== currentPlayer.meta.id
    ) {
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

  private async _fetchUser(socketId: string): Promise<UserDTO> {
    const userData = await this.socketGameContextService.fetchUserSocketData(
      socketId
    );

    const user = await this.userService.get(userData.id);
    if (!user) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
    return user;
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
