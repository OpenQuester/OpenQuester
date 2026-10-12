import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { container } from "tsyringe";
import { Repository } from "typeorm";

import { GameActionLockService } from "application/services/lock/GameActionLockService";
import {
  GAME_QUESTION_ANSWER_TIME,
  MEDIA_DOWNLOAD_TIMEOUT,
  SYSTEM_PLAYER_ID
} from "domain/constants/game";
import { GameActionType } from "domain/enums/GameActionType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import {
  StakeBidSubmitOutputData,
  StakeBidType
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import {
  PlayerReadinessBroadcastData,
  PlayerRestrictionBroadcastData,
  PlayerRoleChangeBroadcastData,
  PlayerScoreChangeBroadcastData,
  PlayerSlotChangeBroadcastData,
  TurnPlayerChangeBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { SecretQuestionTransferBroadcastData } from "domain/types/socket/game/SecretQuestionTransferData";
import { User } from "infrastructure/database/models/User";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import {
  assertFreshTimer,
  assertMediaDownloadStatus,
  assertMediaFixtureFiles,
  assertMediaQuestionData
} from "tests/e2e/flows/media-download/MediaDownloadAssertions";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
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
import {
  type GameTestSetup,
  SocketGameTestUtils
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { TestUtils } from "tests/utils/TestUtils";

async function pickQueuedMediaQuestion(
  scenario: GameScenario,
  utils: SocketGameTestUtils,
  setup: GameTestSetup
): Promise<number> {
  const { gameId, showmanSocket, playerSockets, spectatorSockets } = setup;
  const questionId = await utils.getFirstAvailableQuestionId(gameId);
  const question = await container.resolve(PackageStore).getQuestion(gameId, questionId);
  expect(question?.id).toBe(questionId);
  const files = question?.questionFiles ?? [];
  assertMediaFixtureFiles(files);
  const afterPick = scenario.mark();
  const probe = scenario.createAcceptedActionProbe({
    gameId,
    actionType: GameActionType.QUESTION_PICK
  });
  const accepted = probe.waitForCount(1);
  const data = scenario.trackExpectation(
    scenario.assert
      .broadcast<readonly [GameQuestionDataEventPayload]>({
        actors: [showmanSocket, ...playerSockets, ...spectatorSockets].map((socket) =>
          scenario.actor(socket)
        ),
        event: SocketIOGameEvents.QUESTION_DATA,
        timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
        afterSequence: afterPick
      })
      .then((records) => {
        for (const record of records) {
          assertMediaQuestionData(record.args[0], questionId, files);
          expect(record.args[0].data.text).toBe("Simple question text");
          if (record.actorLabel === scenario.actor(showmanSocket).label) {
            expect(record.args[0].data).toHaveProperty("answerText", "Simple answer");
          } else {
            expect(record.args[0].data).not.toHaveProperty("answerText");
          }
        }
      }),
    "validated queued media question data"
  );
  scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId });
  await Promise.all([accepted, data]);
  await scenario.assert.waitForActionsComplete({ gameId });
  expect(probe.records()).toHaveLength(1);
  const state = await utils.getGameState(gameId);
  expect(state?.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
  assertFreshTimer(state?.timer, MEDIA_DOWNLOAD_TIMEOUT, "queued media question");
  assertSingleQuestionData(scenario, setup, afterPick);
  return afterPick;
}

function assertSingleQuestionData(
  scenario: GameScenario,
  setup: GameTestSetup,
  afterSequence: number
): void {
  for (const socket of [setup.showmanSocket, ...setup.playerSockets, ...setup.spectatorSockets]) {
    scenario.assert.expectDirectedEventCount({
      actor: scenario.actor(socket),
      direction: "inbound",
      event: SocketIOGameEvents.QUESTION_DATA,
      afterSequence,
      expectedCount: 1
    });
  }
}

describe("Game Lock and Queue Mechanics", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;
  let testUtils: TestUtils;
  let lockService: GameActionLockService;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
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

  describe("Queued Media Download", () => {
    it("should drain media download confirmations in FIFO order through the showing transition", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 1, true, 0, true);
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanStatusEvents: EventCollector<MediaDownloadStatusBroadcastData> | null = null;
        let spectatorStatusEvents: EventCollector<MediaDownloadStatusBroadcastData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const afterQuestionPick = await pickQueuedMediaQuestion(scenario, utils, setup);

          const mediaDownloadActions = playerSockets.map((socket, index) => ({
            socket,
            playerId: playerUsers[index].id
          }));
          const queuedMediaDownloadActions = mediaDownloadActions.slice(0, -1);
          const drainTriggerAction = mediaDownloadActions[mediaDownloadActions.length - 1];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const afterDownload = scenario.mark();
          const accepted = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.MEDIA_DOWNLOADED
          });
          const allAccepted = accepted.waitForCount(mediaDownloadActions.length);
          let queuedMediaDownloadCount = 0;
          for (const action of queuedMediaDownloadActions) {
            scenario.actor(action.socket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
            queuedMediaDownloadCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedMediaDownloadCount);
          }

          showmanStatusEvents = scenario.collectEvents<MediaDownloadStatusBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            mediaDownloadActions.length
          );
          spectatorStatusEvents = scenario.collectEvents<MediaDownloadStatusBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            mediaDownloadActions.length
          );
          assertSingleQuestionData(scenario, setup, afterQuestionPick);

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(drainTriggerAction.socket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED);

          const [showmanStatuses, spectatorStatuses] = await Promise.all([
            showmanStatusEvents.promise,
            spectatorStatusEvents.promise,
            allAccepted
          ]);
          await utils.waitForActionsComplete(gameId);
          const durationMs = Date.now() - startedAt;

          const statusOrder = (statuses: MediaDownloadStatusBroadcastData[]) =>
            statuses.map((status) => ({
              playerId: status.playerId,
              mediaDownloaded: status.mediaDownloaded,
              allPlayersReady: status.allPlayersReady,
              hasTimer: status.timer !== null && status.timer !== undefined
            }));
          const expectedStatusOrder = mediaDownloadActions.map((action, index) => ({
            playerId: action.playerId,
            mediaDownloaded: true,
            allPlayersReady: index === mediaDownloadActions.length - 1,
            hasTimer: index === mediaDownloadActions.length - 1
          }));

          expect(statusOrder(showmanStatuses)).toEqual(expectedStatusOrder);
          expect(statusOrder(spectatorStatuses)).toEqual(expectedStatusOrder);
          for (const statuses of [showmanStatuses, spectatorStatuses]) {
            statuses.forEach((status, index) =>
              assertMediaDownloadStatus(
                status,
                mediaDownloadActions[index].playerId,
                index === mediaDownloadActions.length - 1
              )
            );
          }
          expect(accepted.records()).toHaveLength(mediaDownloadActions.length);
          scenario.assert.expectOutboundCommandCount({
            event: SocketIOGameEvents.MEDIA_DOWNLOADED,
            afterSequence: afterDownload,
            expectedCount: mediaDownloadActions.length
          });
          for (const socket of [showmanSocket, spectatorSockets[0]]) {
            scenario.assert.expectDirectedEventCount({
              actor: scenario.actor(socket),
              direction: "inbound",
              event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
              afterSequence: afterDownload,
              expectedCount: mediaDownloadActions.length
            });
          }
          assertSingleQuestionData(scenario, setup, afterQuestionPick);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.questionState).toBe(QuestionState.SHOWING);
          assertFreshTimer(finalState?.timer, GAME_QUESTION_ANSWER_TIME, "queue media completion");
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanStatusEvents ?? undefined, spectatorStatusEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));
  });

  describe("Timer Expiration Queue Drain", () => {
    it("should process a queued media download timer expiration before the drain-trigger action", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1, true, 0, true);
        const { showmanSocket, spectatorSockets, gameId, playerUsers } = setup;

        let showmanDrainEvents: EventCollector<
          CollectedSocketEvent<MediaDownloadStatusBroadcastData | PlayerScoreChangeBroadcastData>
        > | null = null;
        let spectatorDrainEvents: EventCollector<
          CollectedSocketEvent<MediaDownloadStatusBroadcastData | PlayerScoreChangeBroadcastData>
        > | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const afterQuestionPick = await pickQueuedMediaQuestion(scenario, utils, setup);

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const timeoutProbe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED
          });
          const timeoutAccepted = timeoutProbe.waitForCount(1);
          await testUtils.expireTimerAndWaitForAction(
            gameId,
            GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED
          );
          await timeoutAccepted;
          await utils.waitForQueueLengthAtLeast(gameId, 1);
          assertSingleQuestionData(scenario, setup, afterQuestionPick);

          const drainTriggerScore = 333;
          const drainEvents = [
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            SocketIOGameEvents.SCORE_CHANGED
          ];

          showmanDrainEvents = scenario.collectSocketEvents<
            MediaDownloadStatusBroadcastData | PlayerScoreChangeBroadcastData
          >(
            showmanSocket,
            drainEvents,
            drainEvents.length,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );
          spectatorDrainEvents = scenario.collectSocketEvents<
            MediaDownloadStatusBroadcastData | PlayerScoreChangeBroadcastData
          >(
            spectatorSockets[0],
            drainEvents,
            drainEvents.length,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const scoreProbe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.PLAYER_SCORE_CHANGE
          });
          const scoreAccepted = scoreProbe.waitForCount(1);
          const afterScore = scenario.mark();
          const startedAt = Date.now();
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          });

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanDrainEvents.promise,
            spectatorDrainEvents.promise,
            scoreAccepted
          ]);
          await utils.waitForActionsComplete(gameId);
          const durationMs = Date.now() - startedAt;

          const eventOrder = (
            events: Array<
              CollectedSocketEvent<
                MediaDownloadStatusBroadcastData | PlayerScoreChangeBroadcastData
              >
            >
          ) => events.map(({ event }) => event);

          expect(eventOrder(showmanEvents)).toEqual(drainEvents);
          expect(eventOrder(spectatorEvents)).toEqual(drainEvents);
          assertSingleQuestionData(scenario, setup, afterQuestionPick);
          expect(timeoutProbe.records()).toHaveLength(1);
          expect(scoreProbe.records()).toHaveLength(1);
          scenario.assert.expectOutboundCommandCount({
            actor: scenario.actor(showmanSocket),
            event: SocketIOGameEvents.SCORE_CHANGED,
            afterSequence: afterScore,
            expectedCount: 1
          });
          for (const socket of [showmanSocket, spectatorSockets[0]]) {
            for (const event of drainEvents) {
              scenario.assert.expectDirectedEventCount({
                actor: scenario.actor(socket),
                direction: "inbound",
                event,
                afterSequence: afterQuestionPick,
                expectedCount: 1
              });
            }
          }

          const timeoutStatus = showmanEvents[0].data as MediaDownloadStatusBroadcastData;
          expect(timeoutStatus.playerId).toBe(SYSTEM_PLAYER_ID);
          expect(timeoutStatus.mediaDownloaded).toBe(true);
          expect(timeoutStatus.allPlayersReady).toBe(true);
          expect(timeoutStatus.timer).toBeDefined();
          expect(timeoutStatus.timer).not.toBeNull();
          assertMediaDownloadStatus(timeoutStatus, SYSTEM_PLAYER_ID, true);
          assertMediaDownloadStatus(
            spectatorEvents[0].data as MediaDownloadStatusBroadcastData,
            SYSTEM_PLAYER_ID,
            true
          );
          expect(showmanEvents[1].data).toEqual({
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          } satisfies PlayerScoreChangeBroadcastData);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.questionState).toBe(QuestionState.SHOWING);
          assertFreshTimer(finalState?.timer, GAME_QUESTION_ANSWER_TIME, "queue media completion");

          const finalGame = await utils.getGameFromGameService(gameId);
          const activePlayersReady = finalGame.players
            .filter((player) => player.role === PlayerRole.PLAYER)
            .every((player) => player.mediaDownloaded);
          const scoredPlayer = finalGame.players.find(
            (player) => player.meta.id === playerUsers[0].id
          );
          expect(activePlayersReady).toBe(true);
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

    it("should process a queued secret transfer timer expiration before the drain-trigger action", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        const { showmanSocket, spectatorSockets, gameId, playerUsers, showmanUser } = setup;

        let showmanDrainEvents: EventCollector<
          CollectedSocketEvent<
            | SecretQuestionTransferBroadcastData
            | GameQuestionDataEventPayload
            | PlayerScoreChangeBroadcastData
          >
        > | null = null;
        let spectatorDrainEvents: EventCollector<
          CollectedSocketEvent<
            | SecretQuestionTransferBroadcastData
            | GameQuestionDataEventPayload
            | PlayerScoreChangeBroadcastData
          >
        > | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const secretQuestion = await utils.findQuestionByType(
            PackageQuestionType.SECRET,
            gameId,
            PackageQuestionTransferType.ANY
          );
          expect(secretQuestion).toBeDefined();

          const pickedPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.SECRET_QUESTION_PICKED
          );
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
            questionId: secretQuestion!.id
          });
          await pickedPromise;

          const transferState = await utils.getGameState(gameId);
          expect(transferState!.questionState).toBe(QuestionState.SECRET_TRANSFER);
          expect(transferState!.timer).toBeDefined();

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
            GameActionType.TIMER_QUESTION_SHOWING_EXPIRED
          );
          await utils.waitForQueueLengthAtLeast(gameId, 1);

          const drainEventTypes = [
            SocketIOGameEvents.SECRET_QUESTION_TRANSFER,
            SocketIOGameEvents.QUESTION_DATA,
            SocketIOGameEvents.SCORE_CHANGED
          ];
          const drainTriggerScore = 444;

          showmanDrainEvents = scenario.collectSocketEvents<
            | SecretQuestionTransferBroadcastData
            | GameQuestionDataEventPayload
            | PlayerScoreChangeBroadcastData
          >(
            showmanSocket,
            drainEventTypes,
            drainEventTypes.length,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );
          spectatorDrainEvents = scenario.collectSocketEvents<
            | SecretQuestionTransferBroadcastData
            | GameQuestionDataEventPayload
            | PlayerScoreChangeBroadcastData
          >(
            spectatorSockets[0],
            drainEventTypes,
            drainEventTypes.length,
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
                | SecretQuestionTransferBroadcastData
                | GameQuestionDataEventPayload
                | PlayerScoreChangeBroadcastData
              >
            >
          ) => events.map(({ event }) => event);

          expect(eventOrder(showmanEvents)).toEqual(drainEventTypes);
          expect(eventOrder(spectatorEvents)).toEqual(drainEventTypes);

          const transfer = showmanEvents[0].data as SecretQuestionTransferBroadcastData;
          const showmanQuestionData = showmanEvents[1].data as GameQuestionDataEventPayload;
          const spectatorQuestionData = spectatorEvents[1].data as GameQuestionDataEventPayload;
          const eligiblePlayerIds = playerUsers.map((playerUser) => playerUser.id);

          expect(transfer.fromPlayerId).toBe(showmanUser.id);
          expect(eligiblePlayerIds).toContain(transfer.toPlayerId);
          expect(transfer.questionId).toBe(secretQuestion!.id);
          expect((showmanQuestionData.data as PackageQuestionDTO).answerText).toBe("Secret answer");
          expect("answerText" in spectatorQuestionData.data).toBe(false);
          expect(showmanQuestionData.timer).toBeDefined();
          expect(spectatorQuestionData.timer).toEqual(showmanQuestionData.timer);
          expect(showmanEvents[2].data).toEqual({
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          } satisfies PlayerScoreChangeBroadcastData);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.questionState).toBe(QuestionState.ANSWERING);
          expect(finalState!.answeringPlayer).toBe(transfer.toPlayerId);
          expect(finalState!.secretQuestionData).toBeNull();

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

    it("should process a queued stake bidding timer expiration before the drain-trigger action", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanDrainEvents: EventCollector<
          CollectedSocketEvent<
            | StakeBidSubmitOutputData
            | StakeQuestionWinnerEventData
            | GameQuestionDataEventPayload
            | PlayerScoreChangeBroadcastData
          >
        > | null = null;
        let spectatorDrainEvents: EventCollector<
          CollectedSocketEvent<
            | StakeBidSubmitOutputData
            | StakeQuestionWinnerEventData
            | GameQuestionDataEventPayload
            | PlayerScoreChangeBroadcastData
          >
        > | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.setPlayerScore(gameId, playerUsers[0].id, 500);
          await utils.setPlayerScore(gameId, playerUsers[1].id, 300);
          await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

          const stakeQuestionId = await utils.getQuestionIdByType(
            gameId,
            PackageQuestionType.STAKE
          );
          const pickedPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.STAKE_QUESTION_PICKED
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_PICK, {
            questionId: stakeQuestionId
          });
          await pickedPromise;

          const firstTimeoutBidPromise = scenario.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );
          await testUtils.expireTimerAndWaitForAction(gameId, GameActionType.TIMER_BIDDING_EXPIRED);
          const firstTimeoutBid = await firstTimeoutBidPromise;
          expect(firstTimeoutBid).toEqual({
            playerId: playerUsers[0].id,
            bidType: StakeBidType.NORMAL,
            bidAmount: 200,
            isPhaseComplete: false,
            nextBidderId: playerUsers[1].id,
            timer: expect.any(Object)
          });

          const biddingState = await utils.getGameState(gameId);
          expect(biddingState!.questionState).toBe(QuestionState.BIDDING);

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
            SocketIOGameEvents.STAKE_BID_SUBMIT,
            SocketIOGameEvents.STAKE_QUESTION_WINNER,
            SocketIOGameEvents.QUESTION_DATA,
            SocketIOGameEvents.SCORE_CHANGED
          ];
          const drainTriggerScore = 555;

          showmanDrainEvents = scenario.collectSocketEvents<
            | StakeBidSubmitOutputData
            | StakeQuestionWinnerEventData
            | GameQuestionDataEventPayload
            | PlayerScoreChangeBroadcastData
          >(
            showmanSocket,
            drainEventTypes,
            drainEventTypes.length,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );
          spectatorDrainEvents = scenario.collectSocketEvents<
            | StakeBidSubmitOutputData
            | StakeQuestionWinnerEventData
            | GameQuestionDataEventPayload
            | PlayerScoreChangeBroadcastData
          >(
            spectatorSockets[0],
            drainEventTypes,
            drainEventTypes.length,
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
                | StakeBidSubmitOutputData
                | StakeQuestionWinnerEventData
                | GameQuestionDataEventPayload
                | PlayerScoreChangeBroadcastData
              >
            >
          ) => events.map(({ event }) => event);

          expect(eventOrder(showmanEvents)).toEqual(drainEventTypes);
          expect(eventOrder(spectatorEvents)).toEqual(drainEventTypes);

          const finalBid = showmanEvents[0].data as StakeBidSubmitOutputData;
          const winnerData = showmanEvents[1].data as StakeQuestionWinnerEventData;
          const showmanQuestionData = showmanEvents[2].data as GameQuestionDataEventPayload;
          const spectatorQuestionData = spectatorEvents[2].data as GameQuestionDataEventPayload;

          expect(finalBid.playerId).toBe(playerUsers[1].id);
          expect(finalBid.bidType).toBe(StakeBidType.PASS);
          expect(finalBid.bidAmount).toBeNull();
          expect(finalBid.isPhaseComplete).toBe(true);
          expect(finalBid.nextBidderId).toBeNull();
          expect(winnerData.winnerPlayerId).toBe(playerUsers[0].id);
          expect(winnerData.finalBid).toBe(200);
          expect((showmanQuestionData.data as PackageQuestionDTO).answerText).toBe("Stake answer");
          expect("answerText" in spectatorQuestionData.data).toBe(false);
          expect(showmanQuestionData.timer).toBeDefined();
          expect(spectatorQuestionData.timer).toEqual(showmanQuestionData.timer);
          expect(showmanEvents[3].data).toEqual({
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          } satisfies PlayerScoreChangeBroadcastData);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.questionState).toBe(QuestionState.ANSWERING);
          expect(finalState!.answeringPlayer).toBe(playerUsers[0].id);

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

    it("should let a timer expiration drain actions queued before it", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        let scoreEvents: EventCollector<PlayerScoreChangeBroadcastData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const showingState = await utils.getGameState(gameId);
          expect(showingState!.questionState).toBe(QuestionState.SHOWING);

          const game = await utils.getGameFromGameService(gameId);
          const player = game.players.find((p) => p.role === PlayerRole.PLAYER)!;
          const queuedScores = [player.score + 10, player.score + 20, player.score + 30];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.PLAYER_SCORE_CHANGE
          });
          const allAccepted = probe.waitForCount(queuedScores.length);

          for (const newScore of queuedScores) {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
              playerId: player.meta.id,
              newScore
            });
          }

          await utils.waitForQueueLengthAtLeast(gameId, queuedScores.length);

          scoreEvents = scenario.collectEvents<PlayerScoreChangeBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.SCORE_CHANGED,
            queuedScores.length
          );
          const questionFinishPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.QUESTION_FINISH,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          await testUtils.expireTimerAndWaitForAction(
            gameId,
            GameActionType.TIMER_QUESTION_SHOWING_EXPIRED
          );

          const scoreBroadcasts = await scoreEvents.promise;
          await questionFinishPromise;
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(queuedScores.length);

          expect(scoreBroadcasts.map((event) => event.newScore)).toEqual(queuedScores);

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.questionState).toBe(QuestionState.SHOWING_ANSWER);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [scoreEvents ?? undefined], async () => {
            lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
          });
        }
      }));

    it("should process a timer expiration that was queued while the game lock was held", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        let scoreEvents: EventCollector<PlayerScoreChangeBroadcastData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const showingState = await utils.getGameState(gameId);
          expect(showingState!.questionState).toBe(QuestionState.SHOWING);

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
            GameActionType.TIMER_QUESTION_SHOWING_EXPIRED
          );
          await utils.waitForQueueLengthAtLeast(gameId, 1);

          const game = await utils.getGameFromGameService(gameId);
          const player = game.players.find((p) => p.role === PlayerRole.PLAYER)!;
          const newScore = player.score + 50;

          const questionFinishPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.QUESTION_FINISH,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );
          scoreEvents = scenario.collectEvents<PlayerScoreChangeBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.SCORE_CHANGED,
            1
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
            playerId: player.meta.id,
            newScore
          });

          await questionFinishPromise;
          const scoreBroadcasts = await scoreEvents.promise;
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(1);

          expect(scoreBroadcasts[0]).toEqual({
            playerId: player.meta.id,
            newScore
          });

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.questionState).toBe(QuestionState.SHOWING_ANSWER);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [scoreEvents ?? undefined], async () => {
            lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
          });
        }
      }));

    it("should process a queued answering timer expiration before the drain-trigger action", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let playerDrainEvents: EventCollector<
          CollectedSocketEvent<QuestionAnswerResultEventPayload | PlayerScoreChangeBroadcastData>
        > | null = null;
        let spectatorDrainEvents: EventCollector<
          CollectedSocketEvent<QuestionAnswerResultEventPayload | PlayerScoreChangeBroadcastData>
        > | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);
          await utils.answerQuestion(playerSockets[0], showmanSocket);
          await utils.waitForActionsComplete(gameId);

          const answeringState = await utils.getGameState(gameId);
          expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
          expect(answeringState!.answeringPlayer).toBe(playerUsers[0].id);
          expect(answeringState!.timer).toBeDefined();

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
            GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED
          );
          await utils.waitForQueueLengthAtLeast(gameId, 1);

          const gameBeforeDrain = await utils.getGameFromGameService(gameId);
          const answeringPlayer = gameBeforeDrain.players.find(
            (player) => player.meta.id === playerUsers[0].id
          )!;
          const drainTriggerScore = answeringPlayer.score + 75;
          const drainEvents = [SocketIOGameEvents.ANSWER_RESULT, SocketIOGameEvents.SCORE_CHANGED];

          playerDrainEvents = scenario.collectSocketEvents<
            QuestionAnswerResultEventPayload | PlayerScoreChangeBroadcastData
          >(playerSockets[0], drainEvents, 2, TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS);
          spectatorDrainEvents = scenario.collectSocketEvents<
            QuestionAnswerResultEventPayload | PlayerScoreChangeBroadcastData
          >(spectatorSockets[0], drainEvents, 2, TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS);

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          });

          const [playerEvents, spectatorEvents] = await Promise.all([
            playerDrainEvents.promise,
            spectatorDrainEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(1);
          const durationMs = Date.now() - startedAt;

          const eventOrder = (
            events: Array<
              CollectedSocketEvent<
                QuestionAnswerResultEventPayload | PlayerScoreChangeBroadcastData
              >
            >
          ) => events.map(({ event }) => event);

          expect(eventOrder(playerEvents)).toEqual(drainEvents);
          expect(eventOrder(spectatorEvents)).toEqual(drainEvents);

          const playerAnswerResult = playerEvents[0].data as QuestionAnswerResultEventPayload;
          const playerScoreChange = playerEvents[1].data as PlayerScoreChangeBroadcastData;

          expect(playerAnswerResult.answerResult.player).toBe(playerUsers[0].id);
          expect(playerAnswerResult.answerResult.answerType).toBe(AnswerResultType.WRONG);
          expect(playerAnswerResult.answerResult.result).toBeLessThan(0);
          expect(playerScoreChange).toEqual({
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          });
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.questionState).toBe(QuestionState.SHOWING_ANSWER);
          expect(finalState!.answeringPlayer).toBeNull();

          const finalGame = await utils.getGameFromGameService(gameId);
          const finalPlayer = finalGame.players.find(
            (player) => player.meta.id === playerUsers[0].id
          );
          expect(finalPlayer?.score).toBe(drainTriggerScore);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [playerDrainEvents ?? undefined, spectatorDrainEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));
  });

  describe("Queued Player Management", () => {
    it("should drain turn-player changes in FIFO order within the queue budget", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 1);
        const { showmanSocket, spectatorSockets, gameId, playerUsers } = setup;

        let showmanTurnEvents: EventCollector<TurnPlayerChangeBroadcastData> | null = null;
        let spectatorTurnEvents: EventCollector<TurnPlayerChangeBroadcastData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const turnPlayerSequence = Array.from({ length: QUEUE_BURST_SIZE }, (_, index) => ({
            newTurnPlayerId: playerUsers[index % playerUsers.length].id
          }));
          const queuedTurnPlayerActions = turnPlayerSequence.slice(0, -1);
          const drainTriggerAction = turnPlayerSequence[turnPlayerSequence.length - 1];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.TURN_PLAYER_CHANGE
          });
          const allAccepted = probe.waitForCount(turnPlayerSequence.length);

          let queuedTurnChangeCount = 0;
          for (const turnPlayerAction of queuedTurnPlayerActions) {
            scenario
              .actor(showmanSocket)
              .emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, turnPlayerAction);
            queuedTurnChangeCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedTurnChangeCount);
          }

          showmanTurnEvents = scenario.collectEvents<TurnPlayerChangeBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.TURN_PLAYER_CHANGED,
            QUEUE_BURST_SIZE
          );
          spectatorTurnEvents = scenario.collectEvents<TurnPlayerChangeBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.TURN_PLAYER_CHANGED,
            QUEUE_BURST_SIZE
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario
            .actor(showmanSocket)
            .emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, drainTriggerAction);

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanTurnEvents.promise,
            spectatorTurnEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(turnPlayerSequence.length);
          const durationMs = Date.now() - startedAt;

          expect(showmanEvents).toEqual(turnPlayerSequence);
          expect(spectatorEvents).toEqual(turnPlayerSequence);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.currentTurnPlayerId).toBe(drainTriggerAction.newTurnPlayerId);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanTurnEvents ?? undefined, spectatorTurnEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));

    it("should drain player slot changes in FIFO order within the queue budget", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
        const { playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let playerSlotEvents: EventCollector<PlayerSlotChangeBroadcastData> | null = null;
        let spectatorSlotEvents: EventCollector<PlayerSlotChangeBroadcastData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const targetPlayerId = playerUsers[0].id;
          const slotSequence = Array.from({ length: QUEUE_BURST_SIZE }, (_, index) => ({
            targetSlot: (index % 9) + 1
          }));
          const queuedSlotActions = slotSequence.slice(0, -1);
          const drainTriggerAction = slotSequence[slotSequence.length - 1];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.PLAYER_SLOT_CHANGE
          });
          const allAccepted = probe.waitForCount(slotSequence.length);

          let queuedSlotChangeCount = 0;
          for (const slotAction of queuedSlotActions) {
            scenario
              .actor(playerSockets[0])
              .emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, slotAction);
            queuedSlotChangeCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedSlotChangeCount);
          }

          playerSlotEvents = scenario.collectEvents<PlayerSlotChangeBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.PLAYER_SLOT_CHANGE,
            QUEUE_BURST_SIZE
          );
          spectatorSlotEvents = scenario.collectEvents<PlayerSlotChangeBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.PLAYER_SLOT_CHANGE,
            QUEUE_BURST_SIZE
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario
            .actor(playerSockets[0])
            .emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, drainTriggerAction);

          const [playerEvents, spectatorEvents] = await Promise.all([
            playerSlotEvents.promise,
            spectatorSlotEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(slotSequence.length);
          const durationMs = Date.now() - startedAt;

          const expectedSlotEvents = slotSequence.map(({ targetSlot }) => ({
            playerId: targetPlayerId,
            newSlot: targetSlot
          }));
          const eventOrder = (events: PlayerSlotChangeBroadcastData[]) =>
            events.map(({ playerId, newSlot }) => ({ playerId, newSlot }));

          expect(eventOrder(playerEvents)).toEqual(expectedSlotEvents);
          expect(eventOrder(spectatorEvents)).toEqual(expectedSlotEvents);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const game = await utils.getGameFromGameService(gameId);
          const targetPlayer = game.getPlayer(targetPlayerId, { fetchDisconnected: false });
          expect(targetPlayer?.gameSlot).toBe(drainTriggerAction.targetSlot);

          const finalPlayerEvent = playerEvents[playerEvents.length - 1];
          const syncedTargetPlayer = finalPlayerEvent.players.find(
            (player) => player.meta.id === targetPlayerId
          );
          expect(syncedTargetPlayer?.slot).toBe(drainTriggerAction.targetSlot);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [playerSlotEvents ?? undefined, spectatorSlotEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));

    it("should drain mute toggles in FIFO order within the queue budget", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
        const { showmanSocket, spectatorSockets, gameId, playerUsers } = setup;

        let showmanRestrictionEvents: EventCollector<PlayerRestrictionBroadcastData> | null = null;
        let spectatorRestrictionEvents: EventCollector<PlayerRestrictionBroadcastData> | null =
          null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const targetPlayerId = playerUsers[0].id;
          const muteToggleSequence = Array.from({ length: QUEUE_BURST_SIZE }, (_, index) => ({
            playerId: targetPlayerId,
            muted: index % 2 === 0,
            restricted: false,
            banned: false
          }));
          const queuedMuteActions = muteToggleSequence.slice(0, -1);
          const drainTriggerAction = muteToggleSequence[muteToggleSequence.length - 1];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.PLAYER_RESTRICTION
          });
          const allAccepted = probe.waitForCount(muteToggleSequence.length);

          let queuedMuteChangeCount = 0;
          for (const muteAction of queuedMuteActions) {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, muteAction);
            queuedMuteChangeCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedMuteChangeCount);
          }

          showmanRestrictionEvents = scenario.collectEvents<PlayerRestrictionBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.PLAYER_RESTRICTED,
            QUEUE_BURST_SIZE
          );
          spectatorRestrictionEvents = scenario.collectEvents<PlayerRestrictionBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.PLAYER_RESTRICTED,
            QUEUE_BURST_SIZE
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario
            .actor(showmanSocket)
            .emit(SocketIOGameEvents.PLAYER_RESTRICTED, drainTriggerAction);

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanRestrictionEvents.promise,
            spectatorRestrictionEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(muteToggleSequence.length);
          const durationMs = Date.now() - startedAt;

          expect(showmanEvents).toEqual(muteToggleSequence);
          expect(spectatorEvents).toEqual(muteToggleSequence);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const game = await utils.getGameFromGameService(gameId);
          const targetPlayer = game.getPlayer(targetPlayerId, { fetchDisconnected: false });
          expect(targetPlayer?.isMuted).toBe(drainTriggerAction.muted);
          expect(targetPlayer?.isRestricted).toBe(false);
          expect(targetPlayer?.isBanned).toBe(false);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanRestrictionEvents ?? undefined, spectatorRestrictionEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));

    it("should drain player role changes in FIFO order within the queue budget", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
        const { showmanSocket, spectatorSockets, gameId, playerUsers } = setup;

        let showmanRoleEvents: EventCollector<PlayerRoleChangeBroadcastData> | null = null;
        let spectatorRoleEvents: EventCollector<PlayerRoleChangeBroadcastData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const targetPlayerId = playerUsers[0].id;
          const roleSequence = Array.from({ length: QUEUE_BURST_SIZE }, (_, index) => ({
            playerId: targetPlayerId,
            newRole: index % 2 === 0 ? PlayerRole.SPECTATOR : PlayerRole.PLAYER
          }));
          const queuedRoleActions = roleSequence.slice(0, -1);
          const drainTriggerAction = roleSequence[roleSequence.length - 1];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.PLAYER_ROLE_CHANGE
          });
          const allAccepted = probe.waitForCount(roleSequence.length);

          let queuedRoleChangeCount = 0;
          for (const roleAction of queuedRoleActions) {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, roleAction);
            queuedRoleChangeCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedRoleChangeCount);
          }

          showmanRoleEvents = scenario.collectEvents<PlayerRoleChangeBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.PLAYER_ROLE_CHANGE,
            QUEUE_BURST_SIZE
          );
          spectatorRoleEvents = scenario.collectEvents<PlayerRoleChangeBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.PLAYER_ROLE_CHANGE,
            QUEUE_BURST_SIZE
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario
            .actor(showmanSocket)
            .emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, drainTriggerAction);

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanRoleEvents.promise,
            spectatorRoleEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(roleSequence.length);
          const durationMs = Date.now() - startedAt;

          const expectedRoleEvents = roleSequence.map(({ newRole }) => ({
            playerId: targetPlayerId,
            newRole
          }));
          const eventOrder = (events: PlayerRoleChangeBroadcastData[]) =>
            events.map(({ playerId, newRole }) => ({ playerId, newRole }));

          expect(eventOrder(showmanEvents)).toEqual(expectedRoleEvents);
          expect(eventOrder(spectatorEvents)).toEqual(expectedRoleEvents);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const game = await utils.getGameFromGameService(gameId);
          const targetPlayer = game.getPlayer(targetPlayerId, { fetchDisconnected: false });
          expect(targetPlayer?.role).toBe(drainTriggerAction.newRole);

          const finalShowmanEvent = showmanEvents[showmanEvents.length - 1];
          const syncedTargetPlayer = finalShowmanEvent.players.find(
            (player) => player.meta.id === targetPlayerId
          );
          expect(syncedTargetPlayer?.role).toBe(drainTriggerAction.newRole);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanRoleEvents ?? undefined, spectatorRoleEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));
  });

  describe("Queued Player Readiness", () => {
    it("should drain a ready/unready burst in FIFO order within the queue budget", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 1);
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanReadinessEvents: EventCollector<
          CollectedSocketEvent<PlayerReadinessBroadcastData>
        > | null = null;
        let spectatorReadinessEvents: EventCollector<
          CollectedSocketEvent<PlayerReadinessBroadcastData>
        > | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const player0ReadyAction = {
            socket: playerSockets[0],
            event: SocketIOGameEvents.PLAYER_READY,
            playerId: playerUsers[0].id
          };
          const player0UnreadyAction = {
            socket: playerSockets[0],
            event: SocketIOGameEvents.PLAYER_UNREADY,
            playerId: playerUsers[0].id
          };
          const player1ReadyAction = {
            socket: playerSockets[1],
            event: SocketIOGameEvents.PLAYER_READY,
            playerId: playerUsers[1].id
          };
          const player1UnreadyAction = {
            socket: playerSockets[1],
            event: SocketIOGameEvents.PLAYER_UNREADY,
            playerId: playerUsers[1].id
          };
          const readinessSequence = [
            player0ReadyAction,
            player1ReadyAction,
            player0UnreadyAction,
            player0ReadyAction,
            player1UnreadyAction,
            player1ReadyAction,
            player0UnreadyAction,
            player1UnreadyAction,
            player0ReadyAction,
            player1ReadyAction,
            player0UnreadyAction,
            player0ReadyAction,
            player1UnreadyAction,
            player1ReadyAction,
            player0UnreadyAction,
            player0ReadyAction,
            player1UnreadyAction,
            player1ReadyAction,
            player0UnreadyAction,
            player0ReadyAction
          ];
          const queuedReadinessActions = readinessSequence.slice(0, -1);
          const drainTriggerAction = readinessSequence[readinessSequence.length - 1];
          const readinessEvents = [
            SocketIOGameEvents.PLAYER_READY,
            SocketIOGameEvents.PLAYER_UNREADY
          ];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({ gameId });
          const allAccepted = probe.waitForCount(readinessSequence.length);

          let queuedReadinessCount = 0;
          for (const action of queuedReadinessActions) {
            scenario.actor(action.socket).emit(action.event);
            queuedReadinessCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedReadinessCount);
          }

          showmanReadinessEvents = scenario.collectSocketEvents<PlayerReadinessBroadcastData>(
            showmanSocket,
            readinessEvents,
            readinessSequence.length
          );
          spectatorReadinessEvents = scenario.collectSocketEvents<PlayerReadinessBroadcastData>(
            spectatorSockets[0],
            readinessEvents,
            readinessSequence.length
          );

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(drainTriggerAction.socket).emit(drainTriggerAction.event);

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanReadinessEvents.promise,
            spectatorReadinessEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(readinessSequence.length);
          expect(
            probe.records().map(({ actionType, playerId }) => ({ actionType, playerId }))
          ).toEqual(
            readinessSequence.map(({ event, playerId }) => ({
              actionType:
                event === SocketIOGameEvents.PLAYER_READY
                  ? GameActionType.PLAYER_READY
                  : GameActionType.PLAYER_UNREADY,
              playerId
            }))
          );
          const durationMs = Date.now() - startedAt;

          const expectedEventOrder = readinessSequence.map((action) => ({
            event: action.event,
            playerId: action.playerId,
            isReady: action.event === SocketIOGameEvents.PLAYER_READY,
            autoStartTriggered: false
          }));
          const eventOrder = (events: Array<CollectedSocketEvent<PlayerReadinessBroadcastData>>) =>
            events.map(({ event, data }) => ({
              event,
              playerId: data.playerId,
              isReady: data.isReady,
              autoStartTriggered: data.autoStartTriggered
            }));

          expect(eventOrder(showmanEvents)).toEqual(expectedEventOrder);
          expect(eventOrder(spectatorEvents)).toEqual(expectedEventOrder);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const gameState = await utils.getGameState(gameId);
          expect(gameState!.readyPlayers).toHaveLength(2);
          expect(gameState!.readyPlayers).toEqual(
            expect.arrayContaining([playerUsers[0].id, playerUsers[1].id])
          );
          expect(gameState!.readyPlayers).not.toContain(playerUsers[2].id);
          expect(gameState!.currentRound).toBeNull();
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanReadinessEvents ?? undefined, spectatorReadinessEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));
  });
});
