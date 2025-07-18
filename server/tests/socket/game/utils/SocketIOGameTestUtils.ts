import { type Express } from "express";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
import { Repository } from "typeorm";

import { Container, CONTAINER_TYPES } from "application/Container";
import { GameService } from "application/services/game/GameService";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { Game } from "domain/entities/game/Game";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameStartEventPayload } from "domain/types/socket/events/game/GameStartEventPayload";
import { PlayerReadinessBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameJoinData } from "domain/types/socket/game/GameJoinData";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { User } from "infrastructure/database/models/User";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { PackageUtils } from "tests/utils/PackageUtils";

export interface GameClientSocket extends ClientSocket {
  gameId?: string;
  role?: PlayerRole;
}

export interface GameTestSetup {
  gameId: string;
  showmanSocket: GameClientSocket;
  playerSockets: GameClientSocket[];
  spectatorSockets: GameClientSocket[];
  showmanUser: User;
  playerUsers: User[];
}

export class SocketGameTestUtils {
  private serverUrl: string;
  private packageUtils: PackageUtils;
  private gameService = Container.get<GameService>(CONTAINER_TYPES.GameService);
  private socketUserDataService = Container.get<SocketUserDataService>(
    CONTAINER_TYPES.SocketUserDataService
  );

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl + SOCKET_GAME_NAMESPACE;
    this.packageUtils = new PackageUtils();
  }

  public async joinGame(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole = PlayerRole.PLAYER
  ): Promise<string> {
    await this.joinSpecificGame(socket, gameId, role);
    return gameId;
  }

  public async joinSpecificGame(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const joinData: GameJoinData = { gameId, role };
      socket.once(SocketIOGameEvents.GAME_DATA, () => {
        socket.gameId = gameId;
        socket.role = role;
        resolve();
      });
      socket.emit(SocketIOGameEvents.JOIN, joinData);
    });
  }

  public async joinSpecificGameWithData(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole
  ): Promise<any> {
    return new Promise<any>((resolve) => {
      const joinData: GameJoinData = { gameId, role };
      socket.once(SocketIOGameEvents.GAME_DATA, (gameData) => {
        socket.gameId = gameId;
        socket.role = role;
        resolve(gameData);
      });
      socket.emit(SocketIOGameEvents.JOIN, joinData);
    });
  }

  public async leaveGame(socket: GameClientSocket): Promise<void> {
    return new Promise<void>((resolve) => {
      socket.once(SocketIOGameEvents.LEAVE, () => {
        socket.gameId = undefined;
        socket.role = undefined;
        resolve();
      });
      socket.emit(SocketIOGameEvents.LEAVE);
    });
  }

  public async disconnectAndCleanup(socket: GameClientSocket): Promise<void> {
    if (!socket) return;
    if (socket.connected) {
      socket.disconnect();
    }
    socket.removeAllListeners();
    socket.close();
  }

  public async createAndLoginUser(
    userRepo: Repository<User>,
    app: Express,
    username: string
  ): Promise<{ user: User; cookie: string }> {
    // Create user
    const user = userRepo.create({
      username,
      email: `${username}@test.com`,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await userRepo.save(user);

    // Login
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });

    if (loginRes.status !== 200) {
      throw new Error(
        `Failed to login user ${username}: ${JSON.stringify(loginRes.body)}`
      );
    }

    const cookie = loginRes.headers["set-cookie"];
    if (!cookie || !Array.isArray(cookie)) {
      throw new Error("No cookie received from login response");
    }

    return { user, cookie };
  }

  public async loginExistingUser(
    app: Express,
    userId: number
  ): Promise<{ cookie: string }> {
    // Login existing user by ID
    const loginRes = await request(app).post("/v1/test/login").send({ userId });

    if (loginRes.status !== 200) {
      throw new Error(
        `Failed to login existing user ${userId}: ${JSON.stringify(
          loginRes.body
        )}`
      );
    }

    const cookie = loginRes.headers["set-cookie"];
    if (!cookie || !Array.isArray(cookie)) {
      throw new Error("No cookie received from login response");
    }

    return { cookie };
  }

  private async authenticateSocket(
    app: Express,
    socket: GameClientSocket,
    cookie: string
  ): Promise<void> {
    const authRes = await request(app)
      .post("/v1/auth/socket")
      .set("Cookie", cookie)
      .send({ socketId: socket.id });

    if (authRes.status !== 200) {
      throw new Error(
        `Failed to authenticate socket: ${JSON.stringify(authRes.body)}`
      );
    }
  }

  public async createGameClient(
    app: Express,
    userRepo: Repository<User>
  ): Promise<{ socket: GameClientSocket; user: User; cookie: string }> {
    const username = `testuser_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const { user, cookie } = await this.createAndLoginUser(
      userRepo,
      app,
      username
    );

    const socket = Client(this.serverUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: false,
    }) as GameClientSocket;

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("[Socket Debug] Connection timeout after 5000ms"));
      }, 5000);

      socket.on("connect", async () => {
        clearTimeout(timeout);
        try {
          await this.authenticateSocket(app, socket, cookie);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    return { socket, user, cookie };
  }

  public async createUnauthenticatedGameClient(): Promise<GameClientSocket> {
    const socket = Client(this.serverUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: false,
    }) as GameClientSocket;

    // Wait for connection without authentication
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("[Socket Debug] Connection timeout after 5000ms"));
      }, 5000);

      socket.on("connect", () => {
        clearTimeout(timeout);
        resolve();
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    return socket;
  }

  public async setupGameTestEnvironment(
    userRepo: Repository<User>,
    app: Express,
    playerCount: number,
    spectatorCount: number,
    includeFinalRound: boolean = true
  ): Promise<GameTestSetup> {
    // Create showman
    const {
      socket: showmanSocket,
      gameId,
      user: showmanUser,
    } = await this.createGameWithShowman(app, userRepo, includeFinalRound);

    // Create players
    const playerSockets: GameClientSocket[] = [];
    const playerUsers: User[] = [];
    for (let i = 0; i < playerCount; i++) {
      const { socket, user } = await this.createGameClient(app, userRepo);
      await this.joinGame(socket, gameId, PlayerRole.PLAYER);
      playerSockets.push(socket as GameClientSocket);
      playerUsers.push(user);
    }

    // Create spectators
    const spectatorSockets: GameClientSocket[] = [];
    for (let i = 0; i < spectatorCount; i++) {
      const { socket } = await this.createGameClient(app, userRepo);
      await this.joinGame(socket, gameId, PlayerRole.SPECTATOR);
      spectatorSockets.push(socket as GameClientSocket);
    }

    return {
      gameId,
      showmanSocket: showmanSocket as GameClientSocket,
      playerSockets,
      spectatorSockets,
      showmanUser,
      playerUsers,
    };
  }

  async createGameWithShowman(
    app: Express,
    userRepo: Repository<User>,
    includeFinalRound: boolean = true
  ): Promise<{ socket: ClientSocket; gameId: string; user: User }> {
    // Create a test user and get authenticated socket
    const { socket, user, cookie } = await this.createGameClient(app, userRepo);

    // Create a test package
    const packageData = this.packageUtils.createTestPackageData(
      {
        id: user.id,
        username: user.username,
      },
      includeFinalRound
    );

    const packageRes = await request(app)
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageData });

    if (packageRes.status !== 200) {
      throw new Error(
        `Failed to create package: ${packageRes.status} - ${JSON.stringify(
          packageRes.body
        )}`
      );
    }

    const createdPackage = packageRes.body;
    const packageId = createdPackage.id;

    // Create game data
    const gameData: GameCreateDTO = {
      title: "Test Game " + Math.random().toString(36).substring(7),
      packageId: packageId,
      isPrivate: false,
      ageRestriction: AgeRestriction.NONE,
      maxPlayers: 10,
    };

    // Create the game via REST API
    const gameRes = await request(app)
      .post("/v1/games")
      .set("Cookie", cookie)
      .send(gameData);

    if (gameRes.status !== 200) {
      throw new Error(
        `Failed to create game: ${gameRes.status} - ${JSON.stringify(
          gameRes.body
        )}`
      );
    }

    const createdGame = gameRes.body;
    const gameId = createdGame.id;

    // Join the game as showman
    await this.joinGame(socket, gameId, PlayerRole.SHOWMAN);

    return { socket, gameId, user };
  }

  public async deleteGame(
    app: Express,
    gameId: string,
    cookie: string[]
  ): Promise<void> {
    const deleteRes = await request(app)
      .delete(`/v1/games/${gameId}`)
      .set("Cookie", cookie);

    if (![HttpStatus.OK, HttpStatus.NO_CONTENT].includes(deleteRes.status)) {
      throw new Error(
        `Failed to delete game: ${deleteRes.status} - ${JSON.stringify(
          deleteRes.body
        )}`
      );
    }
  }

  public async deleteGameAsCreator(
    app: Express,
    userRepo: Repository<User>,
    gameId: string
  ): Promise<void> {
    // Get the game to find the creator
    const game = await this.gameService.getGameEntity(gameId);

    // Get the creator user
    const creator = await userRepo.findOne({ where: { id: game.createdBy } });
    if (!creator) {
      throw new Error(`Game creator not found: ${game.createdBy}`);
    }

    // Login as the creator
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: creator.id });

    if (loginRes.status !== 200) {
      throw new Error(
        `Failed to login as creator: ${JSON.stringify(loginRes.body)}`
      );
    }

    const cookie = loginRes.headers["set-cookie"];
    if (!cookie || !Array.isArray(cookie)) {
      throw new Error("No cookie received from login response");
    }

    // Delete the game
    await this.deleteGame(app, gameId, cookie);
  }

  public async deleteGameWithClient(
    app: Express,
    gameId: string,
    clientData: { socket: GameClientSocket; user: User; cookie: string[] }
  ): Promise<void> {
    await this.deleteGame(app, gameId, clientData.cookie);
  }

  public async getSocketUserData(
    socket: GameClientSocket
  ): Promise<SocketRedisUserData | null> {
    if (!socket.id) return null;
    return await this.socketUserDataService.getSocketData(socket.id);
  }

  public async getGameState(gameId: string): Promise<GameStateDTO | null> {
    const game = await this.gameService.getGameEntity(gameId);
    return game?.gameState ?? null;
  }

  public async getFirstAvailableQuestionId(gameId: string): Promise<number> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      throw new Error("No themes found in current round");
    }

    // Find first theme with questions
    for (const theme of currentRound.themes) {
      if (theme.questions && theme.questions.length > 0) {
        // Find first unplayed question
        for (const question of theme.questions) {
          if (question.id && !question.isPlayed) {
            return question.id;
          }
        }
      }
    }

    throw new Error("No available questions found");
  }

  public async startGame(
    showmanSocket: GameClientSocket
  ): Promise<GameStartEventPayload> {
    return new Promise((resolve) => {
      showmanSocket.once(SocketIOGameEvents.START, resolve);
      showmanSocket.emit(SocketIOGameEvents.START);
    });
  }

  public async pickQuestion(
    showmanSocket: GameClientSocket,
    questionId?: number
  ): Promise<void> {
    let actualQuestionId = questionId;

    // If no questionId provided, find first available question
    if (!actualQuestionId) {
      const socketUserData = await this.getSocketUserData(showmanSocket);
      if (!socketUserData?.gameId) {
        throw new Error("Cannot determine game ID from socket");
      }
      actualQuestionId = await this.getFirstAvailableQuestionId(
        socketUserData.gameId
      );
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for QUESTION_DATA event"));
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeout);
        showmanSocket.removeListener(
          SocketIOGameEvents.QUESTION_DATA,
          onQuestionData
        );
      };

      const onQuestionData = () => {
        cleanup();
        resolve();
      };

      showmanSocket.once(SocketIOGameEvents.QUESTION_DATA, onQuestionData);
      showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
        questionId: actualQuestionId,
      });
    });
  }

  public async answerQuestion(
    playerSocket: GameClientSocket,
    showmanSocket: GameClientSocket
  ): Promise<void> {
    return new Promise((resolve) => {
      showmanSocket.once(SocketIOGameEvents.QUESTION_ANSWER, resolve);
      playerSocket.emit(SocketIOGameEvents.QUESTION_ANSWER);
    });
  }

  public async progressToNextRound(
    showmanSocket: GameClientSocket
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for NEXT_ROUND event"));
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeout);
        showmanSocket.removeListener(
          SocketIOGameEvents.NEXT_ROUND,
          onNextRound
        );
      };

      const onNextRound = () => {
        cleanup();
        resolve();
      };

      showmanSocket.once(SocketIOGameEvents.NEXT_ROUND, onNextRound);
      showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND);
    });
  }

  public async skipQuestion(showmanSocket: GameClientSocket): Promise<void> {
    return new Promise((resolve) => {
      showmanSocket.once(SocketIOGameEvents.QUESTION_FINISH, resolve);
      showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE);
    });
  }

  public async pauseGame(showmanSocket: GameClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for GAME_PAUSE event"));
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeout);
        showmanSocket.removeListener(SocketIOGameEvents.GAME_PAUSE, onPause);
      };

      const onPause = () => {
        cleanup();
        resolve();
      };

      showmanSocket.once(SocketIOGameEvents.GAME_PAUSE, onPause);
      showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE, {});
    });
  }

  public validateGameState(
    gameState: any, // TODO: Type
    expectedState: {
      isPaused?: boolean;
      questionState?: string;
      currentRound?: any; // TODO: Type
      answeringPlayer?: number | null;
      currentQuestion?: any; // TODO: Type
    }
  ): void {
    expect(gameState).toBeDefined();
    if (expectedState.isPaused !== undefined) {
      expect(gameState.isPaused).toBe(expectedState.isPaused);
    }
    if (expectedState.questionState !== undefined) {
      expect(gameState.questionState).toBe(expectedState.questionState);
    }
    if (expectedState.currentRound !== undefined) {
      expect(gameState.currentRound).toEqual(expectedState.currentRound);
    }
    if (expectedState.answeringPlayer !== undefined) {
      expect(gameState.answeringPlayer).toBe(expectedState.answeringPlayer);
    }
    if (expectedState.currentQuestion !== undefined) {
      expect(gameState.currentQuestion).toEqual(expectedState.currentQuestion);
    }
  }

  public validatePlayers(
    players: any[], // TODO: Type
    expected: {
      totalCount: number;
      showmanCount?: number; // Not more than one
      playerCount?: number;
      spectatorCount?: number;
    }
  ): void {
    expect(players).toHaveLength(expected.totalCount);

    if (expected.showmanCount !== undefined) {
      expect(players.filter((p) => p.role === PlayerRole.SHOWMAN)).toHaveLength(
        expected.showmanCount
      );
    }
    if (expected.playerCount !== undefined) {
      expect(players.filter((p) => p.role === PlayerRole.PLAYER)).toHaveLength(
        expected.playerCount
      );
    }
    if (expected.spectatorCount !== undefined) {
      expect(
        players.filter((p) => p.role === PlayerRole.SPECTATOR)
      ).toHaveLength(expected.spectatorCount);
    }
  }

  public async expectError(
    action: () => Promise<void>,
    expectedMessage: string
  ): Promise<void> {
    try {
      await action();
      fail("Expected action to throw an error");
    } catch (error: any) {
      expect(error.message).toBe(expectedMessage);
    }
  }

  public async cleanupGameClients(setup: GameTestSetup): Promise<void> {
    try {
      await this.disconnectAndCleanup(setup.showmanSocket);
      await Promise.all(
        setup.playerSockets.map((socket) => this.disconnectAndCleanup(socket))
      );
      await Promise.all(
        setup.spectatorSockets.map((socket) =>
          this.disconnectAndCleanup(socket)
        )
      );
    } catch (err) {
      console.error("Error during cleanup:", err);
    }
  }

  public async waitForEvent<T = any>(
    socket: GameClientSocket,
    event: string,
    timeout: number = 5000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const handler = (data: T) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeListener(event, handler); // Ensure listener is removed
        resolve(data);
      };

      const onTimeout = () => {
        timeoutId = null;
        socket.removeListener(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      };

      timeoutId = setTimeout(onTimeout, timeout);
      socket.once(event, handler);
    });
  }

  /**
   * Waits for a specified time to ensure that a specific event is NOT received.
   * If the event is received, the promise rejects immediately.
   * If the timeout completes without the event, the promise resolves successfully.
   */
  public async waitForNoEvent(
    socket: GameClientSocket,
    event: string,
    timeout: number = 150
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const handler = (data: any) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeListener(event, handler);
        reject(
          new Error(
            `Unexpected event received: ${event}. Data: ${JSON.stringify(data)}`
          )
        );
      };

      const onTimeout = () => {
        timeoutId = null;
        socket.removeListener(event, handler);
        resolve(); // Success - no event was received
      };

      timeoutId = setTimeout(onTimeout, timeout);
      socket.once(event, handler);
    });
  }

  public async getGameFromGameService(gameId: string): Promise<Game> {
    return this.gameService.getGameEntity(gameId);
  }

  public async updateGame(game: Game): Promise<void> {
    return this.gameService.updateGame(game);
  }

  /**
   * Directly set a player's score in the game entity and persist it.
   */
  public async setPlayerScore(
    gameId: string,
    playerId: number,
    score: number
  ): Promise<void> {
    const game = await this.getGameFromGameService(gameId);
    const player = game.getPlayer(playerId, { fetchDisconnected: true });
    if (!player) {
      throw new Error(`Player ${playerId} not found in game ${gameId}`);
    }
    player.score = score;
    await this.updateGame(game);
  }

  /**
   * Helper method to set a player as ready with socket event
   */
  public async setPlayerReady(playerSocket: GameClientSocket): Promise<void> {
    return new Promise((resolve) => {
      playerSocket.once(SocketIOGameEvents.PLAYER_READY, () => {
        resolve();
      });
      playerSocket.emit(SocketIOGameEvents.PLAYER_READY);
    });
  }

  /**
   * Helper method to set a player as unready with socket event
   */
  public async setPlayerUnready(playerSocket: GameClientSocket): Promise<void> {
    return new Promise((resolve) => {
      playerSocket.once(SocketIOGameEvents.PLAYER_UNREADY, () => {
        resolve();
      });
      playerSocket.emit(SocketIOGameEvents.PLAYER_UNREADY);
    });
  }

  /**
   * Wait for a player ready event with specific data
   */
  public async waitForPlayerReady(
    socket: GameClientSocket,
    expectedPlayerId?: number
  ): Promise<PlayerReadinessBroadcastData> {
    return new Promise((resolve) => {
      socket.once(
        SocketIOGameEvents.PLAYER_READY,
        (data: PlayerReadinessBroadcastData) => {
          if (
            expectedPlayerId === undefined ||
            data.playerId === expectedPlayerId
          ) {
            resolve(data);
          }
        }
      );
    });
  }

  /**
   * Wait for a player unready event with specific data
   */
  public async waitForPlayerUnready(
    socket: GameClientSocket,
    expectedPlayerId?: number
  ): Promise<PlayerReadinessBroadcastData> {
    return new Promise((resolve) => {
      socket.once(
        SocketIOGameEvents.PLAYER_UNREADY,
        (data: PlayerReadinessBroadcastData) => {
          if (
            expectedPlayerId === undefined ||
            data.playerId === expectedPlayerId
          ) {
            resolve(data);
          }
        }
      );
    });
  }

  /**
   * Helper method to check if all players are ready in game state
   */
  public async areAllPlayersReady(gameId: string): Promise<boolean> {
    const game = await this.getGameFromGameService(gameId);
    return game.isEveryoneReady();
  }
}
