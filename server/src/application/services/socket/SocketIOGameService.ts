import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { UserService } from "application/services/user/UserService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
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

    if (data.role === PlayerRole.PLAYER && !game.checkFreeSlot()) {
      throw new ClientError(ClientResponse.GAME_IS_FULL);
    }

    if (data.role === PlayerRole.SHOWMAN && game.checkShowmanSlot()) {
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

    if (player.isRestricted && data.role !== PlayerRole.SPECTATOR) {
      game.removePlayer(player.meta.id);
      await this.gameService.updateGame(game);
      throw new ClientError(ClientResponse.YOU_ARE_RESTRICTED);
    }

    if (player.isBanned) {
      game.removePlayer(player.meta.id);
      await this.gameService.updateGame(game);
      throw new ClientError(ClientResponse.YOU_ARE_BANNED);
    }

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
