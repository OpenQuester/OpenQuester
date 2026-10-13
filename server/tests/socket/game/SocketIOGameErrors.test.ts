import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { Repository } from "typeorm";

import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameActionType } from "domain/enums/GameActionType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameJoinInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

describe("Socket Game Error Tests", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;
  }, 10000);

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Game Join Errors", () => {
    it("should reject joining non-existent game", async () => {
      await suite.scenario(async (scenario) => {
        const { socket: testSocket } = await utils.createGameClient(app, userRepo);

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          testSocket,
          SocketIOEvents.ERROR
        );

        scenario.actor(testSocket).emit(SocketIOGameEvents.JOIN, {
          gameId: "XXXX",
          role: PlayerRole.PLAYER
        } as GameJoinInputData);

        expect((await errorPromise).message).toBe("Game with id 'XXXX' not found");
      });
    });

    it("should reject joining same game twice", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { playerSockets } = setup;

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // Try joining the same game again
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.JOIN, {
          gameId: setup.gameId,
          role: PlayerRole.PLAYER
        } as GameJoinInputData);

        expect((await errorPromise).message).toBe("You are already in this game");
      });
    });
  });

  describe("Connection Error Handling", () => {
    it("should handle multiple rapid join/leave requests", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
        const { gameId } = setup;

        const clients = await Promise.all(
          Array(5)
            .fill(null)
            .map(async () => {
              return await utils.createGameClient(app, userRepo);
            })
        );

        for (const client of clients) {
          await utils.joinGame(client.socket, gameId);
          await utils.leaveGame(client.socket);
          scenario.actor(client.socket).disconnect();
        }

        clients.forEach((client) => {
          expect(client.socket.connected).toBeFalsy();
        });
      });
    });

    it("should handle disconnection during game", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { playerSockets, showmanSocket } = setup;

        const leavePromise = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);

        // Force disconnect a player
        scenario.actor(playerSockets[0]).disconnect();

        expect(await leavePromise).toBeDefined();
      });
    });
  });

  describe("Game Action Errors", () => {
    it("should handle invalid question picks", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket } = setup;

        // Start game
        await utils.startGame(showmanSocket);

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          showmanSocket,
          SocketIOEvents.ERROR
        );

        // Try to pick invalid question
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: 9999
        });

        expect((await errorPromise).message).toBe("Question not found");
      });
    });

    it("should handle unauthorized answer submissions", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        const { gameId, showmanSocket, playerSockets, spectatorSockets, playerUsers } = setup;

        await utils.startGame(showmanSocket);
        const question = await utils.findQuestionByType(PackageQuestionType.SIMPLE, gameId);
        expect(question).not.toBeNull();
        await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);
        await scenario.assert.waitForActionsComplete({ gameId });

        const before = await utils.getGameFromGameService(gameId);
        expect(before.gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(before.gameState.answeringPlayer).toBe(playerUsers[0].id);
        const playersBefore = before.players.map((player) => player.toDTO());
        const stateBefore = structuredClone(before.gameState);
        const actor = scenario.actor(playerSockets[0]);
        const recipients = [showmanSocket, ...playerSockets, ...spectatorSockets].map((socket) =>
          scenario.actor(socket)
        );
        const mark = scenario.mark();
        const probe = scenario.createAcceptedActionProbe({
          gameId,
          actionType: GameActionType.ANSWER_RESULT,
          socketId: playerSockets[0].id
        });
        const accepted = probe.waitForCount(1);

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // The question is answerable: rejection must come from the role guard.
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT
        });

        const [error] = await Promise.all([errorPromise, accepted]);
        expect(error.message).toBe("Only showman can send answer result");
        await scenario.assert.waitForActionsComplete({ gameId });
        expect(probe.records()).toHaveLength(1);
        scenario.assert.expectOutboundCommandCount({
          actor,
          event: SocketIOGameEvents.ANSWER_RESULT,
          afterSequence: mark,
          expectedCount: 1
        });
        await scenario.assert.noInboundMany({
          actors: recipients,
          event: SocketIOGameEvents.ANSWER_RESULT,
          afterSequence: mark,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
        });

        const after = await utils.getGameFromGameService(gameId);
        expect(after.gameState).toEqual(stateBefore);
        expect(after.players.map((player) => player.toDTO())).toEqual(playersBefore);
      });
    });

    it("should handle starting already started game", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket } = setup;

        // Start game normally first
        await utils.startGame(showmanSocket);

        // Verify game is started by checking if currentRound exists
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.currentRound).not.toBeNull();

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          showmanSocket,
          SocketIOEvents.ERROR
        );

        // Try to start game again - should emit error
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.START, {});
        const error = await errorPromise;

        expect(error.message).toBe("Game already started");
      });
    });
  });

  describe("Game State Errors", () => {
    it("should handle invalid game state transitions", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket } = setup;

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          showmanSocket,
          SocketIOEvents.ERROR
        );

        // Try to skip question without starting game
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});

        expect((await errorPromise).message).toBe("Game is not started yet");
      });
    });

    it("should handle creating game with invalid package ID", async () => {
      await suite.scenario(async () => {
        const { cookie } = await utils.createGameClient(app, userRepo);

        const gameData = {
          title: "Test Game",
          packageId: "invalid-package-id",
          isPrivate: false,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 10
        };

        const gameRes = await createHttpTestClient(suite.serverUrl)
          .post("/v1/games")
          .set("Cookie", cookie)
          .send(gameData);

        expect(gameRes.status).toBe(400);
        expect(gameRes.body.error || gameRes.body.message).toBeDefined();
      });
    });

    it("should handle invalid role actions", async () => {
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
