import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { GameStartEventPayload } from "domain/types/socket/events/game/GameStartEventPayload";
import {
  GameJoinInputData,
  GameJoinOutputData
} from "domain/types/socket/events/SocketEventInterfaces";
import { type Express } from "express";
import { container } from "tsyringe";
import { User } from "infrastructure/database/models/User";
import request from "supertest";
import { PackageUtils } from "tests/utils/PackageUtils";
import { Repository } from "typeorm";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

import { SocketGameTestEventUtils } from "./SocketGameTestEventUtils";
import { SocketGameTestUserUtils } from "./SocketGameTestUserUtils";
import { GameClientSocket, GameTestSetup } from "./SocketIOGameTestUtils";

export interface SocketGameTestLobbyUtilsDependencies {
  readonly socketGameContextService?: Pick<SocketGameContextService, "getGameIdForSocket">;
}

export class SocketGameTestLobbyUtils {
  private packageUtils: PackageUtils;
  private socketGameContextService: Pick<SocketGameContextService, "getGameIdForSocket">;

  constructor(
    private userUtils: SocketGameTestUserUtils,
    private eventUtils: SocketGameTestEventUtils,
    dependencies: SocketGameTestLobbyUtilsDependencies = {}
  ) {
    this.packageUtils = new PackageUtils();
    this.socketGameContextService =
      dependencies.socketGameContextService ?? container.resolve(SocketGameContextService);
  }

  public async setupGameTestEnvironment(
    userRepo: Repository<User>,
    app: Express,
    playerCount: number,
    spectatorCount: number,
    includeFinalRound: boolean = true,
    additionalSimpleQuestions: number = 0
  ): Promise<GameTestSetup> {
    const createdSockets: GameClientSocket[] = [];
    const playerSockets: GameClientSocket[] = [];
    const playerUsers: User[] = [];
    const spectatorSockets: GameClientSocket[] = [];

    try {
      const {
        socket: showmanSocket,
        gameId,
        user: showmanUser
      } = await this.createGameWithShowman(
        app,
        userRepo,
        includeFinalRound,
        additionalSimpleQuestions
      );
      createdSockets.push(showmanSocket);

      for (let i = 0; i < playerCount; i++) {
        const { socket, user } = await this.userUtils.createGameClient(app, userRepo);
        const playerSocket = socket as GameClientSocket;
        createdSockets.push(playerSocket);
        playerSockets.push(playerSocket);
        playerUsers.push(user);
        await this.joinGame(playerSocket, gameId, PlayerRole.PLAYER);
      }

      for (let i = 0; i < spectatorCount; i++) {
        const { socket } = await this.userUtils.createGameClient(app, userRepo);
        const spectatorSocket = socket as GameClientSocket;
        createdSockets.push(spectatorSocket);
        spectatorSockets.push(spectatorSocket);
        await this.joinGame(spectatorSocket, gameId, PlayerRole.SPECTATOR);
      }

      return {
        gameId,
        showmanSocket,
        playerSockets,
        spectatorSockets,
        showmanUser,
        playerUsers
      };
    } catch (error) {
      this.rethrowSetupFailure(error, createdSockets);
    }
  }

  async createGameWithShowman(
    app: Express,
    userRepo: Repository<User>,
    includeFinalRound: boolean = true,
    additionalSimpleQuestions: number = 0
  ): Promise<{
    socket: GameClientSocket;
    gameId: string;
    user: User;
  }> {
    // Create a test user and get authenticated socket
    const { socket, user, cookie } = await this.userUtils.createGameClient(app, userRepo);

    try {
      // Create a test package
      const packageData = this.packageUtils.createTestPackageData(
        {
          id: user.id,
          username: user.username
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
          `Failed to create package: ${packageRes.status} - ${JSON.stringify(packageRes.body)}`
        );
      }

      const createdPackage = packageRes.body;
      const packageId = createdPackage.id;

      // Create game data
      const gameData: GameCreateDTO = {
        title: "Test Game " + Math.random().toString(36).substring(7),
        packageId: packageId,
        isPrivate: false,
        password: undefined,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10
      };

      // Create the game via REST API
      const gameRes = await request(app).post("/v1/games").set("Cookie", cookie).send(gameData);

      if (gameRes.status !== 200) {
        throw new Error(`Failed to create game: ${gameRes.status} - ${JSON.stringify(gameRes.body)}`);
      }

      const createdGame = gameRes.body;
      const gameId = createdGame.id;

      // Join the game as showman
      await this.joinGame(socket, gameId, PlayerRole.SHOWMAN);

      return { socket, gameId, user };
    } catch (error) {
      this.rethrowSetupFailure(error, [socket]);
    }
  }

  public async joinGame(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole = PlayerRole.PLAYER
  ): Promise<void> {
    return this.joinSpecificGame(socket, gameId, role);
  }

