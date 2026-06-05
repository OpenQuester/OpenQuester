import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { FINAL_ROUND_ANSWER_MAX_LENGTH } from "domain/constants/game";
import { GameActionType } from "domain/enums/GameActionType";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import {
  FinalAnswerLossReason,
  FinalAnswerType,
} from "domain/enums/FinalRoundTypes";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  FinalAnswerReviewInputData,
  FinalAnswerReviewOutputData,
} from "domain/types/socket/events/FinalAnswerReviewData";
import {
  FinalAnswerSubmitOutputData,
  FinalSubmitEndEventData,
  SocketIOFinalAutoLossEventPayload,
} from "domain/types/socket/events/FinalRoundEventData";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "shared/logging/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { TestUtils } from "tests/utils/TestUtils";

describe("Final Round Answering Logic", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: TestUtils;
  let logger: ILogger;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
    utils = new TestUtils(app, userRepo, serverUrl);
  });

  afterAll(async () => {
    if (cleanup) {
      await cleanup();
    }
    await testEnv.teardown();
  });

  describe("Answer Submission Flow", () => {
    it("should allow players to submit answers and transition to reviewing phase", async () => {
      // Setup game with 2 players
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200], // Both players have scores > 1
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      const questionDataPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_QUESTION_DATA
      );

      // Complete theme elimination and bidding to reach answering phase
      const phaseTransitionPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      await phaseTransitionPromise;

      // Submit bids to transition to answering phase
      const firstBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });

      await firstBidPromise;

      playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });

      // Wait for transition to answering phase
      await questionDataPromise;

      // Verify game is in answering phase
      let gameState = await utils.getGameState(gameId);
      expect(gameState.questionState).toBe(QuestionState.ANSWERING);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

      // Listen for answer submission events
      const answerSubmitEvents: FinalAnswerSubmitOutputData[] = [];
      showmanSocket.on(
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        (data: FinalAnswerSubmitOutputData) => {
          answerSubmitEvents.push(data);
        }
      );

      // Listen for phase completion event
      let submitEndEvent: FinalSubmitEndEventData | null = null;
      showmanSocket.on(
        SocketIOGameEvents.FINAL_SUBMIT_END,
        (data: FinalSubmitEndEventData) => {
          submitEndEvent = data;
        }
      );

      const finalAnswerSubmitPromise = utils.waitForEvent(
        playerSockets[1],
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      // Submit answers from both players
      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Player 1 answer",
      });

      await finalAnswerSubmitPromise;

      const finalAnswerSubmitPromise2 = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Player 2 answer",
      });

      // Wait for events to be processed
      await finalAnswerSubmitPromise2;

      // Verify answer submission events were received
      expect(answerSubmitEvents).toHaveLength(2);
      expect(answerSubmitEvents[0].playerId).toBeDefined();
      expect(answerSubmitEvents[1].playerId).toBeDefined();

      // Verify phase completion event was received
      expect(submitEndEvent).not.toBeNull();
      expect(submitEndEvent!.phase).toBe(FinalRoundPhase.ANSWERING);
      expect(submitEndEvent!.nextPhase).toBe(FinalRoundPhase.REVIEWING);
      expect(submitEndEvent!.allReviews).toHaveLength(2);

      // Verify answers are revealed in the completion event
      expect(submitEndEvent!.allReviews![0].answerText).toBeDefined();
      expect(submitEndEvent!.allReviews![1].answerText).toBeDefined();

      // Verify valid answers have isCorrect: null (need showman review)
      // and answerType: 'pending'
      for (const review of submitEndEvent!.allReviews!) {
        expect(review.isCorrect).toBeNull();
        expect(review.answerType).toBe(FinalAnswerType.PENDING);
      }

      // Verify game state transitioned to reviewing
      gameState = await utils.getGameState(gameId);
      expect(gameState.questionState).toBe(QuestionState.REVIEWING);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

      // Clean up
      await utils.cleanupGameClients(setupResult);
    });

    it("should hide final answer text until submit end reveals all reviews", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setupResult;
      const spectatorSocket = spectatorSockets[0];

      try {
        const biddingPhasePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await biddingPhasePromise;

        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await firstBidPromise;

        const questionDataPromises = [
          utils.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_QUESTION_DATA),
          utils.waitForEvent(playerSockets[0], SocketIOGameEvents.FINAL_QUESTION_DATA),
          utils.waitForEvent(spectatorSocket, SocketIOGameEvents.FINAL_QUESTION_DATA),
        ];
        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        await Promise.all(questionDataPromises);

        const answeringState = await utils.getGameState(gameId);
        expect(answeringState.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

        const firstSubmitPromises = [
          utils.waitForEvent<FinalAnswerSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT
          ),
          utils.waitForEvent<FinalAnswerSubmitOutputData>(
            playerSockets[1],
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT
          ),
          utils.waitForEvent<FinalAnswerSubmitOutputData>(
            spectatorSocket,
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT
          ),
        ];

        playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Private first answer",
        });

        const firstSubmitBroadcasts = await Promise.all(firstSubmitPromises);
        for (const broadcast of firstSubmitBroadcasts) {
          expect(broadcast).toEqual({ playerId: playerUsers[0].id });
          expect(broadcast).not.toHaveProperty("answerText");
        }

        const stateAfterFirstAnswer = await utils.getGameState(gameId);
        expect(stateAfterFirstAnswer.finalRoundData?.answers).toHaveLength(1);
        expect(stateAfterFirstAnswer.finalRoundData?.answers[0].answer).toBe(
          "Private first answer"
        );
        expect(stateAfterFirstAnswer.finalRoundData?.phase).toBe(
          FinalRoundPhase.ANSWERING
        );

        const secondSubmitPromise = utils.waitForEvent<FinalAnswerSubmitOutputData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        const submitEndPromises = [
          utils.waitForEvent<FinalSubmitEndEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_SUBMIT_END
          ),
          utils.waitForEvent<FinalSubmitEndEventData>(
            playerSockets[0],
            SocketIOGameEvents.FINAL_SUBMIT_END
          ),
          utils.waitForEvent<FinalSubmitEndEventData>(
            spectatorSocket,
            SocketIOGameEvents.FINAL_SUBMIT_END
          ),
        ];

        playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Private second answer",
        });

        const secondSubmitBroadcast = await secondSubmitPromise;
        expect(secondSubmitBroadcast).toEqual({ playerId: playerUsers[1].id });
        expect(secondSubmitBroadcast).not.toHaveProperty("answerText");

        const submitEndBroadcasts = await Promise.all(submitEndPromises);
        for (const submitEnd of submitEndBroadcasts) {
          expect(submitEnd.phase).toBe(FinalRoundPhase.ANSWERING);
          expect(submitEnd.nextPhase).toBe(FinalRoundPhase.REVIEWING);
          expect(submitEnd.allReviews).toHaveLength(2);
          expect(submitEnd.allReviews?.map((review) => review.answerText)).toEqual(
            expect.arrayContaining([
              "Private first answer",
              "Private second answer",
            ])
          );
        }
      } finally {
        await utils.cleanupGameClients(setupResult);
      }
    });

    it("should broadcast timeout auto-losses and reveal all reviews after final answer timer expires", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000],
      });

      const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setupResult;
      const spectatorSocket = spectatorSockets[0];

      const showmanTimeoutAnswers: FinalAnswerSubmitOutputData[] = [];
      const playerTimeoutAnswers: FinalAnswerSubmitOutputData[] = [];
      const spectatorTimeoutAnswers: FinalAnswerSubmitOutputData[] = [];
      const showmanAutoLosses: SocketIOFinalAutoLossEventPayload[] = [];
      const playerAutoLosses: SocketIOFinalAutoLossEventPayload[] = [];
      const spectatorAutoLosses: SocketIOFinalAutoLossEventPayload[] = [];

      try {
        const biddingPhasePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await biddingPhasePromise;

        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await firstBidPromise;

        const secondBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        await secondBidPromise;

        const questionDataPromises = [
          utils.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_QUESTION_DATA),
          utils.waitForEvent(playerSockets[0], SocketIOGameEvents.FINAL_QUESTION_DATA),
          utils.waitForEvent(spectatorSocket, SocketIOGameEvents.FINAL_QUESTION_DATA),
        ];
        playerSockets[2].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 400 });
        await Promise.all(questionDataPromises);

        const answeringState = await utils.getGameState(gameId);
        expect(answeringState.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

        const firstSubmitPromises = [
          utils.waitForEvent<FinalAnswerSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT
          ),
          utils.waitForEvent<FinalAnswerSubmitOutputData>(
            playerSockets[0],
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT
          ),
          utils.waitForEvent<FinalAnswerSubmitOutputData>(
            spectatorSocket,
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT
          ),
        ];
        playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Answered before timeout",
        });
        const firstSubmitBroadcasts = await Promise.all(firstSubmitPromises);
        for (const firstSubmit of firstSubmitBroadcasts) {
          expect(firstSubmit).toEqual({ playerId: playerUsers[0].id });
          expect(firstSubmit).not.toHaveProperty("answerText");
        }

        const recordAnswer =
          (events: FinalAnswerSubmitOutputData[]) =>
          (data: FinalAnswerSubmitOutputData): void => {
            events.push(data);
          };
        const recordAutoLoss =
          (events: SocketIOFinalAutoLossEventPayload[]) =>
          (data: SocketIOFinalAutoLossEventPayload): void => {
            events.push(data);
          };

        showmanSocket.on(
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
          recordAnswer(showmanTimeoutAnswers)
        );
        playerSockets[0].on(
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
          recordAnswer(playerTimeoutAnswers)
        );
        spectatorSocket.on(
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
          recordAnswer(spectatorTimeoutAnswers)
        );
        showmanSocket.on(
          SocketIOGameEvents.FINAL_AUTO_LOSS,
          recordAutoLoss(showmanAutoLosses)
        );
        playerSockets[0].on(
          SocketIOGameEvents.FINAL_AUTO_LOSS,
          recordAutoLoss(playerAutoLosses)
        );
        spectatorSocket.on(
          SocketIOGameEvents.FINAL_AUTO_LOSS,
          recordAutoLoss(spectatorAutoLosses)
        );

        const submitEndPromises = [
          utils.waitForEvent<FinalSubmitEndEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_SUBMIT_END
          ),
          utils.waitForEvent<FinalSubmitEndEventData>(
            playerSockets[0],
            SocketIOGameEvents.FINAL_SUBMIT_END
          ),
          utils.waitForEvent<FinalSubmitEndEventData>(
            spectatorSocket,
            SocketIOGameEvents.FINAL_SUBMIT_END
          ),
        ];

        await utils.expireTimerAndWaitForAction(
          gameId,
          GameActionType.TIMER_FINAL_ANSWERING_EXPIRED
        );

        const submitEndBroadcasts = await Promise.all(submitEndPromises);
        const expectedTimeoutAnswers = [
          { playerId: playerUsers[1].id },
          { playerId: playerUsers[2].id },
        ];
        const expectedAutoLosses = [
          { playerId: playerUsers[1].id, reason: FinalAnswerLossReason.TIMEOUT },
          { playerId: playerUsers[2].id, reason: FinalAnswerLossReason.TIMEOUT },
        ];

        expect(showmanTimeoutAnswers).toEqual(expectedTimeoutAnswers);
        expect(playerTimeoutAnswers).toEqual(expectedTimeoutAnswers);
        expect(spectatorTimeoutAnswers).toEqual(expectedTimeoutAnswers);
        expect(showmanAutoLosses).toEqual(expectedAutoLosses);
        expect(playerAutoLosses).toEqual(expectedAutoLosses);
        expect(spectatorAutoLosses).toEqual(expectedAutoLosses);

        for (const timeoutAnswer of [
          ...showmanTimeoutAnswers,
          ...playerTimeoutAnswers,
          ...spectatorTimeoutAnswers,
        ]) {
          expect(timeoutAnswer).not.toHaveProperty("answerText");
        }

        for (const submitEnd of submitEndBroadcasts) {
          expect(submitEnd.phase).toBe(FinalRoundPhase.ANSWERING);
          expect(submitEnd.nextPhase).toBe(FinalRoundPhase.REVIEWING);
          expect(submitEnd.allReviews).toHaveLength(3);
          expect(submitEnd.allReviews?.map((review) => review.answerText)).toEqual(
            expect.arrayContaining(["Answered before timeout", "", ""])
          );

          const timeoutReviews = submitEnd.allReviews?.filter(
            (review) =>
              review.playerId === playerUsers[1].id ||
              review.playerId === playerUsers[2].id
          );
          expect(timeoutReviews).toHaveLength(2);
          for (const review of timeoutReviews ?? []) {
            expect(review.isCorrect).toBe(false);
            expect(review.answerType).toBe(FinalAnswerType.AUTO_LOSS);
          }
        }

        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.REVIEWING);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);
      } finally {
        await utils.cleanupGameClients(setupResult);
      }
    });

    it("should finish the game when all final answers time out as auto-loss", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setupResult;
      const spectatorSocket = spectatorSockets[0];
      const showmanTimeoutAnswers: FinalAnswerSubmitOutputData[] = [];
      const playerTimeoutAnswers: FinalAnswerSubmitOutputData[] = [];
      const spectatorTimeoutAnswers: FinalAnswerSubmitOutputData[] = [];
      const showmanAutoLosses: SocketIOFinalAutoLossEventPayload[] = [];
      const playerAutoLosses: SocketIOFinalAutoLossEventPayload[] = [];
      const spectatorAutoLosses: SocketIOFinalAutoLossEventPayload[] = [];

      try {
        const biddingPhasePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await biddingPhasePromise;

        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await firstBidPromise;

        const questionDataPromises = [
          utils.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_QUESTION_DATA),
          utils.waitForEvent(playerSockets[0], SocketIOGameEvents.FINAL_QUESTION_DATA),
          utils.waitForEvent(spectatorSocket, SocketIOGameEvents.FINAL_QUESTION_DATA),
        ];
        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        await Promise.all(questionDataPromises);

        const recordAnswer =
          (events: FinalAnswerSubmitOutputData[]) =>
          (data: FinalAnswerSubmitOutputData): void => {
            events.push(data);
          };
        const recordAutoLoss =
          (events: SocketIOFinalAutoLossEventPayload[]) =>
          (data: SocketIOFinalAutoLossEventPayload): void => {
            events.push(data);
          };

        showmanSocket.on(
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
          recordAnswer(showmanTimeoutAnswers)
        );
        playerSockets[0].on(
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
          recordAnswer(playerTimeoutAnswers)
        );
        spectatorSocket.on(
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
          recordAnswer(spectatorTimeoutAnswers)
        );
        showmanSocket.on(
          SocketIOGameEvents.FINAL_AUTO_LOSS,
          recordAutoLoss(showmanAutoLosses)
        );
        playerSockets[0].on(
          SocketIOGameEvents.FINAL_AUTO_LOSS,
          recordAutoLoss(playerAutoLosses)
        );
        spectatorSocket.on(
          SocketIOGameEvents.FINAL_AUTO_LOSS,
          recordAutoLoss(spectatorAutoLosses)
        );

        const submitEndPromises = [
          utils.waitForEvent<FinalSubmitEndEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_SUBMIT_END
          ),
          utils.waitForEvent<FinalSubmitEndEventData>(
            playerSockets[0],
            SocketIOGameEvents.FINAL_SUBMIT_END
          ),
          utils.waitForEvent<FinalSubmitEndEventData>(
            spectatorSocket,
            SocketIOGameEvents.FINAL_SUBMIT_END
          ),
        ];
        const gameFinishedPromises = [
          utils.waitForEvent<boolean>(showmanSocket, SocketIOGameEvents.GAME_FINISHED),
          utils.waitForEvent<boolean>(playerSockets[0], SocketIOGameEvents.GAME_FINISHED),
          utils.waitForEvent<boolean>(spectatorSocket, SocketIOGameEvents.GAME_FINISHED),
        ];

        await utils.expireTimerAndWaitForAction(
          gameId,
          GameActionType.TIMER_FINAL_ANSWERING_EXPIRED
        );

        const submitEndBroadcasts = await Promise.all(submitEndPromises);
        const gameFinishedBroadcasts = await Promise.all(gameFinishedPromises);
        const expectedTimeoutAnswers = [
          { playerId: playerUsers[0].id },
          { playerId: playerUsers[1].id },
        ];
        const expectedAutoLosses = [
          { playerId: playerUsers[0].id, reason: FinalAnswerLossReason.TIMEOUT },
          { playerId: playerUsers[1].id, reason: FinalAnswerLossReason.TIMEOUT },
        ];

        expect(showmanTimeoutAnswers).toEqual(expectedTimeoutAnswers);
        expect(playerTimeoutAnswers).toEqual(expectedTimeoutAnswers);
        expect(spectatorTimeoutAnswers).toEqual(expectedTimeoutAnswers);
        expect(showmanAutoLosses).toEqual(expectedAutoLosses);
        expect(playerAutoLosses).toEqual(expectedAutoLosses);
        expect(spectatorAutoLosses).toEqual(expectedAutoLosses);
        expect(gameFinishedBroadcasts).toEqual([true, true, true]);

        for (const submitEnd of submitEndBroadcasts) {
          expect(submitEnd.phase).toBe(FinalRoundPhase.ANSWERING);
          expect(submitEnd.nextPhase).toBe(FinalRoundPhase.REVIEWING);
          expect(submitEnd.allReviews).toHaveLength(2);
          expect(submitEnd.allReviews?.every((review) => review.answerText === "")).toBe(true);
          expect(submitEnd.allReviews?.every((review) => review.isCorrect === false)).toBe(true);
          expect(
            submitEnd.allReviews?.every(
              (review) => review.answerType === FinalAnswerType.AUTO_LOSS
            )
          ).toBe(true);
        }

        const game = await utils.getGameEntity(gameId);
        expect(game.finishedAt).toBeDefined();
        expect(game.gameState.timer).toBeNull();
      } finally {
        await utils.cleanupGameClients(setupResult);
      }
    });

    it("should handle empty answers as auto-loss", async () => {
      // Setup game with 2 players
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      // Complete theme elimination and bidding to reach answering phase
      const phaseTransitionPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      await phaseTransitionPromise;

      // Submit bids to transition to answering phase
      const finalBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );

      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
      await finalBidPromise;

      const finalBidPromise2 = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });

      // Wait for transition to answering phase
      await finalBidPromise2;

      // Verify game is in answering phase
      const gameState = await utils.getGameState(gameId);
      expect(gameState.questionState).toBe(QuestionState.ANSWERING);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

      // Listen for auto-loss events
      const autoLossEvents: SocketIOFinalAutoLossEventPayload[] = [];
      showmanSocket.on(
        SocketIOGameEvents.FINAL_AUTO_LOSS,
        (data: SocketIOFinalAutoLossEventPayload) => {
          autoLossEvents.push(data);
        }
      );

      // Listen for phase completion event
      let submitEndEvent: FinalSubmitEndEventData | null = null;
      showmanSocket.on(
        SocketIOGameEvents.FINAL_SUBMIT_END,
        (data: FinalSubmitEndEventData) => {
          submitEndEvent = data;
        }
      );

      const finalAnswerSubmitPromise = utils.waitForEvent(
        playerSockets[1],
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );

      // Submit empty answer from first player
      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "",
      });
      await finalAnswerSubmitPromise;

      const finalAnswerSubmitPromise2 = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      // Submit regular answer from second player
      playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Player 2 answer",
      });

      // Wait for events to be processed
      await finalAnswerSubmitPromise2;

      // Verify auto-loss event was received
      expect(autoLossEvents).toHaveLength(1);
      expect(autoLossEvents[0].playerId).toBeDefined();

      // Verify phase completion event was received
      expect(submitEndEvent).not.toBeNull();
      expect(submitEndEvent!.allReviews).toHaveLength(2);

      // Verify the empty answer is marked as auto-loss with isCorrect: false
      const autoLossReview = submitEndEvent!.allReviews!.find(
        (review) => review.answerText === ""
      );
      expect(autoLossReview).toBeDefined();
      expect(autoLossReview!.isCorrect).toBe(false);
      expect(autoLossReview!.answerType).toBe(FinalAnswerType.AUTO_LOSS);

      // Verify the valid answer has isCorrect: null (needs showman review)
      const validReview = submitEndEvent!.allReviews!.find(
        (review) => review.answerText === "Player 2 answer"
      );
      expect(validReview).toBeDefined();
      expect(validReview!.isCorrect).toBeNull();
      expect(validReview!.answerType).toBe(FinalAnswerType.PENDING);

      // Clean up
      await utils.cleanupGameClients(setupResult);
    });

    it("should handle single player answering", async () => {
      // Setup game with 1 player
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 1,
        playerScores: [1500],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      // Complete theme elimination and bidding to reach answering phase
      const phaseTransitionPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      await phaseTransitionPromise;

      const phaseCompletePromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      // Submit bid to transition to answering phase
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });

      // Wait for transition to answering phase
      await phaseCompletePromise;

      // Verify game is in answering phase
      let gameState = await utils.getGameState(gameId);
      expect(gameState.questionState).toBe(QuestionState.ANSWERING);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

      // Listen for phase completion event
      let submitEndEvent: FinalSubmitEndEventData | null = null;
      showmanSocket.on(
        SocketIOGameEvents.FINAL_SUBMIT_END,
        (data: FinalSubmitEndEventData) => {
          submitEndEvent = data;
        }
      );

      const finalAnswerSubmitPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      // Submit answer
      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Single player answer",
      });

      // Wait for events to be processed
      await finalAnswerSubmitPromise;

      // Verify phase completion event was received
      expect(submitEndEvent).not.toBeNull();
      expect(submitEndEvent!.allReviews).toHaveLength(1);
      expect(submitEndEvent!.allReviews![0].answerText).toBe(
        "Single player answer"
      );

      // Verify game state transitioned to reviewing
      gameState = await utils.getGameState(gameId);
      expect(gameState.questionState).toBe(QuestionState.REVIEWING);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

      // Clean up
      await utils.cleanupGameClients(setupResult);
    });

    it("should reject spectator final-round actions", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      try {
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } =
          setupResult;
        const spectatorSocket = spectatorSockets[0];
        const initialGameState = await utils.getGameState(gameId);
        const themeToEliminate = initialGameState.currentRound?.themes?.[0];

        if (themeToEliminate?.id === undefined) {
          throw new Error("Expected final round theme to be available");
        }

        const spectatorEliminationErrorPromise = utils.waitForEvent<Record<string, unknown>>(
          spectatorSocket,
          SocketIOEvents.ERROR
        );
        spectatorSocket.emit(SocketIOGameEvents.THEME_ELIMINATE, {
          themeId: themeToEliminate.id,
        });
        await spectatorEliminationErrorPromise;

        const stateAfterSpectatorElimination = await utils.getGameState(gameId);
        expect(stateAfterSpectatorElimination.finalRoundData?.eliminatedThemes).toHaveLength(0);

        const biddingPhasePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await biddingPhasePromise;

        const spectatorBidErrorPromise = utils.waitForEvent<Record<string, unknown>>(
          spectatorSocket,
          SocketIOEvents.ERROR
        );
        spectatorSocket.emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 100 });
        await spectatorBidErrorPromise;

        const stateAfterSpectatorBid = await utils.getGameState(gameId);
        expect(stateAfterSpectatorBid.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);
        expect(Object.keys(stateAfterSpectatorBid.finalRoundData?.bids ?? {})).toHaveLength(0);

        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await firstBidPromise;

        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        await questionDataPromise;

        const spectatorAnswerErrorPromise = utils.waitForEvent<Record<string, unknown>>(
          spectatorSocket,
          SocketIOEvents.ERROR
        );
        spectatorSocket.emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Spectator answer",
        });
        await spectatorAnswerErrorPromise;

        const stateAfterSpectatorAnswer = await utils.getGameState(gameId);
        expect(stateAfterSpectatorAnswer.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(stateAfterSpectatorAnswer.finalRoundData?.answers).toHaveLength(0);
      } finally {
        await utils.cleanupGameClients(setupResult);
      }
    });

    it("should accept max-length final answer and reject longer answers", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      try {
        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;
        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const phaseTransitionPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await firstBidPromise;

        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        await questionDataPromise;

        const maxLengthAnswer = "a".repeat(FINAL_ROUND_ANSWER_MAX_LENGTH);
        const maxLengthAnswerPromise = utils.waitForEvent<FinalAnswerSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: maxLengthAnswer,
        });
        await maxLengthAnswerPromise;

        const tooLongAnswer = maxLengthAnswer + "a";
        const tooLongErrorPromise = utils.waitForEvent<Record<string, unknown>>(
          playerSockets[1],
          SocketIOEvents.ERROR
        );
        playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: tooLongAnswer,
        });

        await tooLongErrorPromise;

        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(gameState.finalRoundData?.answers).toHaveLength(1);
        expect(gameState.finalRoundData?.answers[0].playerId).toBe(playerUsers[0].id);
        expect(gameState.finalRoundData?.answers[0].answer).toBe(maxLengthAnswer);
        expect(
          gameState.finalRoundData?.answers.some(
            (answer) => answer.playerId === playerUsers[1].id
          )
        ).toBe(false);
      } finally {
        await utils.cleanupGameClients(setupResult);
      }
    });

    it("should handle multiple players with mixed answer types", async () => {
      // Setup game with 3 players
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      // Complete theme elimination and bidding to reach answering phase
      const phaseTransitionPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      await phaseTransitionPromise;

      const phaseCompletePromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );

      const bidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      // Submit bids to transition to answering phase
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
      await bidPromise;

      const bidPromise2 = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
      await bidPromise2;

      playerSockets[2].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 400 });
      await phaseCompletePromise;

      // Verify game is in answering phase
      let gameState = await utils.getGameState(gameId);
      expect(gameState.questionState).toBe(QuestionState.ANSWERING);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

      // Listen for answer submission events
      const answerSubmitEvents: FinalAnswerSubmitOutputData[] = [];
      showmanSocket.on(
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        (data: FinalAnswerSubmitOutputData) => {
          answerSubmitEvents.push(data);
        }
      );

      // Listen for auto-loss events
      const autoLossEvents: SocketIOFinalAutoLossEventPayload[] = [];
      showmanSocket.on(
        SocketIOGameEvents.FINAL_AUTO_LOSS,
        (data: SocketIOFinalAutoLossEventPayload) => {
          autoLossEvents.push(data);
        }
      );

      // Listen for phase completion event
      let submitEndEvent: FinalSubmitEndEventData | null = null;
      showmanSocket.on(
        SocketIOGameEvents.FINAL_SUBMIT_END,
        (data: FinalSubmitEndEventData) => {
          submitEndEvent = data;
        }
      );

      const finalAnswerSubmitPromise = utils.waitForEvent(
        playerSockets[1],
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      // Submit answers: regular, empty, regular
      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Answer from player 1",
      });
      await finalAnswerSubmitPromise;

      const finalAnswerSubmitPromise2 = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "", // Empty answer (auto-loss)
      });
      await finalAnswerSubmitPromise2;

      const finalAnswerSubmitPromise3 = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      playerSockets[2].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Answer from player 3",
      });

      // Wait for events to be processed
      await finalAnswerSubmitPromise3;

      // Verify all answer submission events were received
      expect(answerSubmitEvents).toHaveLength(3);

      // Verify auto-loss event was received
      expect(autoLossEvents).toHaveLength(1);

      // Verify phase completion event was received
      expect(submitEndEvent).not.toBeNull();
      expect(submitEndEvent!.allReviews).toHaveLength(3);

      // Verify answers are properly stored
      const answerTexts = submitEndEvent!.allReviews!.map(
        (review) => review.answerText
      );
      expect(answerTexts).toContain("Answer from player 1");
      expect(answerTexts).toContain(""); // Empty answer
      expect(answerTexts).toContain("Answer from player 3");

      // Verify game state transitioned to reviewing
      gameState = await utils.getGameState(gameId);
      expect(gameState.questionState).toBe(QuestionState.REVIEWING);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

      // Clean up
      await utils.cleanupGameClients(setupResult);
    });
  });

  describe("Review Flow", () => {
    it("should allow showman to review answers in any order and finish game", async () => {
      // Setup game with 2 players and get to reviewing phase
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      // Complete theme elimination and bidding to reach answering phase
      const phaseTransitionPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      await phaseTransitionPromise;

      const phaseCompletePromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );

      const finalBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      // Submit bids to transition to answering phase
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
      await finalBidPromise;

      playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
      await phaseCompletePromise;

      const answerSubmitPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );

      // Submit answers to get to reviewing phase
      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Player 1 answer",
      });
      await answerSubmitPromise;

      const answerSubmitPromise2 = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );

      playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Player 2 answer",
      });
      await answerSubmitPromise2;

      // Verify we're in reviewing phase
      const gameState = await utils.getGameState(gameId);
      expect(gameState.questionState).toBe(QuestionState.REVIEWING);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

      // Set up event listeners for review events
      const reviewEvents: FinalAnswerReviewOutputData[] = [];
      showmanSocket.on(
        SocketIOGameEvents.FINAL_ANSWER_REVIEW,
        (data: FinalAnswerReviewOutputData) => {
          reviewEvents.push(data);
        }
      );

      let questionFinishEvent: QuestionFinishEventPayload | null = null;
      showmanSocket.on(
        SocketIOGameEvents.QUESTION_FINISH,
        (data: QuestionFinishEventPayload) => {
          questionFinishEvent = data;
        }
      );

      let gameFinishedEvent: boolean | null = null;
      showmanSocket.on(SocketIOGameEvents.GAME_FINISHED, (data: boolean) => {
        gameFinishedEvent = data;
      });

      // Get answer IDs from the game state
      const finalRoundData = gameState.finalRoundData!;
      const answerIds = finalRoundData.answers.map((answer) => answer.id);
      expect(answerIds).toHaveLength(2);

      // Review second answer first (testing any order)
      const reviewPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_REVIEW
      );

      showmanSocket.emit(SocketIOGameEvents.FINAL_ANSWER_REVIEW, {
        answerId: answerIds[1],
        isCorrect: false,
      } satisfies FinalAnswerReviewInputData);
      await reviewPromise;

      // Game should not finish yet
      expect(gameFinishedEvent).toBeNull();

      // Review first answer as correct
      const reviewPromise2 = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_REVIEW
      );

      showmanSocket.emit(SocketIOGameEvents.FINAL_ANSWER_REVIEW, {
        answerId: answerIds[0],
        isCorrect: true,
      } satisfies FinalAnswerReviewInputData);
      await reviewPromise2;

      // Verify review events were received
      expect(reviewEvents).toHaveLength(2);
      expect(reviewEvents[0].answerId).toBe(answerIds[1]);
      expect(reviewEvents[0].isCorrect).toBe(false);
      expect(reviewEvents[0].scoreChange).toBe(-600); // Player 2 loses bid amount
      expect(reviewEvents[1].answerId).toBe(answerIds[0]);
      expect(reviewEvents[1].isCorrect).toBe(true);
      expect(reviewEvents[1].scoreChange).toBe(800); // Player 1 gains bid amount

      // Verify game finished events were sent
      expect(questionFinishEvent).not.toBeNull();
      expect(questionFinishEvent!.answerFiles).toBeNull();
      expect(questionFinishEvent!.answerText).toBeDefined();

      expect(gameFinishedEvent).toBe(true);

      // Clean up
      await utils.cleanupGameClients(setupResult);
    });

    it("should handle mixed correct and incorrect reviews", async () => {
      // Setup game with 3 players
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      // Complete theme elimination and bidding to reach answering phase
      const phaseTransitionPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      await phaseTransitionPromise;

      const phaseEndPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      // Submit bids
      const bidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
      await bidPromise;

      const bidPromise2 = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
      await bidPromise2;

      playerSockets[2].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 400 });
      await phaseEndPromise;

      const answerPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      // Submit answers - mix of answers and empty
      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Correct answer",
      });
      await answerPromise;

      const answerPromise2 = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Wrong answer",
      });
      await answerPromise2;

      const answerPromise3 = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT
      );
      playerSockets[2].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "", // Empty answer - should be auto-loss
      });
      await answerPromise3;

      // Verify we're in reviewing phase
      const gameState2 = await utils.getGameState(gameId);
      expect(gameState2.questionState).toBe(QuestionState.REVIEWING);

      // Get answer IDs
      const finalRoundData = gameState2.finalRoundData!;
      const answerIds = finalRoundData.answers.map((answer) => answer.id);
      expect(answerIds).toHaveLength(3);

      // Set up event listeners
      const reviewEvents: FinalAnswerReviewOutputData[] = [];
      showmanSocket.on(
        SocketIOGameEvents.FINAL_ANSWER_REVIEW,
        (data: FinalAnswerReviewOutputData) => {
          reviewEvents.push(data);
        }
      );

      let gameFinishedEvent: boolean | null = null;
      showmanSocket.on(SocketIOGameEvents.GAME_FINISHED, (data: boolean) => {
        gameFinishedEvent = data;
      });

      // Review answers in different order
      // First, review player 2 as incorrect
      const player2AnswerId = answerIds.find((id) => {
        const answer = finalRoundData.answers.find((a) => a.id === id);
        return answer?.playerId === playerUsers[1].id;
      });

      const reviewPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_REVIEW
      );

      showmanSocket.emit(SocketIOGameEvents.FINAL_ANSWER_REVIEW, {
        answerId: player2AnswerId!,
        isCorrect: false,
      } satisfies FinalAnswerReviewInputData);
      await reviewPromise;

      // Then review player 1 as correct
      const player1AnswerId = answerIds.find((id) => {
        const answer = finalRoundData.answers.find((a) => a.id === id);
        return answer?.playerId === playerUsers[0].id;
      });

      const reviewPromise2 = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_REVIEW
      );

      showmanSocket.emit(SocketIOGameEvents.FINAL_ANSWER_REVIEW, {
        answerId: player1AnswerId!,
        isCorrect: true,
      } satisfies FinalAnswerReviewInputData);
      await reviewPromise2;

      // Game should finish now because empty answer is auto-reviewed
      expect(gameFinishedEvent).toBe(true);

      // Verify all reviews were processed (only the 2 manual reviews, empty answer is auto-reviewed)
      expect(reviewEvents).toHaveLength(2);

      // Clean up
      await utils.cleanupGameClients(setupResult);
    });
  });
});
