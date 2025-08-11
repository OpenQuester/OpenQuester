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
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameStartEventPayload } from "domain/types/socket/events/game/GameStartEventPayload";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";
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
    includeFinalRound: boolean = true,
    additionalSimpleQuestions: number = 0
  ): Promise<GameTestSetup> {
    // Create showman
    const {
      socket: showmanSocket,
      gameId,
      user: showmanUser,
    } = await this.createGameWithShowman(
      app,
      userRepo,
      includeFinalRound,
      additionalSimpleQuestions
    );

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
    includeFinalRound: boolean = true,
    additionalSimpleQuestions: number = 0
  ): Promise<{ socket: ClientSocket; gameId: string; user: User }> {
    // Create a test user and get authenticated socket
    const { socket, user, cookie } = await this.createGameClient(app, userRepo);

    // Create a test package
    const packageData = this.packageUtils.createTestPackageData(
      {
        id: user.id,
        username: user.username,
      },
      includeFinalRound,
      additionalSimpleQuestions
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

    // Collect all unplayed questions first (to avoid depending on original insertion order)
    const candidates: Array<{
      id: number;
      order: number;
    }> = [];
    for (const theme of currentRound.themes) {
      if (!theme.questions) continue;
      for (const question of theme.questions) {
        if (question.id && !question.isPlayed) {
          // Some tests rely on picking a SIMPLE question first for speed; ensure order fallback works
          candidates.push({ id: question.id, order: question.order ?? 0 });
        }
      }
    }

    if (candidates.length === 0) {
      throw new Error("No available questions found");
    }

    // Pick the lowest order (stable, deterministic)
    candidates.sort((a, b) => a.order - b.order);
    return candidates[0].id;
  }

  /**
   * Get all available question IDs ordered by their order field
   */
  public async getAllAvailableQuestionIds(gameId: string): Promise<number[]> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      return [];
    }

    const questionIds: Array<{ id: number; order: number }> = [];

    // Collect all unplayed questions with their order
    for (const theme of currentRound.themes) {
      if (theme.questions && theme.questions.length > 0) {
        for (const question of theme.questions) {
          if (question.id && !question.isPlayed) {
            // Get question order from package data
            const questionOrder = this.getQuestionOrderFromPackage(
              game.package,
              question.id
            );
            questionIds.push({ id: question.id, order: questionOrder });
          }
        }
      }
    }

    // Sort by order and return just the IDs
    return questionIds.sort((a, b) => a.order - b.order).map((q) => q.id);
  }

  /**
   * Get question order from package data
   */
  private getQuestionOrderFromPackage(
    packageData: PackageDTO,
    questionId: number
  ): number {
    for (const round of packageData.rounds || []) {
      for (const theme of round.themes || []) {
        for (const question of theme.questions || []) {
          if (question.id === questionId) {
            return question.order || 0;
          }
        }
      }
    }
    return 0; // fallback
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
   * Picks and completes any type of question (regular, secret, stake, etc.)
   * This method handles the full flow including secret question transfers and stake bidding
   */
  public async pickAndCompleteQuestion(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId?: number,
    shouldAnswer = false,
    answerType = AnswerResultType.CORRECT,
    scoreResult = 100
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

      if (!shouldAnswer) {
        // Skip the question
        await this.skipQuestion(showmanSocket);
        return;
      }

      // Transfer to first player
      const questionDataPromise = this.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.QUESTION_DATA
      );

      showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
        targetPlayerId: await this.getPlayerUserIdFromSocket(playerSockets[0]),
      });

      await questionDataPromise;

      // Answer correctly
      await this.answerQuestion(playerSockets[0], showmanSocket);
      showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
        scoreResult: scoreResult,
        answerType: answerType,
      });

      // Wait for appropriate event based on answer type
      if (answerType === AnswerResultType.CORRECT) {
        await this.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_FINISH
        );
      } else {
        await this.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
      }
    } else if (questionType === PackageQuestionType.STAKE) {
      // We need fresh game entity here for player count and stake data
      const freshGameForStake = await this.gameService.getGameEntity(
        socketUserData.gameId
      );
      // If not all player sockets are provided, stake bidding cannot complete.
      // Some tests intentionally pass a subset (e.g., to attribute the answer to a specific player).
      // In such cases we automatically skip stake questions to avoid hanging during the bidding phase.
      const totalPlayerCount = freshGameForStake.players.filter(
        (p) => p.role === PlayerRole.PLAYER
      ).length;
      if (playerSockets.length < totalPlayerCount) {
        // Perform a minimal pick & skip so the question is marked played, then recurse.
        await this.pickQuestion(showmanSocket, actualQuestionId);
        await this.skipQuestion(showmanSocket);
        await this.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          undefined,
          shouldAnswer,
          answerType,
          scoreResult
        );
        return; // Stop stake flow for this question
      }
      // Handle stake question flow
      const stakePickedPromise = this.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.STAKE_QUESTION_PICKED
      );

      showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
        questionId: actualQuestionId,
      });

      await stakePickedPromise;

      if (!shouldAnswer) {
        // Skip the question
        await this.skipQuestion(showmanSocket);
        return;
      }

      // Complete the bidding phase by having all players pass
      const stakeWinnerPromise = this.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.STAKE_QUESTION_WINNER
      );

      // Get current game state to determine bidding order
      const game = await this.gameService.getGameEntity(socketUserData.gameId);
      if (game?.gameState.stakeQuestionData) {
        const stakeData = game.gameState.stakeQuestionData;
        const biddingOrder = stakeData.biddingOrder;

        // Have all players in bidding order participate realistically
        for (let i = 0; i < biddingOrder.length; i++) {
          const playerId = biddingOrder[i];

          // Find the socket for this player
          let playerSocket = null;
          for (const socket of playerSockets) {
            const socketUserId = await this.getUserIdFromSocket(socket);
            if (socketUserId === playerId) {
              playerSocket = socket;
              break;
            }
          }

          if (playerSocket && i === 0) {
            // First player (picker) must bid at least nominal amount - use normal bid for testing
            const game = await this.gameService.getGameEntity(
              socketUserData.gameId
            );
            const currentQuestion = game?.gameState.currentQuestion;
            const nominalAmount = currentQuestion?.price || 100; // fallback to 100

            playerSocket.emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
              bidType: StakeBidType.NORMAL,
              bidAmount: nominalAmount,
            });
          } else if (playerSocket) {
            // Other players pass to keep test simple but realistic
            playerSocket.emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
              bidType: StakeBidType.PASS,
              bidAmount: null,
            });
          }
        }
      }

      const stakeWinnerData = await stakeWinnerPromise;

      // Find the socket of the winning bidder
      let winnerSocket = playerSockets[0]; // fallback
      if (stakeWinnerData?.winnerPlayerId) {
        for (const socket of playerSockets) {
          const socketUserId = await this.getUserIdFromSocket(socket);
          if (socketUserId === stakeWinnerData.winnerPlayerId) {
            winnerSocket = socket;
            break;
          }
        }
      }

      // Answer correctly - winner should answer
      await this.answerQuestion(winnerSocket, showmanSocket);
      showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
        scoreResult: scoreResult,
        answerType: answerType,
      });

      // Wait for appropriate event based on answer type
      if (answerType === AnswerResultType.CORRECT) {
        await this.waitForEvent(
          winnerSocket,
          SocketIOGameEvents.QUESTION_FINISH
        );
      } else {
        await this.waitForEvent(winnerSocket, SocketIOGameEvents.ANSWER_RESULT);
      }
    } else {
      // Handle regular question flow (SIMPLE, NO_RISK, HIDDEN, CHOICE)
      // These question types follow the standard question flow for socket events
      // - NO_RISK: same flow, but backend prevents negative scoring
      // - HIDDEN: same flow, price revealed during play
      // - CHOICE: same flow, multiple answer options available
      await this.pickQuestion(showmanSocket, actualQuestionId);

      if (!shouldAnswer) {
        // Skip the question
        await this.skipQuestion(showmanSocket);
        return;
      }

      // Answer correctly
      // For regular questions, any player can answer
      await this.answerQuestion(playerSockets[0], showmanSocket);
      showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
        scoreResult: scoreResult,
        answerType: answerType,
      });

      // Wait for appropriate event based on answer type
      if (answerType === AnswerResultType.CORRECT) {
        await this.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_FINISH
        );
      } else {
        await this.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
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

      // Direct type comparison for all question types
      if (fullQuestion.type === questionType) {
        return question;
      }
    }

    return null;
  }

  /**
   * Find all questions by type in the game state
   */
  public async findAllQuestionsByType(
    gameState: GameStateDTO,
    questionType: PackageQuestionType,
    gameId: string
  ): Promise<GameStateQuestionDTO[]> {
    const results: GameStateQuestionDTO[] = [];

    if (!gameState.currentRound?.themes) {
      return results;
    }

    // Get the full game to access package data
    const game = await this.gameService.getGameEntity(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    // For other question types, we need to check the package data
    for (const theme of gameState.currentRound.themes) {
      if (theme.questions) {
        for (const question of theme.questions) {
          if (!question.isPlayed) {
            const questionData = GameQuestionMapper.getQuestionAndTheme(
              game.package,
              gameState.currentRound.id,
              question.id
            );

            if (!questionData?.question) {
              continue;
            }

            const fullQuestion = questionData.question;

            // Direct type comparison for all question types
            if (fullQuestion.type === questionType) {
              results.push(question);
            }
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

  /**
   * Helper method to get user ID from socket user data
   */
  public async getUserIdFromSocket(socket: GameClientSocket): Promise<number> {
    const socketUserData = await this.getSocketUserData(socket);
    if (!socketUserData?.id) {
      throw new Error(`Cannot get user ID from socket ${socket.id}`);
    }
    return socketUserData.id;
  }

  /**
   * Helper method to find a question ID by type from game entity
   * Note: This method relies on the test package structure from PackageUtils
   */
  public async getQuestionIdByType(
    gameId: string,
    questionType: PackageQuestionType
  ): Promise<number> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      throw new Error("No themes found in current round");
    }

    // Based on the test package structure in PackageUtils, questions are ordered:
    // 0: SIMPLE (100), 1: STAKE (200), 2: SECRET (300), 3: NO_RISK (400), 4: HIDDEN (500), 5: CHOICE (300)
    const targetOrder = this.getQuestionOrderByType(questionType);

    // Find question with the target order in the first theme
    const firstTheme = currentRound.themes[0];
    if (firstTheme.questions && firstTheme.questions.length > 0) {
      for (const question of firstTheme.questions) {
        if (
          question.id &&
          question.order === targetOrder &&
          !question.isPlayed
        ) {
          return question.id;
        }
      }
    }

    throw new Error(
      `No unplayed question of type ${questionType} found in game ${gameId}`
    );
  }

  /**
   * Helper method to get question order by type
   */
  private getQuestionOrderByType(questionType: PackageQuestionType): number {
    switch (questionType) {
      case PackageQuestionType.SIMPLE:
        return 0;
      case PackageQuestionType.STAKE:
        return 1;
      case PackageQuestionType.SECRET:
        return 2;
      case PackageQuestionType.NO_RISK:
        return 3;
      case PackageQuestionType.HIDDEN:
        return 4;
      case PackageQuestionType.CHOICE:
        return 5;
      default:
        throw new Error(`Unsupported question type: ${questionType}`);
    }
  }

  /**
   * Set the current turn player by emitting TURN_PLAYER_CHANGED event from showman
   */
  public async setCurrentTurnPlayer(
    showmanSocket: GameClientSocket,
    newTurnPlayerId: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error("TURN_PLAYER_CHANGED event not received within timeout")
        );
      }, 5000);

      showmanSocket.once(SocketIOGameEvents.TURN_PLAYER_CHANGED, () => {
        clearTimeout(timeout);
        resolve();
      });

      showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
        newTurnPlayerId,
      });
    });
  }
}
