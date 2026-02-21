import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { type Express } from "express";
import { container } from "tsyringe";
import { Repository } from "typeorm";

import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameJoinOutputData } from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { UserRepository } from "infrastructure/database/repositories/UserRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("User Data Update on Game Join", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let userRepository: UserRepository;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    userRepository = container.resolve(UserRepository);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
  });

  it("should update user meta when player rejoins game after profile change", async () => {
    // Create a user and game setup
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      // Verify initial join - get game entity to check players
      const initialGame = await utils.getGameFromGameService(setup.gameId);
      expect(initialGame).toBeDefined();

      // Find the player in game entity
      const initialPlayer = initialGame.getPlayer(setup.playerUsers[0].id, {
        fetchDisconnected: false,
      });
      expect(initialPlayer).toBeDefined();
      expect(initialPlayer!.meta.username).toBe(setup.playerUsers[0].username);
      expect(initialPlayer!.gameStatus).toBe(PlayerGameStatus.IN_GAME);

      // User leaves the game
      await utils.leaveGame(setup.playerSockets[0]);

      // Verify player is disconnected
      const gameAfterLeave = await utils.getGameFromGameService(setup.gameId);
      const playerAfterLeave = gameAfterLeave.getPlayer(
        setup.playerUsers[0].id,
        { fetchDisconnected: true }
      );
      expect(playerAfterLeave).toBeDefined();
      expect(playerAfterLeave!.gameStatus).toBe(PlayerGameStatus.DISCONNECTED);

      // Update user profile in database (simulate user changing their profile)
      const updatedUsername = `updated_${setup.playerUsers[0].username}`;
      setup.playerUsers[0].username = updatedUsername;
      // Use the UserRepository.update method to ensure cache invalidation
      await userRepository.update(setup.playerUsers[0]);

      // Refresh the user from database to ensure it's properly updated
      const refreshedUser = await userRepo.findOne({
        where: { id: setup.playerUsers[0].id },
      });
      expect(refreshedUser).toBeDefined();
      expect(refreshedUser!.username).toBe(updatedUsername);

      // User rejoins the game
      const gameDataOnRejoin: GameJoinOutputData =
        await utils.joinSpecificGameWithData(
          setup.playerSockets[0],
          setup.gameId,
          PlayerRole.PLAYER
        );

      // Verify that the player meta has been updated with current user data
      const rejoiningPlayer = gameDataOnRejoin.players.find(
        (p) => p.meta.id === setup.playerUsers[0].id
      );

      expect(rejoiningPlayer).toBeDefined();
      expect(rejoiningPlayer!.meta.username).toBe(updatedUsername);
      expect(rejoiningPlayer!.status).toBe(PlayerGameStatus.IN_GAME);

      // Verify in game entity as well
      const finalGame = await utils.getGameFromGameService(setup.gameId);
      const finalPlayer = finalGame.getPlayer(setup.playerUsers[0].id, {
        fetchDisconnected: false,
      });
      expect(finalPlayer).toBeDefined();
      expect(finalPlayer!.meta.username).toBe(updatedUsername);
      expect(finalPlayer!.gameStatus).toBe(PlayerGameStatus.IN_GAME);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should use current user data for new player joining", async () => {
    // Create a user and join game
    const { socket: playerSocket, user: playerUser } =
      await utils.createGameClient(app, userRepo);
    const { socket: showmanSocket, gameId } = await utils.createGameWithShowman(
      app,
      userRepo
    );

    try {
      // Join the game
      const gameData: GameJoinOutputData = await utils.joinSpecificGameWithData(
        playerSocket,
        gameId,
        PlayerRole.PLAYER
      );

      // Verify that current user data is used
      const player = gameData.players.find((p) => p.meta.id === playerUser.id);
      expect(player).toBeDefined();
      expect(player!.meta.username).toBe(playerUser.username);
      expect(player!.status).toBe(PlayerGameStatus.IN_GAME);

      // Verify in game entity as well
      const game = await utils.getGameFromGameService(gameId);
      const gamePlayer = game.getPlayer(playerUser.id, {
        fetchDisconnected: false,
      });
      expect(gamePlayer).toBeDefined();
      expect(gamePlayer!.meta.username).toBe(playerUser.username);
      expect(gamePlayer!.gameStatus).toBe(PlayerGameStatus.IN_GAME);
    } finally {
      await utils.disconnectAndCleanup(playerSocket);
      await utils.disconnectAndCleanup(showmanSocket);
    }
  });

  it("should always update player meta data even when user data hasn't changed", async () => {
    // Create a user and game setup
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      // User leaves the game
      await utils.leaveGame(setup.playerSockets[0]);

      // User rejoins without any profile changes
      const gameDataOnRejoin: GameJoinOutputData =
        await utils.joinSpecificGameWithData(
          setup.playerSockets[0],
          setup.gameId,
          PlayerRole.PLAYER
        );

      // Verify that the player rejoined successfully with current data
      const rejoiningPlayer = gameDataOnRejoin.players.find(
        (p) => p.meta.id === setup.playerUsers[0].id
      );
      expect(rejoiningPlayer).toBeDefined();
      expect(rejoiningPlayer!.meta.username).toBe(
        setup.playerUsers[0].username
      );
      expect(rejoiningPlayer!.status).toBe(PlayerGameStatus.IN_GAME);

      // Verify in game entity as well
      const finalGame = await utils.getGameFromGameService(setup.gameId);
      const finalPlayer = finalGame.getPlayer(setup.playerUsers[0].id, {
        fetchDisconnected: false,
      });
      expect(finalPlayer).toBeDefined();
      expect(finalPlayer!.meta.username).toBe(setup.playerUsers[0].username);
      expect(finalPlayer!.gameStatus).toBe(PlayerGameStatus.IN_GAME);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });
});
