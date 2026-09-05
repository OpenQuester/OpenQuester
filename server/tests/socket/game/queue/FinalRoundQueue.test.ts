import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { container } from "tsyringe";

import { GameActionLockService } from "application/services/lock/GameActionLockService";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { FinalAnswerReviewOutputData } from "domain/types/socket/events/FinalAnswerReviewData";
import {
  FinalAnswerSubmitOutputData,
  FinalBidSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  FinalSubmitEndEventData,
  SocketIOFinalAutoLossEventPayload
} from "domain/types/socket/events/FinalRoundEventData";
import { PlayerScoreChangeBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import {
  type CollectedSocketEvent,
  type EventCollector,
  finishTestCleanup,
  NO_TEST_FAILURE,
  QUEUE_BURST_SIZE,
  QUEUE_DRAIN_BUDGET_MS,
  releaseHeldGameLock
} from "tests/socket/game/utils/QueueTestHelpers";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { TestUtils } from "tests/utils/TestUtils";

describe("Game Lock and Queue Mechanics", () => {
  let suite: SocketGameTestSuite;
  let utils: SocketGameTestUtils;
  let testUtils: TestUtils;
  let lockService: GameActionLockService;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    utils = suite.utils;
    testUtils = suite.testUtils;
    lockService = container.resolve(GameActionLockService);
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Final Round Queue Drain", () => {
    it("should drain final bids through the answering transition without duplicate bids", () =>
      suite.scenario(async (scenario) => {
        const setup = await testUtils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanBidEvents: EventCollector<FinalBidSubmitOutputData> | null = null;
        let spectatorBidEvents: EventCollector<FinalBidSubmitOutputData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const biddingPhasePromise = scenario.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
          await testUtils.completeThemeElimination(playerSockets, gameId, playerUsers);
          await biddingPhasePromise;

          const bidSequence = Array.from({ length: QUEUE_BURST_SIZE }, (_, index) => {
            if (index === 0) {
              return {
                socket: playerSockets[0],
                playerId: playerUsers[0].id,
                bid: 800
              };
            }

            if (index === 1) {
              return {
                socket: playerSockets[1],
                playerId: playerUsers[1].id,
                bid: 600
              };
            }

            return {
              socket: playerSockets[index % playerSockets.length],
              playerId: playerUsers[index % playerUsers.length].id,
              bid: 100 + index
            };
          });
          const queuedBidActions = bidSequence.slice(0, -1);
          const drainTriggerAction = bidSequence[bidSequence.length - 1];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.FINAL_BID_SUBMIT
          });
          const allAccepted = probe.waitForCount(bidSequence.length);

          let queuedBidCount = 0;
          for (const bidAction of queuedBidActions) {
            scenario.actor(bidAction.socket).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
              bid: bidAction.bid
            });
            queuedBidCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedBidCount);
          }

          showmanBidEvents = scenario.collectEvents<FinalBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_BID_SUBMIT,
            2
          );
          spectatorBidEvents = scenario.collectEvents<FinalBidSubmitOutputData>(
            spectatorSockets[0],
            SocketIOGameEvents.FINAL_BID_SUBMIT,
            2
          );
          const questionDataPromises = [
            scenario.waitForEvent<FinalQuestionEventData>(
              showmanSocket,
              SocketIOGameEvents.FINAL_QUESTION_DATA
            ),
            scenario.waitForEvent<FinalQuestionEventData>(
              spectatorSockets[0],
              SocketIOGameEvents.FINAL_QUESTION_DATA
            )
          ];

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(drainTriggerAction.socket).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
            bid: drainTriggerAction.bid
          });

          const [showmanBids, spectatorBids] = await Promise.all([
            showmanBidEvents.promise,
            spectatorBidEvents.promise
          ]);
          await Promise.all(questionDataPromises);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(bidSequence.length);
          expect(probe.records().map(({ playerId }) => playerId)).toEqual(
            bidSequence.map(({ playerId }) => playerId)
          );
          const durationMs = Date.now() - startedAt;

          const expectedBidEvents = bidSequence.slice(0, 2).map((bidAction) => ({
            playerId: bidAction.playerId,
            bidAmount: bidAction.bid
          }));
          expect(showmanBids).toEqual(expectedBidEvents);
          expect(spectatorBids).toEqual(expectedBidEvents);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await testUtils.getGameState(gameId);
          expect(finalState.questionState).toBe(QuestionState.ANSWERING);
          expect(finalState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
          expect(finalState.finalRoundData?.bids[playerUsers[0].id]).toBe(800);
          expect(finalState.finalRoundData?.bids[playerUsers[1].id]).toBe(600);
          expect(Object.keys(finalState.finalRoundData?.bids ?? {})).toHaveLength(2);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanBidEvents ?? undefined, spectatorBidEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));

    it("should process a queued final bidding timer expiration before the drain-trigger action", () =>
      suite.scenario(async (scenario) => {
        const setup = await testUtils.setupFinalRoundGame({
          playersCount: 3,
          playerScores: [1500, 1200, 900]
        });
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanDrainEvents: EventCollector<
          CollectedSocketEvent<
            | FinalBidSubmitOutputData
            | FinalQuestionEventData
            | FinalPhaseCompleteEventData
            | PlayerScoreChangeBroadcastData
          >
        > | null = null;
        let spectatorDrainEvents: EventCollector<
          CollectedSocketEvent<
            | FinalBidSubmitOutputData
            | FinalQuestionEventData
            | FinalPhaseCompleteEventData
            | PlayerScoreChangeBroadcastData
          >
        > | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const biddingPhasePromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
          await testUtils.completeThemeElimination(playerSockets, gameId, playerUsers);
          await biddingPhasePromise;

          const biddingState = await testUtils.getGameState(gameId);
          expect(biddingState.questionState).toBe(QuestionState.BIDDING);
          expect(biddingState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.PLAYER_SCORE_CHANGE
          });
          const allAccepted = probe.waitForCount(1);

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          await testUtils.expireTimerAndWaitForAction(gameId, GameActionType.TIMER_BIDDING_EXPIRED);
          await utils.waitForQueueLengthAtLeast(gameId, 1);

          const drainEventTypes = [
            SocketIOGameEvents.FINAL_BID_SUBMIT,
            SocketIOGameEvents.FINAL_QUESTION_DATA,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE,
            SocketIOGameEvents.SCORE_CHANGED
          ];
          const expectedDrainEventOrder = [
            SocketIOGameEvents.FINAL_BID_SUBMIT,
            SocketIOGameEvents.FINAL_BID_SUBMIT,
            SocketIOGameEvents.FINAL_BID_SUBMIT,
            SocketIOGameEvents.FINAL_QUESTION_DATA,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE,
            SocketIOGameEvents.SCORE_CHANGED
          ];
          const drainTriggerScore = 1777;

          showmanDrainEvents = scenario.collectSocketEvents<
            | FinalBidSubmitOutputData
            | FinalQuestionEventData
            | FinalPhaseCompleteEventData
            | PlayerScoreChangeBroadcastData
          >(
            showmanSocket,
            drainEventTypes,
            expectedDrainEventOrder.length,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );
          spectatorDrainEvents = scenario.collectSocketEvents<
            | FinalBidSubmitOutputData
            | FinalQuestionEventData
            | FinalPhaseCompleteEventData
            | PlayerScoreChangeBroadcastData
          >(
            spectatorSockets[0],
            drainEventTypes,
            expectedDrainEventOrder.length,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          });

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanDrainEvents.promise,
            spectatorDrainEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(1);
          const durationMs = Date.now() - startedAt;

          const eventOrder = (
            events: Array<
              CollectedSocketEvent<
                | FinalBidSubmitOutputData
                | FinalQuestionEventData
                | FinalPhaseCompleteEventData
                | PlayerScoreChangeBroadcastData
              >
            >
          ) => events.map(({ event }) => event);

          expect(eventOrder(showmanEvents)).toEqual(expectedDrainEventOrder);
          expect(eventOrder(spectatorEvents)).toEqual(expectedDrainEventOrder);

          const timeoutBids = showmanEvents
            .slice(0, 3)
            .map((event) => event.data as FinalBidSubmitOutputData);
          const expectedTimeoutBids = playerUsers.map((playerUser) => ({
            playerId: playerUser.id,
            bidAmount: 1,
            isAutomatic: true
          }));
          expect(timeoutBids).toEqual(expectedTimeoutBids);

          const phaseComplete = showmanEvents[4].data as FinalPhaseCompleteEventData;
          expect(phaseComplete.phase).toBe(FinalRoundPhase.BIDDING);
          expect(phaseComplete.nextPhase).toBe(FinalRoundPhase.ANSWERING);
          expect(phaseComplete.timer).toBeDefined();
          expect(showmanEvents[5].data).toEqual({
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          } satisfies PlayerScoreChangeBroadcastData);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await testUtils.getGameState(gameId);
          expect(finalState.questionState).toBe(QuestionState.ANSWERING);
          expect(finalState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
          for (const playerUser of playerUsers) {
            expect(finalState.finalRoundData?.bids[playerUser.id]).toBe(1);
          }

          const finalGame = await utils.getGameFromGameService(gameId);
          const scoredPlayer = finalGame.players.find(
            (player) => player.meta.id === playerUsers[0].id
          );
          expect(scoredPlayer?.score).toBe(drainTriggerScore);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanDrainEvents ?? undefined, spectatorDrainEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));

    it("should process a queued final answering timer expiration before the drain-trigger action", () =>
      suite.scenario(async (scenario) => {
        const setup = await testUtils.setupFinalRoundGame({
          playersCount: 3,
          playerScores: [1500, 1200, 900]
        });
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanDrainEvents: EventCollector<
          CollectedSocketEvent<
            | FinalAnswerSubmitOutputData
            | SocketIOFinalAutoLossEventPayload
            | FinalSubmitEndEventData
            | PlayerScoreChangeBroadcastData
          >
        > | null = null;
        let spectatorDrainEvents: EventCollector<
          CollectedSocketEvent<
            | FinalAnswerSubmitOutputData
            | SocketIOFinalAutoLossEventPayload
            | FinalSubmitEndEventData
            | PlayerScoreChangeBroadcastData
          >
        > | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const biddingPhasePromise = scenario.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
          await testUtils.completeThemeElimination(playerSockets, gameId, playerUsers);
          await biddingPhasePromise;

          const firstBidPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_BID_SUBMIT
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
          await firstBidPromise;

          const secondBidPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_BID_SUBMIT
          );
          scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
          await secondBidPromise;

          const questionDataPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_QUESTION_DATA
          );
          scenario.actor(playerSockets[2]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 400 });
          await questionDataPromise;

          const manualAnswerPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
            answerText: "Answered before queued timer"
          });
          await manualAnswerPromise;

          const answeringState = await testUtils.getGameState(gameId);
          expect(answeringState.questionState).toBe(QuestionState.ANSWERING);
          expect(answeringState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.PLAYER_SCORE_CHANGE
          });
          const allAccepted = probe.waitForCount(1);

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          await testUtils.expireTimerAndWaitForAction(
            gameId,
            GameActionType.TIMER_FINAL_ANSWERING_EXPIRED
          );
          await utils.waitForQueueLengthAtLeast(gameId, 1);

          const drainEventTypes = [
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
            SocketIOGameEvents.FINAL_AUTO_LOSS,
            SocketIOGameEvents.FINAL_SUBMIT_END,
            SocketIOGameEvents.SCORE_CHANGED
          ];
          const expectedDrainEventOrder = [
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
            SocketIOGameEvents.FINAL_AUTO_LOSS,
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
            SocketIOGameEvents.FINAL_AUTO_LOSS,
            SocketIOGameEvents.FINAL_SUBMIT_END,
            SocketIOGameEvents.SCORE_CHANGED
          ];
          const drainTriggerScore = 1888;

          showmanDrainEvents = scenario.collectSocketEvents<
            | FinalAnswerSubmitOutputData
            | SocketIOFinalAutoLossEventPayload
            | FinalSubmitEndEventData
            | PlayerScoreChangeBroadcastData
          >(
            showmanSocket,
            drainEventTypes,
            expectedDrainEventOrder.length,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );
          spectatorDrainEvents = scenario.collectSocketEvents<
            | FinalAnswerSubmitOutputData
            | SocketIOFinalAutoLossEventPayload
            | FinalSubmitEndEventData
            | PlayerScoreChangeBroadcastData
          >(
            spectatorSockets[0],
            drainEventTypes,
            expectedDrainEventOrder.length,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          });

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanDrainEvents.promise,
            spectatorDrainEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(1);
          const durationMs = Date.now() - startedAt;

          const eventOrder = (
            events: Array<
              CollectedSocketEvent<
                | FinalAnswerSubmitOutputData
                | SocketIOFinalAutoLossEventPayload
                | FinalSubmitEndEventData
                | PlayerScoreChangeBroadcastData
              >
            >
          ) => events.map(({ event }) => event);

          expect(eventOrder(showmanEvents)).toEqual(expectedDrainEventOrder);
          expect(eventOrder(spectatorEvents)).toEqual(expectedDrainEventOrder);

          const timeoutAnswers = [showmanEvents[0], showmanEvents[2]].map(
            (event) => event.data as FinalAnswerSubmitOutputData
          );
          const timeoutAutoLosses = [showmanEvents[1], showmanEvents[3]].map(
            (event) => event.data as SocketIOFinalAutoLossEventPayload
          );
          const expectedTimeoutAnswers = [
            { playerId: playerUsers[1].id },
            { playerId: playerUsers[2].id }
          ];
          const expectedTimeoutAutoLosses = expectedTimeoutAnswers.map((answer) => ({
            ...answer,
            reason: FinalAnswerLossReason.TIMEOUT
          }));

          expect(timeoutAnswers).toEqual(expectedTimeoutAnswers);
          expect(timeoutAutoLosses).toEqual(expectedTimeoutAutoLosses);

          const submitEnd = showmanEvents[4].data as FinalSubmitEndEventData;
          expect(submitEnd.phase).toBe(FinalRoundPhase.ANSWERING);
          expect(submitEnd.nextPhase).toBe(FinalRoundPhase.REVIEWING);
          expect(submitEnd.allReviews).toHaveLength(3);
          expect(submitEnd.allReviews?.map((review) => review.answerText)).toEqual(
            expect.arrayContaining(["Answered before queued timer", "", ""])
          );
          expect(showmanEvents[5].data).toEqual({
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          } satisfies PlayerScoreChangeBroadcastData);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await testUtils.getGameState(gameId);
          expect(finalState.questionState).toBe(QuestionState.REVIEWING);
          expect(finalState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

          const finalGame = await utils.getGameFromGameService(gameId);
          const scoredPlayer = finalGame.players.find(
            (player) => player.meta.id === playerUsers[0].id
          );
          expect(scoredPlayer?.score).toBe(drainTriggerScore);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanDrainEvents ?? undefined, spectatorDrainEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));

    it("should apply only the first final answer review from a queued duplicate burst", () =>
      suite.scenario(async (scenario) => {
        const setup = await testUtils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanReviewEvents: EventCollector<FinalAnswerReviewOutputData> | null = null;
        let spectatorReviewEvents: EventCollector<FinalAnswerReviewOutputData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const biddingPhasePromise = scenario.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
          await testUtils.completeThemeElimination(playerSockets, gameId, playerUsers);
          await biddingPhasePromise;

          const firstBidPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_BID_SUBMIT
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
          await firstBidPromise;

          const questionDataPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_QUESTION_DATA
          );
          scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
          await questionDataPromise;

          const firstAnswerPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
            answerText: "Queued review target answer"
          });
          await firstAnswerPromise;

          const submitEndPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_SUBMIT_END
          );
          scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
            answerText: "Unreviewed second answer"
          });
          await submitEndPromise;

          const reviewingState = await testUtils.getGameState(gameId);
          expect(reviewingState.questionState).toBe(QuestionState.REVIEWING);
          expect(reviewingState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

          const reviewedAnswer = reviewingState.finalRoundData!.answers.find(
            (answer) => answer.playerId === playerUsers[0].id
          )!;
          const unreviewedAnswer = reviewingState.finalRoundData!.answers.find(
            (answer) => answer.playerId === playerUsers[1].id
          )!;
          const duplicateReviewAction = {
            answerId: reviewedAnswer.id,
            isCorrect: true
          };

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.FINAL_ANSWER_REVIEW
          });
          const allAccepted = probe.waitForCount(QUEUE_BURST_SIZE);

          for (
            let queuedReviewCount = 1;
            queuedReviewCount < QUEUE_BURST_SIZE;
            queuedReviewCount += 1
          ) {
            scenario
              .actor(showmanSocket)
              .emit(SocketIOGameEvents.FINAL_ANSWER_REVIEW, duplicateReviewAction);
            await utils.waitForQueueLengthAtLeast(gameId, queuedReviewCount);
          }

          showmanReviewEvents = scenario.collectEvents<FinalAnswerReviewOutputData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_ANSWER_REVIEW,
            1
          );
          spectatorReviewEvents = scenario.collectEvents<FinalAnswerReviewOutputData>(
            spectatorSockets[0],
            SocketIOGameEvents.FINAL_ANSWER_REVIEW,
            1
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario
            .actor(showmanSocket)
            .emit(SocketIOGameEvents.FINAL_ANSWER_REVIEW, duplicateReviewAction);

          const [showmanReviews, spectatorReviews] = await Promise.all([
            showmanReviewEvents.promise,
            spectatorReviewEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(QUEUE_BURST_SIZE);
          const durationMs = Date.now() - startedAt;

          const expectedReview = {
            answerId: reviewedAnswer.id,
            playerId: playerUsers[0].id,
            isCorrect: true,
            scoreChange: 800
          };
          expect(showmanReviews).toEqual([expectedReview]);
          expect(spectatorReviews).toEqual([expectedReview]);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await testUtils.getGameState(gameId);
          expect(finalState.questionState).toBe(QuestionState.REVIEWING);
          expect(finalState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

          const finalReviewedAnswer = finalState.finalRoundData!.answers.find(
            (answer) => answer.id === reviewedAnswer.id
          )!;
          const finalUnreviewedAnswer = finalState.finalRoundData!.answers.find(
            (answer) => answer.id === unreviewedAnswer.id
          )!;
          expect(finalReviewedAnswer.isCorrect).toBe(true);
          expect(finalUnreviewedAnswer.isCorrect).toBeUndefined();

          const game = await utils.getGameFromGameService(gameId);
          const reviewedPlayer = game.getPlayer(playerUsers[0].id, { fetchDisconnected: false });
          const unreviewedPlayer = game.getPlayer(playerUsers[1].id, { fetchDisconnected: false });
          expect(reviewedPlayer?.score).toBe(2300);
          expect(unreviewedPlayer?.score).toBe(1200);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanReviewEvents ?? undefined, spectatorReviewEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));

    it("should apply only the first final answer from a queued duplicate burst", () =>
      suite.scenario(async (scenario) => {
        const setup = await testUtils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanAnswerEvents: EventCollector<FinalAnswerSubmitOutputData> | null = null;
        let spectatorAnswerEvents: EventCollector<FinalAnswerSubmitOutputData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const biddingPhasePromise = scenario.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
          await testUtils.completeThemeElimination(playerSockets, gameId, playerUsers);
          await biddingPhasePromise;

          const firstBidPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_BID_SUBMIT
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
          await firstBidPromise;

          const questionDataPromises = [
            scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_QUESTION_DATA),
            scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.FINAL_QUESTION_DATA),
            scenario.waitForEvent(spectatorSockets[0], SocketIOGameEvents.FINAL_QUESTION_DATA)
          ];
          scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
          await Promise.all(questionDataPromises);

          const answeringState = await testUtils.getGameState(gameId);
          expect(answeringState.questionState).toBe(QuestionState.ANSWERING);
          expect(answeringState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

          const answerTexts = Array.from(
            { length: QUEUE_BURST_SIZE },
            (_, index) => `Queued final answer ${index + 1}`
          );
          const queuedAnswerTexts = answerTexts.slice(0, -1);
          const drainTriggerAnswerText = answerTexts[answerTexts.length - 1];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.FINAL_ANSWER_SUBMIT
          });
          const allAccepted = probe.waitForCount(answerTexts.length);

          let queuedAnswerCount = 0;
          for (const answerText of queuedAnswerTexts) {
            scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
              answerText
            });
            queuedAnswerCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedAnswerCount);
          }

          showmanAnswerEvents = scenario.collectEvents<FinalAnswerSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
            1
          );
          spectatorAnswerEvents = scenario.collectEvents<FinalAnswerSubmitOutputData>(
            spectatorSockets[0],
            SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
            1
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
            answerText: drainTriggerAnswerText
          });

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanAnswerEvents.promise,
            spectatorAnswerEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(answerTexts.length);
          const durationMs = Date.now() - startedAt;

          const expectedSubmission = { playerId: playerUsers[0].id };
          expect(showmanEvents).toEqual([expectedSubmission]);
          expect(spectatorEvents).toEqual([expectedSubmission]);
          expect(showmanAnswerEvents.count()).toBe(1);
          expect(spectatorAnswerEvents.count()).toBe(1);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await testUtils.getGameState(gameId);
          expect(finalState.questionState).toBe(QuestionState.ANSWERING);
          expect(finalState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
          expect(finalState.finalRoundData?.answers).toHaveLength(1);
          expect(finalState.finalRoundData?.answers[0]).toMatchObject({
            playerId: playerUsers[0].id,
            answer: answerTexts[0]
          });
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanAnswerEvents ?? undefined, spectatorAnswerEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));
  });
});
