import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("SocketIOGameLobby", () => {
  let suite: SocketGameTestSuite;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  it("should allow players to join a game", async () => {
    await suite.scenario(async () => {
      const setup = await suite.utils.setupGameTestEnvironment(suite.userRepo, suite.app, 1, 0);

      // Get game state directly from service since socket has already joined
      const gameState = await suite.utils.getGameState(setup.gameId);
      expect(gameState).toBeDefined();

      // Verify the setup was successful
      expect(setup.gameId).toBeDefined();
      expect(setup.showmanSocket).toBeDefined();
      expect(setup.playerSockets).toHaveLength(1);
      expect(setup.spectatorSockets).toHaveLength(0);

      // Get socket user data to verify join was successful
      const showmanUserData = await suite.utils.getSocketUserData(setup.showmanSocket);
      const playerUserData = await suite.utils.getSocketUserData(setup.playerSockets[0]);

      expect(showmanUserData?.gameId).toBe(setup.gameId);
      expect(playerUserData?.gameId).toBe(setup.gameId);
    });
  });

  it("should support multiple players joining", async () => {
    await suite.scenario(async () => {
      const setup = await suite.utils.setupGameTestEnvironment(suite.userRepo, suite.app, 3, 0);

      // Verify the setup was successful
      expect(setup.gameId).toBeDefined();
      expect(setup.showmanSocket).toBeDefined();
      expect(setup.playerSockets).toHaveLength(3);
      expect(setup.spectatorSockets).toHaveLength(0);

      // Verify all sockets are connected to the game
      const showmanUserData = await suite.utils.getSocketUserData(setup.showmanSocket);
      expect(showmanUserData?.gameId).toBe(setup.gameId);

      for (let i = 0; i < setup.playerSockets.length; i++) {
        const playerUserData = await suite.utils.getSocketUserData(setup.playerSockets[i]);
        expect(playerUserData?.gameId).toBe(setup.gameId);
      }
    });
  });

  it("should handle player leaving the game", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await suite.utils.setupGameTestEnvironment(suite.userRepo, suite.app, 1, 0);

      const leavePromise = suite.currentScenario.waitForEvent<GameLeaveEventPayload>(
        setup.playerSockets[0],
        SocketIOGameEvents.LEAVE
      );
      scenario.actor(setup.playerSockets[0]).emit(SocketIOGameEvents.LEAVE);
      const response = await leavePromise;

      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
    });
  });

  it("should handle repeated join/leave operations", async () => {
    await suite.scenario(async (scenario) => {
      const { gameId } = await suite.utils.createGameWithShowman(suite.app, suite.userRepo);

      const { socket: playerSocket } = await suite.utils.createGameClient(
        suite.app,
        suite.userRepo
      );

      const expectedOperations = 5;

      for (let index = 0; index < expectedOperations; index++) {
        const joinPromise = suite.currentScenario.waitForEvent(
          playerSocket,
          SocketIOGameEvents.GAME_DATA
        );
        scenario.actor(playerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER
        });
        await joinPromise;

        const leavePromise = suite.currentScenario.waitForEvent<GameLeaveEventPayload>(
          playerSocket,
          SocketIOGameEvents.LEAVE
        );
        scenario.actor(playerSocket).emit(SocketIOGameEvents.LEAVE);
        const leaveResponse = await leavePromise;

        expect(leaveResponse.user).toBeDefined();
      }

      await suite.utils.waitForActionsComplete(gameId);
    });
  });
});
