import { UserService } from "application/services/user/UserService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { SECOND_MS } from "domain/constants/time";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { GameLobbyLeaveData } from "domain/types/game/GameRoomLeaveData";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameJoinData } from "domain/types/socket/game/GameJoinData";
import { GameJoinResult } from "domain/types/socket/game/GameJoinResult";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import { GameService } from "../game/GameService";

export class SocketIOGameService {
  constructor(
    private readonly socketUserDataService: SocketUserDataService,
    private readonly gameService: GameService,
    private readonly userService: UserService
  ) {
    //
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

    if (game.finishedAt !== null) {
      throw new ClientError(ClientResponse.GAME_FINISHED);
    }

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
    const userData = await this._fetchUserSocketData(socketId);
    const gameId = userData.gameId;

    if (!gameId) {
      throw new ClientError(ClientResponse.NOT_IN_GAME);
    }

    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );
    const player = game.getPlayer(userData.id, { fetchDisconnected: false });

    if (player?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_START);
    }

    if (ValueUtils.isValidDate(game.startedAt)) {
      throw new ClientError(ClientResponse.GAME_ALREADY_STARTED);
    }

    const gameState: GameStateDTO = {
      currentRound: GameStateMapper.getGameRound(game.package, 0),
      isPaused: false,
      questionState: QuestionState.CHOOSING,
      answeredPlayers: null,
      answeringPlayer: null,
      currentQuestion: null,
      readyPlayers: null,
      timer: null,
    };

    game.startedAt = new Date();
    game.gameState = gameState;
    await this.gameService.updateGame(game);

    return game;
  }

  public async leaveLobby(socketId: string): Promise<GameLobbyLeaveData> {
    const userData = await this._fetchUserSocketData(socketId);
    const gameId = userData.gameId;

    if (!gameId) {
      throw new ClientError(ClientResponse.NOT_IN_GAME);
    }

    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );
    if (!game.hasPlayer(userData.id)) return { emit: false };

    game.removePlayer(userData.id);

    await this.socketUserDataService.update(socketId, {
      id: JSON.stringify(userData.id),
      gameId: JSON.stringify(null),
    });
    await this.gameService.updateGame(game);

    return { emit: true, data: { userId: userData.id, gameId: game.id } };
  }

  public async handleNextRound(socketId: string) {
    const userData = await this._fetchUserSocketData(socketId);
    const gameId = userData.gameId;

    if (!gameId) {
      throw new ClientError(ClientResponse.NOT_IN_GAME);
    }

    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );
    this._validateGameStatus(game);

    const player = game.getPlayer(userData.id, { fetchDisconnected: false });

    if (player?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_NEXT_ROUND);
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    const currentQuestion = game.gameState.currentQuestion;

    let questionData: PackageQuestionDTO | null = null;

    if (currentQuestion) {
      questionData =
        GameQuestionMapper.getQuestionAndTheme(
          game.package,
          game.gameState.currentRound!.id,
          game.gameState.currentQuestion!.id!
        )?.question ?? null;
    }

    const { isGameFinished, nextGameState } = game.getProgressionState();

    if (isGameFinished || nextGameState) {
      await this.gameService.updateGame(game);
    }

    return { game, isGameFinished, nextGameState, questionData };
  }

  public async handleGameUnpause(socketId: string) {
    const userData = await this._fetchUserSocketData(socketId);
    const gameId = userData.gameId;

    if (!gameId) {
      throw new ClientError(ClientResponse.NOT_IN_GAME);
    }

    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );

    if (game.finishedAt !== null) {
      throw new ClientError(ClientResponse.GAME_FINISHED);
    }

    const player = game.getPlayer(userData.id, { fetchDisconnected: false });
    const gameState = game.gameState;

    if (!gameState) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    if (player?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_UNPAUSE);
    }

    const questionState = gameState.questionState;

    const timer = await this.gameService.getTimer(game.id, questionState!);

    if (timer) {
      await this.gameService.clearTimer(game.id, questionState!);
    }

    game.unpause();
    game.setTimer(timer);
    await this.gameService.updateGame(game);

    return { game, timer };
  }

  public async handleGamePause(socketId: string) {
    const userData = await this._fetchUserSocketData(socketId);
    const gameId = userData.gameId;

    if (!gameId) {
      throw new ClientError(ClientResponse.NOT_IN_GAME);
    }

    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );
    this._validateGameStatus(game);

    const player = game.getPlayer(userData.id, { fetchDisconnected: false });

    if (player?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_PAUSE);
    }

    const gameState = game.gameState;

    if (!gameState) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    const questionState = gameState.questionState;

    const timer = await this.gameService.getTimer(game.id);
    if (timer) {
      timer.elapsedMs = Date.now() - new Date(timer.startedAt).getTime();
      await this.gameService.saveTimer(
        timer,
        game.id,
        Math.ceil(GAME_TTL_IN_SECONDS * SECOND_MS * 1.25), // Convert to ms
        questionState!
      );
    }
    game.pause();
    game.setTimer(timer);
    await this.gameService.updateGame(game);

    return { game, timer };
  }

  public async removePlayerAuth(socketId: string) {
    return this.socketUserDataService.remove(socketId);
  }

  private async _fetchUserSocketData(socketId: string) {
    const userData = await this.socketUserDataService.getSocketData(socketId);

    if (!userData) {
      throw new ClientError(ClientResponse.SOCKET_USER_NOT_AUTHENTICATED);
    }

    return userData;
  }

  private async _fetchUser(socketId: string): Promise<UserDTO> {
    const userData = await this._fetchUserSocketData(socketId);

    const user = await this.userService.get(userData.id);
    if (!user) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
    return user;
  }

  private _validateGameStatus(game: Game) {
    if (game.gameState.isPaused) {
      throw new ClientError(ClientResponse.GAME_IS_PAUSED);
    }

    if (game.finishedAt !== null) {
      throw new ClientError(ClientResponse.GAME_FINISHED);
    }
  }
}