  public async joinSpecificGame(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const joinData: GameJoinInputData = {
        gameId,
        role,
        targetSlot: null,
        password: null
      };
      const timeout = setTimeout(() => {
        socket.removeAllListeners(SocketIOGameEvents.GAME_DATA);
        reject(new Error(`GAME_DATA not received within timeout (gameId=${gameId} role=${role})`));
      }, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
      socket.once(SocketIOGameEvents.GAME_DATA, () => {
        clearTimeout(timeout);
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
    role: PlayerRole,
    password?: string
  ): Promise<GameJoinOutputData> {
    return new Promise<GameJoinOutputData>((resolve, reject) => {
      const joinData: GameJoinInputData = {
        gameId,
        role,
        targetSlot: null,
        password
      };
      const timeout = setTimeout(() => {
        socket.removeAllListeners(SocketIOGameEvents.GAME_DATA);
        reject(new Error(`GAME_DATA not received within timeout (gameId=${gameId} role=${role})`));
      }, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
      socket.once(SocketIOGameEvents.GAME_DATA, (gameData) => {
        clearTimeout(timeout);
        socket.gameId = gameId;
        socket.role = role;
        resolve(gameData);
      });
      socket.emit(SocketIOGameEvents.JOIN, joinData);
    });
  }

  /**
   * Join a game with password, expecting an error
   */
  public async joinGameWithPasswordExpectError(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole,
    password?: string
  ): Promise<ErrorEventPayload> {
    return new Promise<ErrorEventPayload>((resolve, reject) => {
      const joinData: GameJoinInputData = {
        gameId,
        role,
        targetSlot: null,
        password
      };
      socket.once("error", (error: ErrorEventPayload) => {
        resolve(error);
      });
      socket.emit(SocketIOGameEvents.JOIN, joinData);
      // Timeout in case no error is received
      setTimeout(
        () => reject(new Error("Expected error but none received")),
        TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
      );
    });
  }

  /**
   * Join a game with a specific target slot
   */
  public async joinGameWithSlot(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole,
    targetSlot: number | null
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const joinData: GameJoinInputData = { gameId, role, targetSlot };
      const timeout = setTimeout(() => {
        socket.removeAllListeners(SocketIOGameEvents.GAME_DATA);
        reject(
          new Error(
            `GAME_DATA not received within timeout (gameId=${gameId} role=${role} slot=${targetSlot})`
          )
        );
      }, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
      socket.once(SocketIOGameEvents.GAME_DATA, () => {
        clearTimeout(timeout);
        socket.gameId = gameId;
        socket.role = role;
        resolve();
      });
      socket.emit(SocketIOGameEvents.JOIN, joinData);
    });
  }

  /**
   * Join a game with a specific target slot and return game data
   */
  public async joinGameWithSlotAndData(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole,
    targetSlot: number | null
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const joinData: GameJoinInputData = { gameId, role, targetSlot };
      const timeout = setTimeout(() => {
        socket.removeAllListeners(SocketIOGameEvents.GAME_DATA);
        reject(
          new Error(
            `GAME_DATA not received within timeout (gameId=${gameId} role=${role} slot=${targetSlot})`
          )
        );
      }, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
      socket.once(SocketIOGameEvents.GAME_DATA, (gameData) => {
        clearTimeout(timeout);
        socket.gameId = gameId;
        socket.role = role;
        resolve(gameData);
      });
      socket.emit(SocketIOGameEvents.JOIN, joinData);
    });
  }

  public async leaveGame(socket: GameClientSocket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.removeAllListeners(SocketIOGameEvents.LEAVE);
        reject(new Error("LEAVE event not received within timeout"));
      }, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
      socket.once(SocketIOGameEvents.LEAVE, () => {
        clearTimeout(timeout);
        socket.gameId = undefined;
        socket.role = undefined;
        resolve();
      });
      socket.emit(SocketIOGameEvents.LEAVE);
    });
  }

  public async disconnectAndCleanup(
    socket: GameClientSocket,
    waitForDrain: boolean = true
  ): Promise<void> {
    if (!socket) return;

    const gameId = socket.gameId;
    const shouldWaitForDisconnectAction =
      waitForDrain && gameId && (await this.hasServerGameSession(socket, gameId));

    if (!shouldWaitForDisconnectAction) {
      this.closeClientSocket(socket);
      return;
    }

    const disconnectActionPromise = this.eventUtils.waitForSubmittedActions(
      gameId,
      1,
      GameActionType.DISCONNECT
    );

    this.closeClientSocket(socket);

    await disconnectActionPromise;
    await this.eventUtils.waitForActionsComplete(gameId);
  }

  public async cleanupGameClients(setup: GameTestSetup): Promise<void> {
    const sockets = [setup.showmanSocket, ...setup.playerSockets, ...setup.spectatorSockets];
    const cleanupFailures: Error[] = [];

    await collectCleanupFailure(cleanupFailures, "Initial action drain", async () => {
      await this.eventUtils.waitForActionsComplete(setup.gameId);
    });

    const socketsWithServerGameSession: GameClientSocket[] = [];
    for (const socket of sockets) {
      try {
        if (await this.hasServerGameSession(socket, setup.gameId)) {
          socketsWithServerGameSession.push(socket);
        }
      } catch (error) {
        cleanupFailures.push(
          toCleanupError(`Server session discovery for socket ${socket.id ?? "unknown"}`, error)
        );
      }
    }

    let disconnectActionsPromise: Promise<void> | undefined;
    if (socketsWithServerGameSession.length > 0) {
      try {
        disconnectActionsPromise = this.eventUtils.waitForSubmittedActions(
          setup.gameId,
          socketsWithServerGameSession.length,
          GameActionType.DISCONNECT
        );
      } catch (error) {
        cleanupFailures.push(toCleanupError("Disconnect action wait setup", error));
      }
    }

    for (const socket of sockets) {
      try {
        this.closeClientSocket(socket);
      } catch (error) {
        cleanupFailures.push(toCleanupError(`Client socket close for ${socket.id ?? "unknown"}`, error));
      }
    }

    if (disconnectActionsPromise) {
      await collectCleanupFailure(cleanupFailures, "Disconnect action wait", async () => {
        await disconnectActionsPromise;
      });
    }

    await collectCleanupFailure(cleanupFailures, "Final action drain", async () => {
      await this.eventUtils.waitForActionsComplete(setup.gameId);
    });

    throwIfCleanupFailed(cleanupFailures);
  }

  private async hasServerGameSession(socket: GameClientSocket, gameId: string): Promise<boolean> {
    if (!socket.connected) {
      return false;
    }

    const socketId = socket.id;
    if (!socketId) {
      return false;
    }

    const serverGameId = await this.socketGameContextService.getGameIdForSocket(socketId);
    return serverGameId === gameId;
  }

  private rethrowSetupFailure(error: unknown, sockets: readonly GameClientSocket[]): never {
    const setupFailure = error instanceof Error ? error : new Error(String(error));
    const cleanupFailures: Error[] = [];

    for (const socket of sockets) {
      try {
        this.closeClientSocket(socket);
      } catch (cleanupError) {
        cleanupFailures.push(
          toCleanupError(`Partial setup socket close for ${socket.id ?? "unknown"}`, cleanupError)
        );
      }
    }

    if (cleanupFailures.length === 0) {
      throw setupFailure;
    }

    throw new AggregateError(
      [setupFailure, ...cleanupFailures],
      `Game test environment setup and cleanup failed: ${[setupFailure, ...cleanupFailures]
        .map((failure) => failure.message)
        .join("; ")}`
    );
  }

  private closeClientSocket(socket: GameClientSocket): void {
    const failures: Error[] = [];

    if (socket.connected) {
      try {
        socket.disconnect();
      } catch (error) {
        failures.push(toCleanupError("Socket disconnect", error));
      }
    }

    try {
      socket.removeAllListeners();
    } catch (error) {
      failures.push(toCleanupError("Socket listener removal", error));
    }

    try {
      socket.close();
    } catch (error) {
      failures.push(toCleanupError("Socket close", error));
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `Socket client close failed: ${failures.map((failure) => failure.message).join("; ")}`
      );
    }
  }

  public async deleteGame(app: Express, gameId: string, cookie: string[]): Promise<void> {
    const deleteRes = await request(app).delete(`/v1/games/${gameId}`).set("Cookie", cookie);

    if (![HttpStatus.OK, HttpStatus.NO_CONTENT].includes(deleteRes.status)) {
      throw new Error(
        `Failed to delete game: ${deleteRes.status} - ${JSON.stringify(deleteRes.body)}`
      );
    }
  }

  public async startGame(showmanSocket: GameClientSocket): Promise<GameStartEventPayload> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        showmanSocket.removeAllListeners(SocketIOGameEvents.START);
        reject(new Error("START event not received within timeout"));
      }, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
      showmanSocket.once(SocketIOGameEvents.START, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      showmanSocket.emit(SocketIOGameEvents.START);
    });
  }

  public async pauseGame(showmanSocket: GameClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for GAME_PAUSE event"));
      }, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);

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
}

async function collectCleanupFailure(
  failures: Error[],
  label: string,
  action: () => Promise<void>
): Promise<void> {
  try {
    await action();
  } catch (error) {
    failures.push(toCleanupError(label, error));
  }
}

function throwIfCleanupFailed(failures: Error[]): void {
  if (failures.length === 0) {
    return;
  }

  throw new AggregateError(
    failures,
    `Socket.IO client cleanup failed: ${failures.map((failure) => failure.message).join("; ")}`
  );
}

function toCleanupError(label: string, error: unknown): Error {
  const cause = error instanceof Error ? error : new Error(String(error));
  return new Error(`${label} failed: ${cause.message}`, { cause });
}
