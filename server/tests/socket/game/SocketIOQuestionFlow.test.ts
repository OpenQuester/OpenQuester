import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameActionType } from "domain/enums/GameActionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  AnswerSubmittedBroadcastData,
  QuestionSkipBroadcastData,
  QuestionUnskipBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

describe("Socket Question Flow Tests", () => {
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

  describe("Question Selection", () => {
    it("should allow showman to pick a question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start the game first
        await utils.startGame(showmanSocket);

        const questionDataPromise = scenario.waitForEvent<{
          data: unknown;
          timer: unknown;
        }>(playerSockets[0], SocketIOGameEvents.QUESTION_DATA);

        // Pick a question using the helper method to get valid question ID
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const data = await questionDataPromise;
        expect(data.data).toBeDefined();
        expect(data.timer).toBeDefined();
      }));

    it("should allow player to pick a question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start the game first
        await utils.startGame(showmanSocket);

        const questionDataPromise = scenario.waitForEvent<{
          data: unknown;
          timer: unknown;
        }>(playerSockets[0], SocketIOGameEvents.QUESTION_DATA);

        // Pick a question using the helper method to get valid question ID
        await utils.pickQuestion(playerSockets[0], undefined, playerSockets);

        const data = await questionDataPromise;
        expect(data.data).toBeDefined();
        expect(data.timer).toBeDefined();
      }));
  });

  describe("Question Answering", () => {
    it("should handle correct answer submission", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const answerShowStartPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // Set up event listeners BEFORE emitting the answer result
        const answerShowEndPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_END
        );

        // Submit correct answer result
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for state transition to SHOWING_ANSWER
        await answerShowStartPromise;

        // Skip show answer phase immediately for faster test
        await utils.skipShowAnswer(showmanSocket);
        await answerShowEndPromise;

        // Verify question finish data is correct
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
      }));

    it("should broadcast submitted answer text to all game clients", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        const { showmanSocket, playerSockets, spectatorSockets } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const answerText = "Visible normal-round answer";
        const submittedPromises = [
          scenario.waitForEvent<AnswerSubmittedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.ANSWER_SUBMITTED
          ),
          scenario.waitForEvent<AnswerSubmittedBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_SUBMITTED
          ),
          scenario.waitForEvent<AnswerSubmittedBroadcastData>(
            playerSockets[1],
            SocketIOGameEvents.ANSWER_SUBMITTED
          ),
          scenario.waitForEvent<AnswerSubmittedBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.ANSWER_SUBMITTED
          )
        ];

        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
          answerText
        });

        const submittedEvents = await Promise.all(submittedPromises);
        expect(submittedEvents).toEqual([
          { answerText },
          { answerText },
          { answerText },
          { answerText }
        ]);
      }));

    it("should handle incorrect answer submission", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const answerResultPromise = scenario.waitForEvent<QuestionAnswerResultEventPayload>(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Submit wrong answer result
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -100,
          answerType: AnswerResultType.WRONG
        });

        const data = await answerResultPromise;
        expect(data.answerResult).toBeDefined();
        expect(data.answerResult.answerType).toBe(AnswerResultType.WRONG);
        expect(data.answerResult.result).toBe(-100);
        expect(data.timer).toBeDefined();
      }));
  });

  describe("Question Control", () => {
    it("should handle question skipping", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const questionFinishPromise = scenario.waitForEvent<QuestionFinishEventPayload>(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_FINISH
        );

        // Skip question
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});

        const data = await questionFinishPromise;
        expect(data.answerFiles).toBeDefined();
        expect(data.answerText).toBeDefined();
      }));

    it("should handle simultaneous answer attempts", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets } = setup;

        const showmanActor = scenario.actor(showmanSocket);
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const afterAnswerAttempts = scenario.mark();
        const answerEventPromise = scenario.assert.inbound({
          actor: showmanActor,
          event: SocketIOGameEvents.QUESTION_ANSWER,
          afterSequence: afterAnswerAttempts,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          description: "the single accepted simultaneous answer"
        });

        const answerActionsAccepted = utils.waitForSubmittedActions(
          setup.gameId,
          playerSockets.length,
          GameActionType.QUESTION_ANSWER
        );

        playerSockets.forEach((socket) => {
          scenario.actor(socket).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        });

        await answerActionsAccepted;
        await answerEventPromise;
        await utils.waitForActionsComplete(setup.gameId);

        const answerEvents = scenario.assert
          .records({ actor: showmanActor, direction: "inbound" })
          .filter(
            (record) =>
              record.sequence > afterAnswerAttempts &&
              record.direction === "inbound" &&
              record.event === SocketIOGameEvents.QUESTION_ANSWER
          );
        expect(answerEvents).toHaveLength(1);
      }));

    it("should handle question skip during answer submission", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets } = setup;

        // Present question to players
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player begins answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify player is answering
        const answeringState = await utils.getGameState(setup.gameId);
        expect(answeringState).toBeDefined();
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBeDefined();

        // Showman skips while player is answering
        const questionFinishPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_FINISH
        );
        const showAnswerStartPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});

        const questionFinishData = (await questionFinishPromise) as QuestionFinishEventPayload;

        // Verify appropriate conflict resolution
        expect(questionFinishData.answerFiles).toBeDefined();
        expect(questionFinishData.answerText).toBeDefined();

        // Wait for SHOWING_ANSWER phase and skip it
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Verify game transitions properly and no scoring issues
        const finalState = await utils.getGameState(setup.gameId);
        expect(finalState).toBeDefined();
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
        expect(finalState!.answeringPlayer).toBeNull();
        expect(finalState!.currentQuestion).toBeNull();
      }));
  });

  describe("Question Selection", () => {
    it("should handle selecting already played question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and answer a question
        await utils.startGame(showmanSocket);
        const firstQuestionId = await utils.getFirstAvailableQuestionId(setup.gameId);
        await utils.pickQuestion(showmanSocket, firstQuestionId, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Complete the question with correct answer
        const answerShowStartPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        const answerShowEndPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_END
        );

        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for state transition to SHOWING_ANSWER before skipping
        await answerShowStartPromise;

        await utils.skipShowAnswer(showmanSocket);
        await answerShowEndPromise;

        // Verify we're back in choosing state
        const choosingState = await utils.getGameState(setup.gameId);
        expect(choosingState).toBeDefined();
        expect(choosingState!.questionState).toBe(QuestionState.CHOOSING);
        expect(choosingState!.currentQuestion).toBeNull();

        // Attempt to select same question again - should emit error
        const errorPromise = scenario.waitForEvent(showmanSocket, SocketIOEvents.ERROR);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: firstQuestionId
        });

        const error = await errorPromise;
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.message).toContain("already played");
      }));

    it("should reject question selection from spectator", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
        const { showmanSocket, spectatorSockets } = setup;

        // Start game
        await utils.startGame(showmanSocket);

        // Verify we're in choosing state
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);

        // Spectator attempts to select question - should be rejected
        const errorPromise = scenario.waitForEvent(spectatorSockets[0], SocketIOEvents.ERROR);
        const questionId = await utils.getFirstAvailableQuestionId(setup.gameId);
        scenario.actor(spectatorSockets[0]).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: questionId
        });

        const error = await errorPromise;
        expect(error.message).toBeDefined();
        expect(error.message).toContain("cannot pick question");
      }));

    it("should handle question selection during wrong game state", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and advance to ANSWERING state
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify we're in ANSWERING state
        const answeringState = await utils.getGameState(setup.gameId);
        expect(answeringState).toBeDefined();
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBeDefined();

        // Attempt to select another question while in wrong state
        const errorPromise = scenario.waitForEvent(showmanSocket, SocketIOEvents.ERROR);
        const anotherQuestionId = await utils.getFirstAvailableQuestionId(setup.gameId);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: anotherQuestionId
        });

        const error = await errorPromise;
        expect(error.message).toBeDefined();
        expect(error.message).toContain("already picked");
      }));
  });

  describe("Turn Player Rotation", () => {
    it("should send nextTurnPlayerId in QUESTION_FINISH and rotate turn after correct answer", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Get initial turn player
        let gameState = await utils.getGameState(gameId);
        expect(gameState?.currentTurnPlayerId).toBeDefined();
        const initialTurnPlayer = gameState!.currentTurnPlayerId;

        // Pick a player who is NOT the current turn player
        const nextPlayerSocket = playerSockets.find(
          (_s, i) => setup.playerUsers[i].id !== initialTurnPlayer
        );
        const nextPlayerId = setup.playerUsers[playerSockets.indexOf(nextPlayerSocket!)].id;

        // That player answers
        await utils.answerQuestion(nextPlayerSocket!, showmanSocket);

        // Set up listener for QUESTION_FINISH event BEFORE emitting answer result
        // QUESTION_FINISH contains the nextTurnPlayerId after a correct answer
        const questionFinishPromise = scenario.waitForEvent<{
          nextTurnPlayerId: number;
        }>(nextPlayerSocket!, SocketIOGameEvents.QUESTION_FINISH);

        // Submit correct answer result
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for QUESTION_FINISH with nextTurnPlayerId
        const questionFinishData = await questionFinishPromise;
        expect(questionFinishData.nextTurnPlayerId).toBeDefined();
        expect(questionFinishData.nextTurnPlayerId).toBe(nextPlayerId);

        // Skip show answer phase for faster test
        await utils.skipShowAnswer(showmanSocket);

        // Also check game state updated
        gameState = await utils.getGameState(gameId);
        expect(gameState!.currentTurnPlayerId).toBe(nextPlayerId);
      }));

    it("should set a random initial currentTurnPlayerId on game start", () =>
      suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);

        const { showmanSocket, gameId } = setup;
        await utils.startGame(showmanSocket);

        const gameState = await utils.getGameState(gameId);
        expect(gameState?.currentTurnPlayerId).toBeDefined();

        const playerIds = setup.playerUsers.map((u) => u.id);
        expect(playerIds).toContain(gameState!.currentTurnPlayerId);
      }));

    it("should rotate currentTurnPlayerId to the player who answers correctly (if not already their turn)", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Get initial turn player
        let gameState = await utils.getGameState(gameId);
        expect(gameState?.currentTurnPlayerId).toBeDefined();

        const initialTurnPlayer = gameState!.currentTurnPlayerId;
        // Pick a player who is NOT the current turn player
        const nextPlayerSocket = playerSockets.find(
          (_s, i) => setup.playerUsers[i].id !== initialTurnPlayer
        );
        const nextPlayerId = setup.playerUsers[playerSockets.indexOf(nextPlayerSocket!)].id;

        // That player answers
        await utils.answerQuestion(nextPlayerSocket!, showmanSocket);

        // Wait for ANSWER_RESULT event (correct answer)
        const answerResultPromise = scenario.waitForEvent(
          nextPlayerSocket!,
          SocketIOGameEvents.ANSWER_RESULT
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT
        });
        await answerResultPromise;

        gameState = await utils.getGameState(gameId);
        expect(gameState!.currentTurnPlayerId).toBe(nextPlayerId);
      }));

    it("should NOT rotate currentTurnPlayerId if the current turn player answers correctly", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets, gameId } = setup;
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        let gameState = await utils.getGameState(gameId);
        expect(gameState?.currentTurnPlayerId).toBeDefined();

        const initialTurnPlayer = gameState!.currentTurnPlayerId;
        const currentPlayerSocket = playerSockets.find(
          (_s, i) => setup.playerUsers[i].id === initialTurnPlayer
        );

        // That player answers
        await utils.answerQuestion(currentPlayerSocket!, showmanSocket);

        // Wait for ANSWER_RESULT event (correct answer)
        const answerResultPromise = scenario.waitForEvent(
          currentPlayerSocket!,
          SocketIOGameEvents.ANSWER_RESULT
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT
        });
        await answerResultPromise;

        gameState = await utils.getGameState(gameId);
        expect(gameState!.currentTurnPlayerId).toBe(initialTurnPlayer);
      }));
  });

  describe("Player Skip Mechanism", () => {
    it("should allow player to skip question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const questionSkipPromise = scenario.waitForEvent<QuestionSkipBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );

        // Player skips question
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_SKIP, {});

        expect((await questionSkipPromise).playerId).toBe(setup.playerUsers[0].id);
      }));

    it("should allow player to unskip question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // First skip the question
        const questionSkipPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        await questionSkipPromise;

        // Then unskip it
        const questionUnskipPromise = scenario.waitForEvent<QuestionUnskipBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_UNSKIP
        );

        // Player unskips question
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_UNSKIP, {});

        expect((await questionUnskipPromise).playerId).toBe(setup.playerUsers[0].id);
      }));

    it("should prevent non-players from skipping", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
        const { showmanSocket, playerSockets, spectatorSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          spectatorSockets[0],
          SocketIOEvents.ERROR
        );

        // Spectator tries to skip question - should fail
        scenario.actor(spectatorSockets[0]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        const error = await errorPromise;

        expect(error.message).toBeDefined();
        expect(error.message.toLowerCase()).toContain("only players can skip");
      }));

    it("should prevent player from skipping while answering", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player begins answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // Player tries to skip while answering - should fail
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        const error = await errorPromise;

        expect(error.message).toBeDefined();
        expect(error.message.toLowerCase()).toContain("cannot skip while answering");
      }));

    it("should prevent player from skipping if already answered", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // First player answers
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Showman gives result
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -100,
          answerType: AnswerResultType.WRONG
        });
        await answerResultPromise;

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // Player tries to skip after he answered - should fail
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        const error = await errorPromise;

        expect(error.message).toBeDefined();
        expect(error.message.toLowerCase()).toContain("already answered");
      }));

    it("should prevent unskipping when player hasn't skipped", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // Player tries to unskip without skipping first - should fail
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_UNSKIP, {});
        const error = await errorPromise;

        expect(error.message).toBeDefined();
        expect(error.message).toContain("has not skipped");
      }));

    it("should automatically skip question when all players have skipped", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const showmanActor = scenario.actor(showmanSocket);
        const afterSkips = scenario.mark();

        // Listen for automatic question finish when all players skip
        const questionFinishPromise = scenario.assert.inbound<[QuestionFinishEventPayload]>({
          actor: showmanActor,
          event: SocketIOGameEvents.QUESTION_FINISH,
          afterSequence: afterSkips,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          description: "question finish after every player skipped"
        });
        const skipActionsAccepted = utils.waitForSubmittedActions(
          setup.gameId,
          playerSockets.length,
          GameActionType.QUESTION_SKIP
        );

        // All players skip the question sequentially
        for (let i = 0; i < playerSockets.length; i++) {
          const expectedPlayerId = setup.playerUsers[i].id;
          const questionSkipPromise = scenario.assert.inbound<[QuestionSkipBroadcastData]>({
            actor: showmanActor,
            event: SocketIOGameEvents.QUESTION_SKIP,
            afterSequence: afterSkips,
            timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
            predicate: ({ args }) => args[0]?.playerId === expectedPlayerId,
            description: `skip broadcast for player ${expectedPlayerId}`
          });
          scenario.actor(playerSockets[i]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
          expect((await questionSkipPromise).args[0].playerId).toBe(expectedPlayerId);
        }

        await skipActionsAccepted;
        const questionFinish = (await questionFinishPromise).args[0];
        await utils.waitForActionsComplete(setup.gameId);

        expect(questionFinish.answerFiles).toBeDefined();
        expect(questionFinish.answerText).toBeDefined();
        const skipEvents = scenario.assert
          .records({ actor: showmanActor, direction: "inbound" })
          .filter(
            (record) =>
              record.sequence > afterSkips &&
              record.direction === "inbound" &&
              record.event === SocketIOGameEvents.QUESTION_SKIP
          );
        expect(skipEvents).toHaveLength(playerSockets.length);
        expect(
          skipEvents.map((record) => (record.args[0] as QuestionSkipBroadcastData).playerId)
        ).toEqual(setup.playerUsers.map((player) => player.id));
      }));

    it("should update game state with skipped players", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // First player skips
        const firstSkipPromise = scenario.waitForEvent<QuestionSkipBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        expect((await firstSkipPromise).playerId).toBe(setup.playerUsers[0].id);

        // Check game state has been updated
        let gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.skippedPlayers).toBeDefined();
        expect(gameState!.skippedPlayers).not.toBeNull();
        expect(gameState!.skippedPlayers).toContain(setup.playerUsers[0].id);
        expect(gameState!.skippedPlayers).toHaveLength(1);

        // Second player skips
        const secondSkipPromise = scenario.waitForEvent<QuestionSkipBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        expect((await secondSkipPromise).playerId).toBe(setup.playerUsers[1].id);

        // Check game state has both players (but not all players, so no auto-skip)
        gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.skippedPlayers).toBeDefined();
        expect(gameState!.skippedPlayers).not.toBeNull();
        expect(gameState!.skippedPlayers).toContain(setup.playerUsers[0].id);
        expect(gameState!.skippedPlayers).toContain(setup.playerUsers[1].id);
        expect(gameState!.skippedPlayers).toHaveLength(2);
      }));

    it("should remove player from skipped list when unskipping", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Two players skip (not all players, so no automatic skip)
        const firstSkipPromise = scenario.waitForEvent<QuestionSkipBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        expect((await firstSkipPromise).playerId).toBe(setup.playerUsers[0].id);

        const secondSkipPromise = scenario.waitForEvent<QuestionSkipBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        expect((await secondSkipPromise).playerId).toBe(setup.playerUsers[1].id);

        // First player unskips
        const unskipPromise = scenario.waitForEvent<QuestionUnskipBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_UNSKIP
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_UNSKIP, {});
        expect((await unskipPromise).playerId).toBe(setup.playerUsers[0].id);

        // Check game state - only second player should be in skipped list
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.skippedPlayers).toBeDefined();
        expect(gameState!.skippedPlayers).not.toBeNull();
        expect(gameState!.skippedPlayers).not.toContain(setup.playerUsers[0].id);
        expect(gameState!.skippedPlayers).toContain(setup.playerUsers[1].id);
        expect(gameState!.skippedPlayers).toHaveLength(1);
      }));

    it("should reset skipped players when question finishes", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        expect((await utils.getGameState(setup.gameId))?.questionState).toBe(QuestionState.SHOWING);

        // Player skips
        const skipPromise = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.QUESTION_SKIP);
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        await skipPromise;

        // Verify player is in skipped list
        let gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.skippedPlayers).toBeDefined();
        expect(gameState!.skippedPlayers).toContain(setup.playerUsers[0].id);

        // Showman force skips question
        const forceSkipPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_FINISH
        );
        const showAnswerStartPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});
        await forceSkipPromise;
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Check that skipped players list is cleared
        gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.skippedPlayers).toBeNull();
      }));
  });
});
