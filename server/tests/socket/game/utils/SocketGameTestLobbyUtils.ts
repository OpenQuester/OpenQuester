import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { GameStartEventPayload } from "domain/types/socket/events/game/GameStartEventPayload";
import {
  GameJoinInputData,
  GameJoinOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { type Express } from "express";
import { User } from "infrastructure/database/models/User";
import request from "supertest";
import { PackageUtils } from "tests/utils/PackageUtils";
import { Repository } from "typeorm";

import { SocketGameTestEventUtils } from "./SocketGameTestEventUtils";
import { SocketGameTestUserUtils } from "./SocketGameTestUserUtils";
import { GameClientSocket, GameTestSetup } from "./SocketIOGameTestUtils";

export class SocketGameTestLobbyUtils {
  private packageUtils: PackageUtils;

  constructor(
    private userUtils: SocketGameTestUserUtils,
    private eventUtils: SocketGameTestEventUtils
  ) {
    this.packageUtils = new PackageUtils();
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
      const { socket, user } = await this.userUtils.createGameClient(
        app,
        userRepo
      );
      await this.joinGame(socket, gameId, PlayerRole.PLAYER);
      playerSockets.push(socket as GameClientSocket);
      playerUsers.push(user);
    }

    // Create spectators
    const spectatorSockets: GameClientSocket[] = [];
    for (let i = 0; i < spectatorCount; i++) {
      const { socket } = await this.userUtils.createGameClient(app, userRepo);
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
  ): Promise<{ socket: GameClientSocket; gameId: string; user: User }> {
    // Create a test user and get authenticated socket
    const { socket, user, cookie } = await this.userUtils.createGameClient(
      app,
      userRepo
    );

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
      password: undefined,
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
    return new Promise<void>((resolve) => {
      const joinData: GameJoinInputData = {
        gameId,
        role,
        targetSlot: null,
        password: null,
      };
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
    role: PlayerRole,
    password?: string
  ): Promise<GameJoinOutputData> {
    return new Promise<GameJoinOutputData>((resolve) => {
      const joinData: GameJoinInputData = {
        gameId,
        role,
        targetSlot: null,
        password,
      };
      socket.once(SocketIOGameEvents.GAME_DATA, (gameData) => {
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
        password,
      };
      socket.once("error", (error: ErrorEventPayload) => {
        resolve(error);
      });
      socket.emit(SocketIOGameEvents.JOIN, joinData);
      // Timeout in case no error is received
      setTimeout(
        () => reject(new Error("Expected error but none received")),
        5000
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
    return new Promise<void>((resolve) => {
      const joinData: GameJoinInputData = { gameId, role, targetSlot };
      socket.once(SocketIOGameEvents.GAME_DATA, () => {
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
    return new Promise<any>((resolve) => {
      const joinData: GameJoinInputData = { gameId, role, targetSlot };
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

  public async cleanupGameClients(setup: GameTestSetup): Promise<void> {
    try {
      await this.eventUtils.waitForActionsComplete(setup.gameId);

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
    gameId: string,
    creatorId: number
  ): Promise<void> {
    // Login as the creator
    const { cookie } = await this.userUtils.loginExistingUser(app, creatorId);

    // Delete the game
    await this.deleteGame(app, gameId, [cookie]);
  }

  public async deleteGameWithClient(
    app: Express,
    gameId: string,
    clientData: { socket: GameClientSocket; user: User; cookie: string[] }
  ): Promise<void> {
    await this.deleteGame(app, gameId, clientData.cookie);
  }

  public async startGame(
    showmanSocket: GameClientSocket
  ): Promise<GameStartEventPayload> {
    return new Promise((resolve) => {
      showmanSocket.once(SocketIOGameEvents.START, resolve);
      showmanSocket.emit(SocketIOGameEvents.START);
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
}
