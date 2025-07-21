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
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateQuestionDTO } from "domain/types/dto/game/state/GameStateQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameStartEventPayload } from "domain/types/socket/events/game/GameStartEventPayload";
import { PlayerReadinessBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
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

  /**
   * Picks and completes any type of question (regular, secret, etc.)
   * This method handles the full flow including secret question transfers
   */
  public async pickAndCompleteQuestion(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId?: number,
    shouldAnswer = false // New parameter to control answering vs skipping
  ): Promise<void> {
    const socketUserData = await this.getSocketUserData(showmanSocket);
    if (!socketUserData?.gameId) {
      throw new Error("Cannot determine game ID from socket");
    }

    let actualQuestionId = questionId;
    if (!actualQuestionId) {
      actualQuestionId = await this.getFirstAvailableQuestionId(
        socketUserData.gameId
      );
    }

    // Get question details to check if it's a secret question
    const game = await this.gameService.getGameEntity(socketUserData.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    // Find the question in the current round
    let questionType = null;
    if (game.gameState.currentRound) {
      for (const theme of game.gameState.currentRound.themes) {
        for (const question of theme.questions) {
          if (question.id === actualQuestionId) {
            questionType = this.getQuestionTypeFromPackage(
              game,
              actualQuestionId
            );
            break;
          }
        }
        if (questionType) break;
      }
    }

    // Pick the question
    if (questionType === PackageQuestionType.SECRET) {
      // Handle secret question flow
      const secretPickedPromise = this.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.SECRET_QUESTION_PICKED
      );

      showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
        questionId: actualQuestionId,
      });

      await secretPickedPromise;

      // Transfer to first player
      const questionDataPromise = this.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.QUESTION_DATA
      );

      showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
        targetPlayerId: await this.getPlayerUserIdFromSocket(playerSockets[0]),
      });

      await questionDataPromise;

      if (shouldAnswer) {
        // Answer correctly
        await this.answerQuestion(playerSockets[0], showmanSocket);
        await new Promise((resolve) => setTimeout(resolve, 100));
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });
      } else {
        // Skip the question
        await this.skipQuestion(showmanSocket);
      }
    } else {
      // Handle regular question flow
      await this.pickQuestion(showmanSocket, actualQuestionId);

      if (shouldAnswer) {
        // Answer correctly
        // For regular questions, a player should answer, not the showman
        await this.answerQuestion(playerSockets[0], showmanSocket);
        await new Promise((resolve) => setTimeout(resolve, 100));
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });
      } else {
        // Skip the question
        await this.skipQuestion(showmanSocket);
      }
    }
  }

  /**
   * Picks a question and prepares it for answering (handles secret questions properly)
   * Returns the socket that should answer the question (player for secret, original for regular)
   */
  public async pickQuestionForAnswering(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId?: number
  ): Promise<GameClientSocket> {
    const socketUserData = await this.getSocketUserData(showmanSocket);
    if (!socketUserData?.gameId) {
      throw new Error("Cannot determine game ID from socket");
    }

    let actualQuestionId = questionId;
    if (!actualQuestionId) {
      actualQuestionId = await this.getFirstAvailableQuestionId(
        socketUserData.gameId
      );
    }

    // Get question details to check if it's a secret question
    const game = await this.gameService.getGameEntity(socketUserData.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    // Find the question type
    const questionType = this.getQuestionTypeFromPackage(
      game,
      actualQuestionId
    );

    if (questionType === PackageQuestionType.SECRET) {
      // Handle secret question flow
      const secretPickedPromise = this.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.SECRET_QUESTION_PICKED
      );

      showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
        questionId: actualQuestionId,
      });

      await secretPickedPromise;

      // Transfer to first player
      const questionDataPromise = this.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.QUESTION_DATA
      );

      showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
        targetPlayerId: await this.getPlayerUserIdFromSocket(playerSockets[0]),
      });

      await questionDataPromise;

      // Return the player socket as they should answer the question
      return playerSockets[0];
    } else {
      // Handle regular question flow
      await this.pickQuestion(showmanSocket, actualQuestionId);

      // Return the showman socket (though really any socket can answer for regular questions)
      return showmanSocket;
    }
  }

  private getQuestionTypeFromPackage(game: Game, questionId: number) {
    if (!game.package?.rounds) return null;

    for (const round of game.package.rounds) {
      for (const theme of round.themes) {
        for (const question of theme.questions) {
          if (question.id === questionId) {
            return question.type;
          }
        }
      }
    }
    return null;
  }

  private async getPlayerUserIdFromSocket(
    socket: GameClientSocket
  ): Promise<number> {
    const userData = await this.getSocketUserData(socket);
    if (!userData?.id) {
      throw new Error("Cannot get user ID from player socket");
    }
    return userData.id;
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

  /**
   * Find a question by type in the game state
   * Optimized version that prefetches all question data for better performance
   */
  public async findQuestionByType(
    gameState: GameStateDTO,
    questionType: PackageQuestionType,
    gameId: string
  ): Promise<GameStateQuestionDTO | null> {
    if (!gameState.currentRound?.themes) {
      return null;
    }

    // Get the full game to access package data
    const game = await this.gameService.getGameEntity(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    // For Hidden questions, we can use a fast path since they're identifiable by price
    if (questionType === PackageQuestionType.HIDDEN) {
      for (const theme of gameState.currentRound.themes) {
        if (theme.questions) {
          for (const question of theme.questions) {
            if (!question.isPlayed && question.price === null) {
              return question;
            }
          }
        }
      }
      return null;
    }

    // For other question types, we need to check the package data
    // Build a map of all questions that need to be checked to minimize GameQuestionMapper calls
    const questionsToCheck: Array<{
      question: GameStateQuestionDTO;
      themeId: number;
    }> = [];

    for (const theme of gameState.currentRound.themes) {
      if (theme.questions) {
        for (const question of theme.questions) {
          if (!question.isPlayed) {
            questionsToCheck.push({ question, themeId: theme.id });
          }
        }
      }
    }

    // Now check each question efficiently
    for (const { question } of questionsToCheck) {
      const questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        gameState.currentRound.id,
        question.id
      );

      if (!questionData?.question) {
        continue;
      }

      const fullQuestion = questionData.question;

      // Check for Choice questions
      if (questionType === PackageQuestionType.CHOICE) {
        if (
          fullQuestion.answers &&
          fullQuestion.answers.length > 0 &&
          fullQuestion.showDelay !== undefined &&
          fullQuestion.showDelay !== null
        ) {
          return question;
        }
      }
      // Check for other question types by direct type comparison
      else if (fullQuestion.type === questionType) {
        return question;
      }
    }

    return null;
  }

  /**
   * Find all questions by type in the game state
   */
  public findAllQuestionsByType(
    gameState: GameStateDTO,
    questionType: PackageQuestionType
  ): GameStateQuestionDTO[] {
    const results: GameStateQuestionDTO[] = [];

    if (!gameState.currentRound?.themes) {
      return results;
    }

    for (const theme of gameState.currentRound.themes) {
      if (theme.questions) {
        for (const question of theme.questions) {
          // Same workaround as above - hidden questions have null price
          if (
            questionType === PackageQuestionType.HIDDEN &&
            question.price === null &&
            !question.isPlayed
          ) {
            results.push(question);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get the total number of questions in the current round
   */
  public async getCurrentRoundQuestionCount(gameId: string): Promise<number> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      return 0;
    }

    let totalQuestions = 0;
    for (const theme of currentRound.themes) {
      if (theme.questions) {
        totalQuestions += theme.questions.length;
      }
    }

    return totalQuestions;
  }

  /**
   * Find first hidden question ID for testing
   */
  public async getFirstHiddenQuestionId(gameId: string): Promise<number> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      throw new Error("No themes found in current round");
    }

    // Find first hidden question (price is null and not played)
    for (const theme of currentRound.themes) {
      if (theme.questions && theme.questions.length > 0) {
        for (const question of theme.questions) {
          if (question.id && !question.isPlayed && question.price === null) {
            return question.id;
          }
        }
      }
    }

    throw new Error("No hidden questions found");
  }
}
