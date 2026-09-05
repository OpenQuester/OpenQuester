import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Socket Game Flow Tests", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  it("should set currentTurnPlayerId to the player with the lowest score on simple round start", async () => {
    await suite.scenario(async (scenario) => {
      // Setup a game with 3 players and two simple rounds (no final round)
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0, false);
      const { showmanSocket } = setup;

      // Start the game
      await utils.startGame(showmanSocket);

      // Artificially set player scores
      // Player 0: 10, Player 1: -5, Player 2: 0
      await utils.setPlayerScore(setup.gameId, setup.playerUsers[0].id, 10);
      await utils.setPlayerScore(setup.gameId, setup.playerUsers[1].id, -5);
      await utils.setPlayerScore(setup.gameId, setup.playerUsers[2].id, 0);

      // Progress to next round (should be simple round)
      const nextRoundPromise = scenario.waitForEvent<GameNextRoundEventPayload>(
        showmanSocket,
        SocketIOGameEvents.NEXT_ROUND
      );
      await utils.progressToNextRound(showmanSocket);
      const { gameState } = await nextRoundPromise;

      // The player with the lowest score (-5) should be the currentTurnPlayerId
      expect(gameState.currentRound!.type).toBe(PackageRoundType.SIMPLE);
      expect(gameState.currentTurnPlayerId).toBe(setup.playerUsers[1].id);
    });
  });

  describe("Game Joining Flow", () => {
    it("should allow normal game joining", async () => {
      await suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

        expect(setup.gameId).toBeDefined();
        expect(setup.showmanSocket).toBeDefined();
        expect(setup.playerSockets).toHaveLength(1);
      });
    });

    it("should allow spectator joining", async () => {
      await suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);

        expect(setup.gameId).toBeDefined();
        expect(setup.showmanSocket).toBeDefined();
        expect(setup.playerSockets).toHaveLength(1);
        expect(setup.spectatorSockets).toHaveLength(1);

        const spectator = setup.spectatorSockets[0];
        expect(spectator).toBeDefined();
      });
    });
  });

  describe("Game Leaving Flow", () => {
    it("should handle player leaving gracefully", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { playerSockets, showmanSocket } = setup;

        const leavePromise = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);

        // Player leaves the game
        await utils.leaveGame(playerSockets[0]);

        expect(await leavePromise).toBeDefined();
      });
    });

    it("should handle showman leaving", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        const leavePromise = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.LEAVE);

        // Showman leaves the game
        await utils.leaveGame(showmanSocket);

        expect(await leavePromise).toBeDefined();
      });
    });

    it("should no-op when leaving after already leaving the game", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { playerSockets, showmanSocket } = setup;

        await utils.leaveGame(playerSockets[0]);

        const playerSessionAfterLeave = await utils.getSocketUserData(playerSockets[0]);
        expect(playerSessionAfterLeave?.gameId).toBeNull();

        const afterLeave = scenario.mark();
        const player = scenario.actor(playerSockets[0]);
        const recipients = [showmanSocket, ...playerSockets].map((socket) =>
          scenario.actor(socket)
        );
        await suite.runAndWaitForSocketHandler(player, SocketIOGameEvents.LEAVE, () =>
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.LEAVE)
        );
        await Promise.all([
          scenario.assert.noInboundMany({
            actors: recipients,
            event: SocketIOGameEvents.LEAVE,
            afterSequence: afterLeave,
            durationMs: 100
          }),
          scenario.assert.noInbound({
            actor: player,
            event: SocketIOEvents.ERROR,
            afterSequence: afterLeave,
            durationMs: 100
          })
        ]);

        const playerSessionAfterNoop = await utils.getSocketUserData(playerSockets[0]);
        expect(playerSessionAfterNoop?.gameId).toBeNull();
      });
    });
  });

  describe("Game Start Flow", () => {
    it("should allow showman to start the game", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        const startPromise = scenario.waitForEvent<{ currentRound: unknown }>(
          playerSockets[0],
          SocketIOGameEvents.START
        );

        // Start the game
        await utils.startGame(showmanSocket);

        expect((await startPromise).currentRound).toBeDefined();
      });
    });

    it("should reject player to start the game", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { playerSockets } = setup;

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // Try to start game as player
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.START, {});

        expect((await errorPromise).message).toBe("Only showman can start the game");
      });
    });
  });
});
