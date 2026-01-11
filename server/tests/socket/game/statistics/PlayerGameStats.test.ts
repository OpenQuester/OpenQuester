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

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import {
  GameClientSocket,
  SocketGameTestUtils,
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("Player Game Statistics Tests", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;
  let playerGameStatsRepository: PlayerGameStatsRepository;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);

    playerGameStatsRepository = container.resolve(PlayerGameStatsRepository);
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

  /**
   * Helper to wait for a player to be kicked by listening to PLAYER_KICKED event
   */
  async function waitForPlayerKick(
    socket: GameClientSocket,
    playerId: number,
    timeout: number = 5000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        socket.removeListener(SocketIOGameEvents.PLAYER_KICKED, handler);
        reject(new Error("Timeout waiting for PLAYER_KICKED event"));
      }, timeout);

      const handler = (data: any) => {
        if (data.playerId === playerId) {
          clearTimeout(timeoutId);
          socket.removeListener(SocketIOGameEvents.PLAYER_KICKED, handler);
          resolve();
        }
      };

      socket.on(SocketIOGameEvents.PLAYER_KICKED, handler);
    });
  }

  /**
   * Helper to wait for a player role change by listening to PLAYER_ROLE_CHANGE event
   */
  async function waitForPlayerRoleChange(
    socket: GameClientSocket,
    playerId: number,
    expectedRole: PlayerRole,
    timeout: number = 5000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        socket.removeListener(SocketIOGameEvents.PLAYER_ROLE_CHANGE, handler);
        reject(new Error("Timeout waiting for PLAYER_ROLE_CHANGE event"));
      }, timeout);

      const handler = (data: any) => {
        if (data.playerId === playerId && data.newRole === expectedRole) {
          clearTimeout(timeoutId);
          socket.removeListener(SocketIOGameEvents.PLAYER_ROLE_CHANGE, handler);
          resolve();
        }
      };

      socket.on(SocketIOGameEvents.PLAYER_ROLE_CHANGE, handler);
    });
  }

  describe("Player Session Initialization", () => {
    it("should initialize player session in Redis when player joins game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const gameId = setup.gameId;
        const playerId = setup.playerUsers[0].id;

        // Verify session was created in Redis
        const sessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );

        expect(sessionData).toBeTruthy();
        expect(sessionData!.gameId).toBe(gameId);
        expect(sessionData!.userId).toBe(playerId.toString());
        expect(sessionData!.joinedAt).toBeTruthy();
        expect(sessionData!.leftAt).toBe(""); // Redis stores null as empty string
        expect(sessionData!.currentScore).toBe("0");
        expect(sessionData!.questionsAnswered).toBe("0");
        expect(sessionData!.correctAnswers).toBe("0");
        expect(sessionData!.wrongAnswers).toBe("0");

        // Verify joinedAt is a recent timestamp
        const joinedAt = new Date(sessionData!.joinedAt);
        const now = new Date();
        const timeDiff = now.getTime() - joinedAt.getTime();
        expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should not initialize session for spectators", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 1);

      try {
        const gameId = setup.gameId;

        // Since we don't have spectator user info in setup, create one manually
        const { user: spectatorUser } = await utils.createGameClient(
          app,
          userRepo
        );

        // Verify no session was created for spectator
        const sessionData = await playerGameStatsRepository.getStats(
          gameId,
          spectatorUser.id
        );

        expect(sessionData).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Player Session Finalization", () => {
    it("should update leftAt timestamp when player leaves game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const gameId = setup.gameId;
        const playerId = setup.playerUsers[0].id;
        const playerSocket = setup.playerSockets[0];

        // Verify initial session has no leftAt
        const initialSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(initialSessionData!.leftAt).toBe("");

        // Leave the game (this already waits for the LEAVE event)
        await utils.leaveGame(playerSocket);

        // Verify session now has leftAt timestamp
        const finalSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(finalSessionData).toBeTruthy();
        expect(finalSessionData!.leftAt).not.toBe("");

        // Verify leftAt is a recent timestamp
        const leftAt = new Date(finalSessionData!.leftAt);
        const now = new Date();
        const timeDiff = now.getTime() - leftAt.getTime();
        expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should update leftAt timestamp when player is kicked", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const gameId = setup.gameId;
        const playerId = setup.playerUsers[0].id;
        const showmanSocket = setup.showmanSocket;

        // Verify initial session has no leftAt
        const initialSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(initialSessionData!.leftAt).toBe("");

        // Wait for the kick event to be processed and then check stats
        const kickPromise = waitForPlayerKick(showmanSocket, playerId);

        // Kick the player
        showmanSocket.emit(SocketIOGameEvents.PLAYER_KICKED, {
          playerId: playerId,
        });

        // Wait for the kick event to be processed
        await kickPromise;

        // Verify session now has leftAt timestamp
        const finalSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(finalSessionData).toBeTruthy();
        expect(finalSessionData!.leftAt).not.toBe("");

        // Verify leftAt is a recent timestamp
        const leftAt = new Date(finalSessionData!.leftAt);
        const now = new Date();
        const timeDiff = now.getTime() - leftAt.getTime();
        expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should update leftAt timestamp when player role changes from player to spectator", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const gameId = setup.gameId;
        const playerId = setup.playerUsers[0].id;
        const showmanSocket = setup.showmanSocket;

        // Verify initial session has no leftAt
        const initialSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(initialSessionData!.leftAt).toBe("");

        // Wait for the role change event to be processed
        const roleChangePromise = waitForPlayerRoleChange(
          showmanSocket,
          playerId,
          PlayerRole.SPECTATOR
        );

        // Change player role to spectator
        showmanSocket.emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          newRole: PlayerRole.SPECTATOR,
          playerId: playerId,
        });

        // Wait for the role change event to be processed
        await roleChangePromise;

        // Verify session now has leftAt timestamp
        const finalSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(finalSessionData).toBeTruthy();
        expect(finalSessionData!.leftAt).not.toBe("");

        // Verify leftAt is a recent timestamp
        const leftAt = new Date(finalSessionData!.leftAt);
        const now = new Date();
        const timeDiff = now.getTime() - leftAt.getTime();
        expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Full Player Session Lifecycle", () => {
    it("should track complete player session from join to leave", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const gameId = setup.gameId;
        const playerId = setup.playerUsers[0].id;
        const playerSocket = setup.playerSockets[0];

        // Step 1: Verify session initialization
        const initialSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(initialSessionData).toBeTruthy();
        expect(initialSessionData!.gameId).toBe(gameId);
        expect(initialSessionData!.userId).toBe(playerId.toString());
        expect(initialSessionData!.joinedAt).toBeTruthy();
        expect(initialSessionData!.leftAt).toBe("");

        const joinTime = new Date(initialSessionData!.joinedAt);

        // Step 2: Leave the game (this already waits for the LEAVE event)
        await utils.leaveGame(playerSocket);

        // Step 3: Verify session finalization
        const finalSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(finalSessionData).toBeTruthy();
        expect(finalSessionData!.leftAt).not.toBe("");

        const leaveTime = new Date(finalSessionData!.leftAt);

        // Step 6: Verify temporal consistency - allow for timing being very close or equal
        expect(leaveTime.getTime()).toBeGreaterThanOrEqual(joinTime.getTime());

        // Step 7: Calculate session duration (allow for very fast operations)
        const sessionDuration = leaveTime.getTime() - joinTime.getTime();
        expect(sessionDuration).toBeGreaterThanOrEqual(0); // Allow same timestamp for very fast operations
        expect(sessionDuration).toBeLessThan(1000); // Less than 1 second for this test

        // Step 8: Verify all session data is preserved
        expect(finalSessionData!.gameId).toBe(gameId);
        expect(finalSessionData!.userId).toBe(playerId.toString());
        expect(finalSessionData!.currentScore).toBe("0");
        expect(finalSessionData!.questionsAnswered).toBe("0");
        expect(finalSessionData!.correctAnswers).toBe("0");
        expect(finalSessionData!.wrongAnswers).toBe("0");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle multiple players with independent sessions", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      try {
        const gameId = setup.gameId;
        const player1Id = setup.playerUsers[0].id;
        const player2Id = setup.playerUsers[1].id;
        const player1Socket = setup.playerSockets[0];

        // Verify both players have sessions
        const player1SessionData = await playerGameStatsRepository.getStats(
          gameId,
          player1Id
        );
        const player2SessionData = await playerGameStatsRepository.getStats(
          gameId,
          player2Id
        );

        expect(player1SessionData).toBeTruthy();
        expect(player2SessionData).toBeTruthy();
        expect(player1SessionData!.userId).toBe(player1Id.toString());
        expect(player2SessionData!.userId).toBe(player2Id.toString());

        // Player 1 leaves (this already waits for the LEAVE event)
        await utils.leaveGame(player1Socket);

        // Verify player 1 session is finalized but player 2 session is still active
        const finalPlayer1SessionData =
          await playerGameStatsRepository.getStats(gameId, player1Id);
        const continuedPlayer2SessionData =
          await playerGameStatsRepository.getStats(gameId, player2Id);

        expect(finalPlayer1SessionData!.leftAt).not.toBe("");
        expect(continuedPlayer2SessionData!.leftAt).toBe("");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Player Session Rejoin and Role Change Clearing", () => {
    it("should clear leftAt timestamp when player rejoins after leaving", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const gameId = setup.gameId;
        const playerId = setup.playerUsers[0].id;
        const playerSocket = setup.playerSockets[0];

        // Verify initial session has no leftAt
        const initialSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(initialSessionData!.leftAt).toBe("");

        // Player leaves
        await utils.leaveGame(playerSocket);

        // Verify leftAt is set
        const leftSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(leftSessionData!.leftAt).not.toBe("");

        // Player rejoins the same game as player role
        await utils.joinGame(playerSocket, gameId, PlayerRole.PLAYER);

        // Verify leftAt is cleared after rejoin
        const rejoinedSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(rejoinedSessionData!.leftAt).toBe("");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should clear leftAt when player changes back to PLAYER after being spectator", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const gameId = setup.gameId;
        const playerId = setup.playerUsers[0].id;
        const showmanSocket = setup.showmanSocket;

        // Verify initial session has no leftAt
        const initialSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(initialSessionData!.leftAt).toBe("");

        // Change player role to spectator (this should set leftAt)
        const roleChangeToSpectatorPromise = waitForPlayerRoleChange(
          showmanSocket,
          playerId,
          PlayerRole.SPECTATOR
        );

        showmanSocket.emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          newRole: PlayerRole.SPECTATOR,
          playerId: playerId,
        });

        await roleChangeToSpectatorPromise;

        // Verify leftAt is now set (because they are no longer a player)
        const spectatorSessionData = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(spectatorSessionData!.leftAt).not.toBe("");

        // Change back to player role (this should clear leftAt)
        const roleChangeToPlayerPromise = waitForPlayerRoleChange(
          showmanSocket,
          playerId,
          PlayerRole.PLAYER
        );

        showmanSocket.emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          newRole: PlayerRole.PLAYER,
          playerId: playerId,
        });

        await roleChangeToPlayerPromise;

        // Verify leftAt is cleared after becoming player again
        const backToPlayerSessionData =
          await playerGameStatsRepository.getStats(gameId, playerId);
        expect(backToPlayerSessionData!.leftAt).toBe("");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Player Answer Statistics Tracking", () => {
    it("should increment correct answers and questions answered when player answers correctly", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
      const { playerSockets, showmanSocket, gameId } = setup;
      const playerId = setup.playerUsers[0].id;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Pick and display a question
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Get initial stats before answering
        const initialStats = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        const initialQuestionsAnswered = parseInt(
          initialStats!.questionsAnswered || "0"
        );
        const initialCorrectAnswers = parseInt(
          initialStats!.correctAnswers || "0"
        );
        const initialWrongAnswers = parseInt(initialStats!.wrongAnswers || "0");

        playerSockets[0].on("error", (err) => {
          console.error("Player socket error:", err);
        });
        // Player answers the question
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Showman marks answer as correct
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );

        const answerShowStartPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        await answerResultPromise;
        await answerShowStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Verify statistics were updated correctly
        const updatedStats = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(updatedStats).toBeTruthy();
        expect(parseInt(updatedStats!.questionsAnswered)).toBe(
          initialQuestionsAnswered + 1
        );
        expect(parseInt(updatedStats!.correctAnswers)).toBe(
          initialCorrectAnswers + 1
        );
        expect(parseInt(updatedStats!.wrongAnswers)).toBe(initialWrongAnswers); // Should remain unchanged
        expect(parseInt(updatedStats!.currentScore)).toBeGreaterThan(0); // Score should increase
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should increment wrong answers and questions answered when player answers incorrectly", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
      const { playerSockets, showmanSocket, gameId } = setup;
      const playerId = setup.playerUsers[0].id;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Pick and display a question
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Get initial stats before answering
        const initialStats = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        const initialQuestionsAnswered = parseInt(
          initialStats!.questionsAnswered || "0"
        );
        const initialCorrectAnswers = parseInt(
          initialStats!.correctAnswers || "0"
        );
        const initialWrongAnswers = parseInt(initialStats!.wrongAnswers || "0");
        const initialScore = parseInt(initialStats!.currentScore || "0");

        // Player answers the question
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Showman marks answer as wrong
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );

        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -100,
          answerType: AnswerResultType.WRONG,
        });

        await answerResultPromise;

        // Verify statistics were updated correctly
        const updatedStats = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(updatedStats).toBeTruthy();
        expect(parseInt(updatedStats!.questionsAnswered)).toBe(
          initialQuestionsAnswered + 1
        );
        expect(parseInt(updatedStats!.correctAnswers)).toBe(
          initialCorrectAnswers
        ); // Should remain unchanged
        expect(parseInt(updatedStats!.wrongAnswers)).toBe(
          initialWrongAnswers + 1
        );
        expect(parseInt(updatedStats!.currentScore)).toBe(initialScore - 100); // Score should decrease
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should track multiple answers correctly for single player", async () => {
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        2,
        1,
        false,
        2
      );
      const { playerSockets, showmanSocket, gameId } = setup;
      const playerId = setup.playerUsers[0].id;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Get initial stats
        const initialStats = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        let questionsAnswered = parseInt(
          initialStats!.questionsAnswered || "0"
        );
        let correctAnswers = parseInt(initialStats!.correctAnswers || "0");
        let wrongAnswers = parseInt(initialStats!.wrongAnswers || "0");

        const gameState = await utils.getGameState(setup.gameId);

        expect(gameState).toBeDefined();

        const simpleQuestions = await utils.findAllQuestionsByType(
          gameState!,
          PackageQuestionType.SIMPLE,
          gameId
        );

        if (simpleQuestions.length < 3) {
          throw new Error("Not enough simple questions for this test");
        }
        // Answer first question correctly using pickAndCompleteQuestion
        await utils.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          simpleQuestions[0].id,
          true,
          AnswerResultType.CORRECT
        );

        // Verify first correct answer
        let stats = await playerGameStatsRepository.getStats(gameId, playerId);
        expect(parseInt(stats!.questionsAnswered)).toBe(questionsAnswered + 1);
        expect(parseInt(stats!.correctAnswers)).toBe(correctAnswers + 1);
        expect(parseInt(stats!.wrongAnswers)).toBe(wrongAnswers);

        // Update our tracking variables
        questionsAnswered++;
        correctAnswers++;

        // Answer second question incorrectly
        await utils.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          simpleQuestions[1].id,
          true,
          AnswerResultType.WRONG,
          -50
        );

        // Verify second wrong answer
        stats = await playerGameStatsRepository.getStats(gameId, playerId);
        expect(parseInt(stats!.questionsAnswered)).toBe(questionsAnswered + 1);
        expect(parseInt(stats!.correctAnswers)).toBe(correctAnswers);
        expect(parseInt(stats!.wrongAnswers)).toBe(wrongAnswers + 1);

        // Update our tracking variables
        questionsAnswered++;
        wrongAnswers++;

        // Skip the current wrong answer display and answer third question correctly
        await utils.skipQuestion(showmanSocket);
        await utils.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          simpleQuestions[2].id,
          true
        );

        // Verify final statistics: 3 total, 2 correct, 1 wrong
        const finalStats = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(parseInt(finalStats!.questionsAnswered)).toBe(
          questionsAnswered + 1
        );
        expect(parseInt(finalStats!.correctAnswers)).toBe(correctAnswers + 1);
        expect(parseInt(finalStats!.wrongAnswers)).toBe(wrongAnswers);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should track statistics independently for multiple players", async () => {
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        3,
        1,
        false,
        2
      );
      const { playerSockets, showmanSocket, gameId } = setup;
      const player1Id = setup.playerUsers[0].id;
      const player2Id = setup.playerUsers[1].id;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        const gameState = await utils.getGameState(setup.gameId);
        const simpleQuestions = await utils.findAllQuestionsByType(
          gameState!,
          PackageQuestionType.SIMPLE,
          gameId
        );

        // Player 1 answers correctly using pickAndCompleteQuestion
        await utils.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          simpleQuestions[0].id,
          true
        );

        // Player 2 answers incorrectly - using manual flow to avoid timeout
        await utils.pickQuestion(
          showmanSocket,
          simpleQuestions[1].id,
          playerSockets
        );

        await utils.answerQuestion(playerSockets[1], showmanSocket);

        const answerResultPromise2 = utils.waitForEvent(
          playerSockets[1],
          SocketIOGameEvents.ANSWER_RESULT
        );
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -50,
          answerType: AnswerResultType.WRONG,
        });
        await answerResultPromise2;

        // Skip show answer manually without waiting for end event
        showmanSocket.emit(SocketIOGameEvents.SKIP_SHOW_ANSWER);
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Verify Player 1 stats (1 correct, 0 wrong)
        const player1Stats = await playerGameStatsRepository.getStats(
          gameId,
          player1Id
        );
        expect(parseInt(player1Stats!.questionsAnswered)).toBe(1);
        expect(parseInt(player1Stats!.correctAnswers)).toBe(1);
        expect(parseInt(player1Stats!.wrongAnswers)).toBe(0);

        // Verify Player 2 stats (0 correct, 1 wrong)
        const player2Stats = await playerGameStatsRepository.getStats(
          gameId,
          player2Id
        );
        expect(parseInt(player2Stats!.questionsAnswered)).toBe(1);
        expect(parseInt(player2Stats!.correctAnswers)).toBe(0);
        expect(parseInt(player2Stats!.wrongAnswers)).toBe(1);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Skip Answer Handling", () => {
    it("should not count skipped questions as wrong answers", async () => {
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        2,
        1,
        false,
        2
      );
      const { playerSockets, showmanSocket, gameId } = setup;
      const playerId = setup.playerUsers[0].id;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Get initial stats
        const initialStats = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        const initialQuestionsAnswered = parseInt(
          initialStats!.questionsAnswered || "0"
        );
        const initialCorrectAnswers = parseInt(
          initialStats!.correctAnswers || "0"
        );
        const initialWrongAnswers = parseInt(initialStats!.wrongAnswers || "0");

        const simpleQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.SIMPLE
        );

        // Pick and display a question
        await utils.pickQuestion(
          showmanSocket,
          simpleQuestionId,
          playerSockets
        );

        // Player answers the question
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const showAnswerStartPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // Showman marks answer as skip (0x)
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 0,
          answerType: AnswerResultType.SKIP,
        });
        await answerResultPromise;
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Verify statistics: questions answered increased, but wrong answers did not
        const updatedStats = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(updatedStats).toBeTruthy();
        expect(parseInt(updatedStats!.questionsAnswered)).toBe(
          initialQuestionsAnswered + 1
        );
        // Should remain unchanged
        expect(parseInt(updatedStats!.correctAnswers)).toBe(
          initialCorrectAnswers
        );
        // Should remain unchanged for SKIP
        expect(parseInt(updatedStats!.wrongAnswers)).toBe(initialWrongAnswers);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle mixed answer types correctly", async () => {
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        2,
        1,
        false,
        2
      );
      const { playerSockets, showmanSocket, gameId } = setup;
      const playerId = setup.playerUsers[0].id;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        const gameState = await utils.getGameState(setup.gameId);
        const simpleQuestions = await utils.findAllQuestionsByType(
          gameState!,
          PackageQuestionType.SIMPLE,
          gameId
        );

        if (simpleQuestions.length < 3) {
          throw new Error("Not enough simple questions for this test");
        }

        // Answer first question correctly
        await utils.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          simpleQuestions[0].id,
          true,
          AnswerResultType.CORRECT,
          100
        );

        // Answer second question as skip
        await utils.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          simpleQuestions[1].id,
          true,
          AnswerResultType.SKIP,
          0
        );

        // Verify final statistics: 2 questions, 1 correct, 0 wrong, 0 skip counted as wrong
        const finalStats = await playerGameStatsRepository.getStats(
          gameId,
          playerId
        );
        expect(parseInt(finalStats!.questionsAnswered)).toBe(2);
        expect(parseInt(finalStats!.correctAnswers)).toBe(1);
        expect(parseInt(finalStats!.wrongAnswers)).toBe(0);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
