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

import { SocketGameTestEventUtils } from "./SocketGameTestEventUtils";
import { SocketGameTestUserUtils } from "./SocketGameTestUserUtils";
import { GameClientSocket, GameTestSetup } from "./SocketIOGameTestUtils";

export class SocketGameTestLobbyUtils {
  private readonly packageUtils = new PackageUtils();

  constructor(
    private userUtils: SocketGameTestUserUtils,
    private eventUtils: SocketGameTestEventUtils,
    private socketGameContextService: Pick<
      SocketGameContextService,
      "getGameIdForSocket"
    > = container.resolve(SocketGameContextService)
  ) {}

  public async setupGameTestEnvironment(
    userRepo: Repository<User>,
    app: Express,
    playerCount: number,
    spectatorCount: number,
    includeFinalRound: boolean = true,
    additionalSimpleQuestions: number = 0,
    includeMediaQuestionFiles: boolean = false
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
        additionalSimpleQuestions,
        includeMediaQuestionFiles
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
      return this.rethrowSetupFailure(error, createdSockets);
    }
  }

  async createGameWithShowman(
    app: Express,
    userRepo: Repository<User>,
    includeFinalRound: boolean = true,
    additionalSimpleQuestions: number = 0,
    includeMediaQuestionFiles: boolean = false
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
        additionalSimpleQuestions,
        includeMediaQuestionFiles
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
        throw new Error(
          `Failed to create game: ${gameRes.status} - ${JSON.stringify(gameRes.body)}`
        );
      }

      const createdGame = gameRes.body;
      const gameId = createdGame.id;

      // Join the game as showman
      await this.joinGame(socket, gameId, PlayerRole.SHOWMAN);

      return { socket, gameId, user };
    } catch (error) {
      return this.rethrowSetupFailure(error, [socket]);
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
    await this.joinWithData(socket, {
      gameId,
      role,
      targetSlot: null,
      password: null
    });
  }

  public async joinSpecificGameWithData(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole,
    password?: string
  ): Promise<GameJoinOutputData> {
    return this.joinWithData(socket, {
      gameId,
      role,
      targetSlot: null,
      password
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
    const joinData: GameJoinInputData = {
      gameId,
      role,
      targetSlot: null,
      password
    };

    try {
      return await this.eventUtils.emitAndWaitForEvent<ErrorEventPayload>(socket, "error", () =>
        socket.emit(SocketIOGameEvents.JOIN, joinData)
      );
    } catch (error) {
      throw new Error(
        `Expected join error for game ${gameId} as ${role} on socket ${socket.id ?? "unknown"}: ` +
          toError(error).message,
        { cause: toError(error) }
      );
    }
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
    await this.joinWithData(socket, { gameId, role, targetSlot });
  }

  /**
   * Join a game with a specific target slot and return game data
   */
  public async joinGameWithSlotAndData(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole,
    targetSlot: number | null
  ): Promise<GameJoinOutputData> {
    return this.joinWithData(socket, { gameId, role, targetSlot });
  }

  public async leaveGame(socket: GameClientSocket): Promise<void> {
    const gameId = socket.gameId;
    if (!gameId) {
      await this.eventUtils.emitAndWaitForEvent(socket, SocketIOGameEvents.LEAVE, () =>
        socket.emit(SocketIOGameEvents.LEAVE)
      );
      socket.role = undefined;
      return;
    }

    const probe = this.eventUtils.createAcceptedActionProbe({
      gameId,
      actionType: GameActionType.LEAVE,
      socketId: socket.id
    });
    const accepted = probe.waitForCount(1);
    const leaveEvent = this.eventUtils.emitAndWaitForEvent(socket, SocketIOGameEvents.LEAVE, () =>
      socket.emit(SocketIOGameEvents.LEAVE)
    );
    void accepted.catch(() => undefined);
    void leaveEvent.catch(() => undefined);

    try {
      await Promise.all([accepted, leaveEvent]);
      await this.eventUtils.waitForActionsComplete(gameId);
      socket.gameId = undefined;
      socket.role = undefined;
    } finally {
      probe.dispose();
      await Promise.allSettled([accepted, leaveEvent]);
    }
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
      this.userUtils.releaseSocket(socket);
      return;
    }

    const probe = this.eventUtils.createAcceptedActionProbe({
      gameId,
      actionType: GameActionType.DISCONNECT,
      socketId: socket.id
    });
    const disconnectAction = probe.waitForCount(1);
    void disconnectAction.catch(() => undefined);

    try {
      this.closeClientSocket(socket);
      await disconnectAction;
      await this.eventUtils.waitForActionsComplete(gameId);
      this.userUtils.releaseSocket(socket);
    } finally {
      probe.dispose();
      await Promise.allSettled([disconnectAction]);
    }
  }

  public async cleanupOwnedClients(): Promise<void> {
    await this.cleanupSocketGroups(this.userUtils.getOwnedSockets());
  }

  private async cleanupSocketGroups(sockets: readonly GameClientSocket[]): Promise<void> {
    const cleanupFailures: Error[] = [];
    const socketsByGame = new Map<string | undefined, GameClientSocket[]>();

    for (const socket of sockets) {
      let gameId = socket.gameId;
      if (!gameId && socket.connected && socket.id) {
        try {
          gameId = (await this.socketGameContextService.getGameIdForSocket(socket.id)) ?? undefined;
        } catch (error) {
          cleanupFailures.push(
            toCleanupError(`Owned socket game discovery for ${socket.id}`, error)
          );
        }
      }

      const group = socketsByGame.get(gameId) ?? [];
      group.push(socket);
      socketsByGame.set(gameId, group);
    }

    for (const [gameId, sockets] of socketsByGame) {
      await collectCleanupFailure(
        cleanupFailures,
        `Owned client cleanup for game ${gameId ?? "unassigned"}`,
        async () => {
          await this.cleanupClientGroup(gameId, sockets);
        }
      );
    }

    throwIfCleanupFailed("Owned Socket.IO client cleanup failed", cleanupFailures);
  }

  public async cleanupGameClients(setup: GameTestSetup): Promise<void> {
    const sockets = [setup.showmanSocket, ...setup.playerSockets, ...setup.spectatorSockets];
    await this.cleanupClientGroup(setup.gameId, sockets);
  }

  private async cleanupClientGroup(
    gameId: string | undefined,
    sockets: readonly GameClientSocket[]
  ): Promise<void> {
    const cleanupFailures: Error[] = [];

    if (gameId) {
      await collectCleanupFailure(cleanupFailures, "Initial action drain", async () => {
        await this.eventUtils.waitForActionsComplete(gameId);
      });
    }

    const socketsWithServerGameSession: GameClientSocket[] = [];
    if (gameId) {
      for (const socket of sockets) {
        try {
          if (await this.hasServerGameSession(socket, gameId)) {
            socketsWithServerGameSession.push(socket);
          }
        } catch (error) {
          cleanupFailures.push(
            toCleanupError(`Server session discovery for socket ${socket.id ?? "unknown"}`, error)
          );
        }
      }
    }

    let disconnectActionsPromise: Promise<void> | undefined;
    if (gameId && socketsWithServerGameSession.length > 0) {
      try {
        disconnectActionsPromise = this.eventUtils.waitForSubmittedActions(
          gameId,
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
        cleanupFailures.push(
          toCleanupError(`Client socket close for ${socket.id ?? "unknown"}`, error)
        );
      }
    }

    if (disconnectActionsPromise) {
      await collectCleanupFailure(cleanupFailures, "Disconnect action wait", async () => {
        await disconnectActionsPromise;
      });
    }

    if (gameId) {
      await collectCleanupFailure(cleanupFailures, "Final action drain", async () => {
        await this.eventUtils.waitForActionsComplete(gameId);
      });
    }

    throwIfCleanupFailed("Socket.IO client cleanup failed", cleanupFailures);
    for (const socket of sockets) {
      this.userUtils.releaseSocket(socket);
    }
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

  private async rethrowSetupFailure(
    error: unknown,
    sockets: readonly GameClientSocket[]
  ): Promise<never> {
    const setupFailure = error instanceof Error ? error : new Error(String(error));

    try {
      await this.cleanupSocketGroups(sockets);
    } catch (cleanupError) {
      const cleanupFailure = toCleanupError("Partial game setup cleanup", cleanupError);
      throw new AggregateError(
        [setupFailure, cleanupFailure],
        `Game test environment setup and cleanup failed: ${setupFailure.message}; ` +
          cleanupFailure.message
      );
    }

    throw setupFailure;
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
    return this.eventUtils.emitAndWaitForEvent<GameStartEventPayload>(
      showmanSocket,
      SocketIOGameEvents.START,
      () => showmanSocket.emit(SocketIOGameEvents.START)
    );
  }

  public async pauseGame(showmanSocket: GameClientSocket): Promise<void> {
    await this.eventUtils.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.GAME_PAUSE, () =>
      showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE, {})
    );
  }

  private async joinWithData(
    socket: GameClientSocket,
    joinData: GameJoinInputData
  ): Promise<GameJoinOutputData> {
    try {
      const gameData = await this.eventUtils.emitAndWaitForEvent<GameJoinOutputData>(
        socket,
        SocketIOGameEvents.GAME_DATA,
        () => socket.emit(SocketIOGameEvents.JOIN, joinData)
      );
      socket.gameId = joinData.gameId;
      socket.role = joinData.role;
      return gameData;
    } catch (error) {
      throw new Error(
        `Failed to join game ${joinData.gameId} as ${joinData.role} ` +
          `(slot=${joinData.targetSlot ?? "default"}, socketId=${socket.id ?? "unknown"}): ` +
          toError(error).message,
        { cause: toError(error) }
      );
    }
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

function toCleanupError(label: string, error: unknown): Error {
  const cause = toError(error);
  return new Error(`${label} failed: ${cause.message}`, { cause });
}

function throwIfCleanupFailed(message: string, failures: Error[]): void {
  if (failures.length === 0) {
    return;
  }

  throw new AggregateError(
    failures,
    `${message}: ${failures.map((failure) => failure.message).join("; ")}`
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
