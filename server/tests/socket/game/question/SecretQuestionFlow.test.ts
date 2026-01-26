import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { SecretQuestionPickedBroadcastData } from "domain/types/socket/events/game/SecretQuestionPickedEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  SecretQuestionTransferBroadcastData,
  SecretQuestionTransferInputData,
} from "domain/types/socket/game/SecretQuestionTransferData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("Secret Question Flow Tests", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
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
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Secret Question Basic Flow", () => {
    it("should handle secret question with ANY transfer type - invalid self-transfer then valid transfer", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Find a secret question with ANY transfer type
        const secretQuestion = await utils.findQuestionByType(
          PackageQuestionType.SECRET,
          gameId,
          PackageQuestionTransferType.ANY
        );

        expect(secretQuestion).toBeDefined();
        expect(secretQuestion!.id).toBeGreaterThan(0);

        // Set up event listeners for secret question events
        const secretQuestionPickedPromise =
          utils.waitForEvent<SecretQuestionPickedBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.SECRET_QUESTION_PICKED
          );

        // Pick the secret question
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: secretQuestion!.id,
        });

        const secretPickedEvent = await secretQuestionPickedPromise;

        // Verify secret question picked event
        expect(secretPickedEvent.pickerPlayerId).toBe(setup.showmanUser.id);
        expect(secretPickedEvent.transferType).toBe(
          PackageQuestionTransferType.ANY
        );
        expect(secretPickedEvent.questionId).toBe(secretQuestion!.id);

        // Verify game is in SECRET_TRANSFER state
        const transferState = await utils.getGameState(gameId);
        expect(transferState!.questionState).toBe(
          QuestionState.SECRET_TRANSFER
        );
        expect(transferState!.secretQuestionData).toBeDefined();
        expect(transferState!.secretQuestionData!.pickerPlayerId).toBe(
          setup.showmanUser.id
        );

        // Set up listeners for transfer error (showman cannot transfer to themselves - invalid target)
        const errorPromise = utils.waitForEvent(showmanSocket, "error", 2000);

        // Showman (picker) tries to transfer question to themselves (should fail - invalid target)
        showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: setup.showmanUser.id, // Self-transfer attempt by showman (picker)
        } satisfies SecretQuestionTransferInputData);

        const error = await errorPromise;

        // Verify error occurred (showman is not a valid transfer target)
        expect(error.message).toBeDefined();
        expect(error.message).toBe("Invalid transfer target");

        // Verify game is still in SECRET_TRANSFER state (transfer failed)
        const stillTransferState = await utils.getGameState(gameId);
        expect(stillTransferState!.questionState).toBe(
          QuestionState.SECRET_TRANSFER
        );
        expect(stillTransferState!.secretQuestionData).toBeDefined();

        // Now transfer to a valid player target (should succeed)
        const transferBroadcastPromise =
          utils.waitForEvent<SecretQuestionTransferBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.SECRET_QUESTION_TRANSFER
          );

        const questionDataPromise =
          utils.waitForEvent<GameQuestionDataEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.QUESTION_DATA
          );

        // Showman transfers question to player[0] (should work)
        showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: setup.playerUsers[0].id,
        } satisfies SecretQuestionTransferInputData);

        const [transferEvent, questionDataEvent] = await Promise.all([
          transferBroadcastPromise,
          questionDataPromise,
        ]);

        // Verify transfer event (showman to player[0])
        expect(transferEvent.fromPlayerId).toBe(setup.showmanUser.id);
        expect(transferEvent.toPlayerId).toBe(setup.playerUsers[0].id); // Showman transfers to player[0]
        expect(transferEvent.questionId).toBe(secretQuestion!.id);

        // Verify question data is sent after transfer
        expect(questionDataEvent.data).toBeDefined();
        expect(questionDataEvent.timer).toBeDefined();

        // Verify question state is ANSWERING
        const showingState = await utils.getGameState(gameId);
        expect(showingState!.questionState).toBe(QuestionState.ANSWERING);
        expect(showingState!.secretQuestionData).toBeDefined();
        expect(showingState!.currentQuestion).toBeDefined();

        const showAnswerStartPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_START,
          2000
        );

        // Showman gives answer result
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 300,
          answerType: AnswerResultType.CORRECT,
        });

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Verify game returns to choosing state
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
        expect(finalState!.secretQuestionData).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject transfer to player who joined after secret question picked", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        const secretQuestion = await utils.findQuestionByType(
          PackageQuestionType.SECRET,
          gameId,
          PackageQuestionTransferType.ANY
        );

        const secretQuestionPickedPromise =
          utils.waitForEvent<SecretQuestionPickedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.SECRET_QUESTION_PICKED
          );

        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: secretQuestion!.id,
        });

        await secretQuestionPickedPromise;

        const { socket: lateJoinerSocket, user: lateJoinerUser } =
          await utils.createGameClient(app, userRepo);

        try {
          await utils.joinGame(lateJoinerSocket, gameId, PlayerRole.PLAYER);
          await utils.waitForActionsComplete(gameId);

          const game = await utils.getGameFromGameService(gameId);
          expect(
            game.gameState.questionEligiblePlayers?.includes(lateJoinerUser.id)
          ).toBe(false);

          const errorPromise = new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("No error received - transfer was allowed"));
            }, 3000);

            showmanSocket.once(SocketIOEvents.ERROR, (error: any) => {
              clearTimeout(timeout);
              resolve(error.message);
            });
          });

          showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
            targetPlayerId: lateJoinerUser.id,
          } satisfies SecretQuestionTransferInputData);

          const errorMessage = await errorPromise;
          expect(errorMessage.toLowerCase()).toContain("cannot participate");

          const transferState = await utils.getGameState(gameId);
          expect(transferState!.questionState).toBe(
            QuestionState.SECRET_TRANSFER
          );
        } finally {
          await utils.disconnectAndCleanup(lateJoinerSocket);
        }
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle secret question with ANY transfer type - transfer to another player", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Find a secret question
        const secretQuestion = await utils.findQuestionByType(
          PackageQuestionType.SECRET,
          gameId
        );

        expect(secretQuestion).toBeDefined();

        // Set up event listeners
        const secretQuestionPickedPromise = utils.waitForEvent(
          playerSockets[1],
          SocketIOGameEvents.SECRET_QUESTION_PICKED
        );

        // Pick the secret question
        await utils.pickQuestion(
          showmanSocket,
          secretQuestion!.id,
          playerSockets
        );
        await secretQuestionPickedPromise;

        // Set up listeners for transfer and question data
        const transferBroadcastPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.SECRET_QUESTION_TRANSFER
        );

        const questionDataPromise = utils.waitForEvent(
          playerSockets[1],
          SocketIOGameEvents.QUESTION_DATA
        );

        // Player A transfers question to Player B
        showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: setup.playerUsers[1].id,
        });

        const [transferEvent] = await Promise.all([
          transferBroadcastPromise,
          questionDataPromise,
        ]);

        // Verify transfer
        expect(transferEvent.fromPlayerId).toBe(setup.showmanUser.id);
        expect(transferEvent.toPlayerId).toBe(setup.playerUsers[1].id);

        const answerShowStartPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 300,
          answerType: AnswerResultType.CORRECT,
        });

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );
        await answerShowStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Secret Question Transfer Restrictions", () => {
    it("should prevent self-transfer when transferType is EXCEPT_CURRENT", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        const secretQuestion = await utils.findQuestionByType(
          PackageQuestionType.SECRET,
          gameId
        );

        expect(secretQuestion).toBeDefined();

        // Pick the secret question first
        const secretPickedPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.SECRET_QUESTION_PICKED
        );

        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: secretQuestion!.id,
        });

        await secretPickedPromise;

        // Now modify the game state to set transferType to EXCEPT_CURRENT
        // AND make one of the players the picker (instead of showman) to test the actual logic
        const game = await utils.getGameFromGameService(gameId);
        expect(game.gameState.secretQuestionData).toBeDefined();

        game.gameState.secretQuestionData!.transferType =
          PackageQuestionTransferType.EXCEPT_CURRENT;
        game.gameState.secretQuestionData!.pickerPlayerId =
          setup.playerUsers[0].id;
        await utils.updateGame(game);

        // Verify the transfer type was changed
        const updatedState = await utils.getGameState(gameId);
        expect(updatedState!.secretQuestionData!.transferType).toBe(
          PackageQuestionTransferType.EXCEPT_CURRENT
        );
        expect(updatedState!.secretQuestionData!.pickerPlayerId).toBe(
          setup.playerUsers[0].id
        );

        const errorPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // Player[0] (who is now the picker) tries to transfer to themselves
        playerSockets[0].emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: setup.playerUsers[0].id, // Transfer to self (picker)
        });

        const error = await errorPromise;
        expect(error.message).toBeDefined();
        expect(error.message).toBe(
          "Cannot transfer secret question to yourself"
        );

        // Verify game is still in SECRET_TRANSFER state (transfer failed)
        const stillTransferState = await utils.getGameState(gameId);
        expect(stillTransferState!.questionState).toBe(
          QuestionState.SECRET_TRANSFER
        );
        expect(stillTransferState!.secretQuestionData).toBeDefined();

        // But transfer to a different player should work
        const transferPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.SECRET_QUESTION_TRANSFER,
          2000
        );

        // Player[0] (picker) transfers to Player[1] - this should work
        playerSockets[0].emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: setup.playerUsers[1].id, // Transfer to different player
        });

        const transfer =
          (await transferPromise) as SecretQuestionTransferBroadcastData;

        expect(transfer.fromPlayerId).toBe(setup.playerUsers[0].id);
        expect(transfer.toPlayerId).toBe(setup.playerUsers[1].id);
        expect(transfer.questionId).toBe(secretQuestion!.id);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should prevent transfer to invalid players", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        const secretQuestion = await utils.findQuestionByType(
          PackageQuestionType.SECRET,
          gameId
        );

        expect(secretQuestion).toBeDefined();

        const secretPickedPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.SECRET_QUESTION_PICKED
        );

        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: secretQuestion!.id,
        });

        await secretPickedPromise;

        // Try to transfer to non-existent player
        const errorPromise = utils.waitForEvent(showmanSocket, "error", 2000);

        showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: 99999, // Invalid player ID
        });

        const error = await errorPromise;
        expect(error.message).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should not send answer data to players while sending full data to showman", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        const secretQuestion = await utils.findQuestionByType(
          PackageQuestionType.SECRET,
          gameId
        );

        expect(secretQuestion).toBeDefined();

        // Pick the secret question
        const secretPickedPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.SECRET_QUESTION_PICKED
        );

        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: secretQuestion!.id,
        });

        await secretPickedPromise;

        // Set up promises to capture data sent to both showman and player
        const showmanDataPromise =
          utils.waitForEvent<GameQuestionDataEventPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_DATA
          );

        const playerDataPromise =
          utils.waitForEvent<GameQuestionDataEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.QUESTION_DATA
          );

        // Transfer question to player
        showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: setup.playerUsers[0].id,
        });

        const [showmanData, playerData] = await Promise.all([
          showmanDataPromise,
          playerDataPromise,
        ]);

        // Showman should receive full question data including answer
        expect(showmanData.data).toBeDefined();
        expect(
          (showmanData.data as PackageQuestionDTO).answerText
        ).toBeDefined();
        expect((showmanData.data as PackageQuestionDTO).answerText).toBe(
          "Secret answer"
        );

        // Player should receive question data but WITHOUT answer information
        expect(playerData.data).toBeDefined();
        expect(playerData.data.text).toBe("Secret question text"); // Question text should be present
        expect(playerData.data.type).toBe(PackageQuestionType.SECRET);

        // Answer data should be excluded for players
        // Use `as any` since SimplePackageQuestionDTO doesn't have these fields (and shouldn't)
        expect((playerData.data as any).answerText).toBeUndefined();
        expect((playerData.data as any).answerFiles).toBeUndefined();
        expect((playerData.data as any).answerHint).toBeUndefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
