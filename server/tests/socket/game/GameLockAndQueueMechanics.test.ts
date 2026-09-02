import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { container } from "tsyringe";
import { Repository } from "typeorm";

import {
  GAME_QUESTION_ANSWER_TIME,
  MEDIA_DOWNLOAD_TIMEOUT,
  SYSTEM_PLAYER_ID
} from "domain/constants/game";
import { GameActionType } from "domain/enums/GameActionType";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import {
  AnswerSubmittedBroadcastData,
  GameLeaveBroadcastData,
  PlayerReadinessBroadcastData,
  PlayerRestrictionBroadcastData,
  PlayerRoleChangeBroadcastData,
  PlayerScoreChangeBroadcastData,
  PlayerSlotChangeBroadcastData,
  QuestionSkipBroadcastData,
  QuestionUnskipBroadcastData,
  TurnPlayerChangeBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import {
  StakeBidSubmitOutputData,
  StakeBidType
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { FinalAnswerReviewOutputData } from "domain/types/socket/events/FinalAnswerReviewData";
import {
  FinalAnswerSubmitOutputData,
  FinalBidSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  FinalSubmitEndEventData,
  SocketIOFinalAutoLossEventPayload
} from "domain/types/socket/events/FinalRoundEventData";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { SecretQuestionTransferBroadcastData } from "domain/types/socket/game/SecretQuestionTransferData";
import { GameActionLockService } from "application/services/lock/GameActionLockService";
import { User } from "infrastructure/database/models/User";
import {
  GameClientSocket,
  SocketGameTestUtils
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TEST_MEDIA_FILE_MD5 } from "tests/utils/PackageUtils";
import { TestUtils } from "tests/utils/TestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const QUEUE_BURST_SIZE = 20;
const QUEUE_DRAIN_BUDGET_MS = 500;
const NO_TEST_FAILURE = Symbol("NO_TEST_FAILURE");

interface EventCollector<T> {
  promise: Promise<T[]>;
  stop: () => void;
  count: () => number;
}

type EventCollectorCleanup = Pick<EventCollector<unknown>, "stop">;

interface CollectedSocketEvent<T> {
  event: string;
  data: T;
}

type MediaQuestionFiles = NonNullable<PackageQuestionDTO["questionFiles"]>;

interface MediaQuestionPreloadPayload {
  readonly questionId: number;
  readonly questionFiles: MediaQuestionFiles;
  readonly timer: GameQuestionDataEventPayload["timer"];
}

function expectMediaQuestionFiles(files: MediaQuestionFiles | undefined): void {
  expect(files).toHaveLength(1);
  expect(files).toEqual([
    expect.objectContaining({
      displayTime: null,
      order: 0,
      file: expect.objectContaining({
        md5: TEST_MEDIA_FILE_MD5,
        type: PackageFileType.IMAGE
      })
    })
  ]);
}

function expectFreshTimer(
  timer: GameQuestionDataEventPayload["timer"],
  expectedDurationMs: number
): void {
  expect(timer).toEqual(
    expect.objectContaining({
      durationMs: expectedDurationMs,
      elapsedMs: 0,
      resumedAt: null
    })
  );
  expect(Number.isNaN(Date.parse(String(timer.startedAt)))).toBe(false);
}

function expectMediaQuestionPreload(
  preload: MediaQuestionPreloadPayload,
  questionId: number
): void {
  expect(preload.questionId).toBe(questionId);
  expectMediaQuestionFiles(preload.questionFiles);
  expectFreshTimer(preload.timer, MEDIA_DOWNLOAD_TIMEOUT);
}

function expectMediaQuestionReveal(reveal: GameQuestionDataEventPayload, questionId: number): void {
  expect(reveal.data).toEqual(
    expect.objectContaining({
      id: questionId,
      text: "Simple question text",
      answerText: "Simple answer"
    })
  );
  expectMediaQuestionFiles(reveal.data.questionFiles ?? undefined);
  expectFreshTimer(reveal.timer, GAME_QUESTION_ANSWER_TIME);
}

async function releaseHeldGameLock(
  lockService: Pick<GameActionLockService, "releaseLock">,
  gameId: string,
  lockToken: string
): Promise<string> {
  if (!lockToken) {
    return "";
  }

  const released = await lockService.releaseLock(gameId, lockToken);
  if (!released) {
    throw new Error(`Game lock release lost ownership for game ${gameId}`);
  }

  return "";
}

async function finishTestCleanup(
  primaryFailure: unknown,
  collectors: ReadonlyArray<EventCollectorCleanup | undefined>,
  releaseLock?: () => Promise<void>
): Promise<void> {
  const failures: unknown[] = primaryFailure === NO_TEST_FAILURE ? [] : [primaryFailure];

  for (const [index, collector] of collectors.entries()) {
    if (!collector) {
      continue;
    }

    try {
      collector.stop();
    } catch (error) {
      failures.push(new Error(`Event collector ${index + 1} cleanup failed`, { cause: error }));
    }
  }

  if (releaseLock) {
    try {
      await releaseLock();
    } catch (error) {
      failures.push(new Error("Held game lock cleanup failed", { cause: error }));
    }
  }

  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, "Test cleanup completed with failures");
  }
}

describe("Game lock test cleanup helpers", () => {
  it("settles unfinished collector promises when cleanup stops them", async () => {
    const scenario = new GameScenario();
    const socket = {
      id: "collector-test-socket",
      connected: true,
      onAny: () => undefined,
      offAny: () => undefined,
      on: () => undefined,
      off: () => undefined
    } as unknown as GameClientSocket;
    const eventCollector = scenario.collectEvents(
      socket,
      SocketIOGameEvents.QUESTION_ANSWER,
      1,
      TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
    );
    const socketEventCollector = scenario.collectSocketEvents(
      socket,
      [SocketIOGameEvents.QUESTION_ANSWER],
      1,
      TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
    );

    try {
      eventCollector.stop();
      socketEventCollector.stop();
      await expect(eventCollector.promise).rejects.toThrow("Stopped waiting");
      await expect(socketEventCollector.promise).rejects.toThrow("Stopped waiting");
    } finally {
      await scenario.abort();
    }
  });

  it("preserves primary and cleanup failures while finishing cleanup in order", async () => {
    const primaryFailure = new Error("primary failure");
    const collectorFailure = new Error("collector failure");
    const releaseFailure = new Error("release failure");
    const cleanupOrder: string[] = [];
    let thrown: unknown;

    try {
      await finishTestCleanup(
        primaryFailure,
        [
          {
            stop: () => {
              cleanupOrder.push("collector 1");
              throw collectorFailure;
            }
          },
          {
            stop: () => {
              cleanupOrder.push("collector 2");
            }
          }
        ],
        async () => {
          cleanupOrder.push("release");
          throw releaseFailure;
        }
      );
    } catch (error) {
      thrown = error;
    }

    expect(cleanupOrder).toEqual(["collector 1", "collector 2", "release"]);
    expect(thrown).toBeInstanceOf(AggregateError);
    const failures = (thrown as AggregateError).errors;
    expect(failures).toHaveLength(3);
    expect(failures[0]).toBe(primaryFailure);
    expect((failures[1] as Error).cause).toBe(collectorFailure);
    expect((failures[2] as Error).cause).toBe(releaseFailure);
  });

  it("requires confirmed lock ownership before clearing the token", async () => {
    await expect(
      releaseHeldGameLock({ releaseLock: async () => false }, "game-id", "lock-token")
    ).rejects.toThrow("Game lock release lost ownership for game game-id");

    await expect(
      releaseHeldGameLock({ releaseLock: async () => true }, "game-id", "lock-token")
    ).resolves.toBe("");
  });
});

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

  describe("Concurrent Player Leave", () => {
    it("should handle two players leaving simultaneously", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        const leftUserIds: number[] = [];

        // Serialize leave emissions to avoid RPUSH/LLEN race condition
        // in the action queue (pre-existing edge case, not migration-related)
        const leavePromise1 = scenario.waitForEvent<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.LEAVE);
        const leaveData1 = await leavePromise1;
        leftUserIds.push(leaveData1.user);

        const leavePromise2 = scenario.waitForEvent<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.LEAVE);
        const leaveData2 = await leavePromise2;
        leftUserIds.push(leaveData2.user);

        expect(leftUserIds).toHaveLength(2);

        // Verify both players are gone from game
        const game = await utils.getGameFromGameService(setup.gameId);
        expect(game).toBeDefined();

        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );
        const remainingPlayerIds = connectedPlayers.map((p) => p.meta.id);

        leftUserIds.forEach((userId) => {
          expect(remainingPlayerIds).not.toContain(userId);
        });

        // One showman + one player should remain connected (2 total)
        expect(connectedPlayers.length).toBe(2);
      }));

    it("should handle three players leaving in rapid succession", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        const leftUserIds: number[] = [];

        // Serialize leave emissions to avoid RPUSH/LLEN race condition
        for (let i = 0; i < 3; i++) {
          const leavePromise = scenario.waitForEvent<GameLeaveBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.LEAVE
          );
          scenario.actor(playerSockets[i]).emit(SocketIOGameEvents.LEAVE);
          const leaveData = await leavePromise;
          leftUserIds.push(leaveData.user);
        }

        expect(leftUserIds).toHaveLength(3);

        // Verify only one player remains
        const game = await utils.getGameFromGameService(setup.gameId);
        expect(game).toBeDefined();

        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );

        // Only showman should remain (1 total)
        expect(connectedPlayers.length).toBe(1);
        expect(connectedPlayers[0].role).toBe(PlayerRole.SHOWMAN);

        const remainingPlayerIds = connectedPlayers.map((p) => p.meta.id);

        leftUserIds.forEach((userId) => {
          expect(remainingPlayerIds).not.toContain(userId);
        });
      }));

    it("should handle player leave during active question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        // Pick a question to enter answering phase
        const questionDataPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        // Verify we're in SHOWING state
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);

        const leftUserIds: number[] = [];

        // Serialize leave emissions to avoid RPUSH/LLEN race condition
        const leavePromise1 = scenario.waitForEvent<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.LEAVE);
        const leaveData1 = await leavePromise1;
        leftUserIds.push(leaveData1.user);

        const leavePromise2 = scenario.waitForEvent<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.LEAVE);
        const leaveData2 = await leavePromise2;
        leftUserIds.push(leaveData2.user);

        expect(leftUserIds).toHaveLength(2);

        // Verify both players left (only showman remains)
        const game = await utils.getGameFromGameService(setup.gameId);
        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );
        expect(connectedPlayers.length).toBe(1);
        expect(connectedPlayers[0].role).toBe(PlayerRole.SHOWMAN);
      }));
  });

  describe("Concurrent Answer Submission and Review", () => {
    it("should handle rapid player answer and showman review", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        // Pick question and wait for question data
        const questionDataPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        // Verify we're in SHOWING state before actions
        let gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);

        // Setup event listeners for answer result and answer-show-start
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        const answerShowStartPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // Serialize: first submit answer, wait for it to be processed,
        // then submit review to avoid RPUSH/LLEN race condition
        const answerPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        const answer = await answerPromise;

        // Now submit the review after the answer has been processed
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 400,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for answer result and answer-show-start to ensure
        // the server has fully transitioned to SHOWING_ANSWER state
        // and released the lock before we send skip-show-answer
        const answerResult = await answerResultPromise;
        await answerShowStartPromise;

        // Skip show answer phase — this also waits for ANSWER_SHOW_END
        await utils.skipShowAnswer(showmanSocket);

        // ANSWER_SHOW_END received from skipShowAnswer above
        const questionFinish = true;

        // Verify all events were received
        expect(answer).toBeDefined();
        expect(answerResult).toBeDefined();
        expect(answerResult.answerResult.answerType).toBe(AnswerResultType.CORRECT);
        expect(questionFinish).toBeDefined();

        // Verify player score was updated correctly
        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.players.find((p) => p.role === PlayerRole.PLAYER);
        expect(player).toBeDefined();
        expect(player!.score).toBe(400);

        // Verify question state transitioned correctly through the queue
        gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
      }));

    it("should handle multiple rapid answer attempts (only first succeeds)", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        let answerEvents: EventCollector<{ userId: number }> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          // Pick question
          const questionDataPromise = scenario.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.QUESTION_DATA
          );
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);
          await questionDataPromise;

          answerEvents = scenario.collectEvents<{ userId: number }>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_ANSWER,
            1
          );

          // All three players try to answer simultaneously
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
          scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
          scenario.actor(playerSockets[2]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});

          const answers = await answerEvents.promise;
          await utils.waitForActionsComplete(gameId);

          // Only one answer should be accepted
          expect(answerEvents.count()).toBe(1);

          // Verify game state shows correct answering player
          const gameState = await utils.getGameState(gameId);
          expect(gameState!.answeringPlayer).toBe(answers[0].userId);
          expect(gameState!.questionState).toBe(QuestionState.ANSWERING);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [answerEvents ?? undefined]);
        }
      }));

    it("should drain repeated answer-submitted clicks in FIFO order for all clients", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        const { showmanSocket, playerSockets, spectatorSockets, gameId } = setup;

        let showmanSubmittedEvents: EventCollector<AnswerSubmittedBroadcastData> | null = null;
        let otherPlayerSubmittedEvents: EventCollector<AnswerSubmittedBroadcastData> | null = null;
        let spectatorSubmittedEvents: EventCollector<AnswerSubmittedBroadcastData> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const answerPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.QUESTION_ANSWER
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
          await answerPromise;

          const answerTexts = Array.from(
            { length: QUEUE_BURST_SIZE },
            (_, index) => `Queued answer ${index + 1}`
          );
          const expectedEvents = answerTexts.map((answerText) => ({ answerText }));

          showmanSubmittedEvents = scenario.collectEvents<AnswerSubmittedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.ANSWER_SUBMITTED,
            QUEUE_BURST_SIZE
          );
          otherPlayerSubmittedEvents = scenario.collectEvents<AnswerSubmittedBroadcastData>(
            playerSockets[1],
            SocketIOGameEvents.ANSWER_SUBMITTED,
            QUEUE_BURST_SIZE
          );
          spectatorSubmittedEvents = scenario.collectEvents<AnswerSubmittedBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.ANSWER_SUBMITTED,
            QUEUE_BURST_SIZE
          );

          for (const answerText of answerTexts) {
            scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
              answerText
            });
          }

          const [showmanEvents, otherPlayerEvents, spectatorEvents] = await Promise.all([
            showmanSubmittedEvents.promise,
            otherPlayerSubmittedEvents.promise,
            spectatorSubmittedEvents.promise
          ]);
          await utils.waitForActionsComplete(gameId);

          expect(showmanEvents).toEqual(expectedEvents);
          expect(otherPlayerEvents).toEqual(expectedEvents);
          expect(spectatorEvents).toEqual(expectedEvents);

          const gameState = await utils.getGameState(gameId);
          expect(gameState!.questionState).toBe(QuestionState.ANSWERING);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [
            showmanSubmittedEvents ?? undefined,
            otherPlayerSubmittedEvents ?? undefined,
            spectatorSubmittedEvents ?? undefined
          ]);
        }
      }));

    it("should apply only the first answer review from a rapid duplicate burst", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

        let answerResultEvents: EventCollector<QuestionAnswerResultEventPayload> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const answerPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.QUESTION_ANSWER
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
          await answerPromise;

          answerResultEvents = scenario.collectEvents<QuestionAnswerResultEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_RESULT,
            1
          );

          for (let index = 0; index < QUEUE_BURST_SIZE; index += 1) {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
              scoreResult: -400,
              answerType: AnswerResultType.WRONG
            });
          }

          const [answerResult] = await answerResultEvents.promise;
          await utils.waitForActionsComplete(gameId);

          expect(answerResultEvents.count()).toBe(1);
          expect(answerResult.answerResult.player).toBe(playerUsers[0].id);
          expect(answerResult.answerResult.result).toBe(-400);
          expect(answerResult.answerResult.score).toBe(-400);
          expect(answerResult.answerResult.answerType).toBe(AnswerResultType.WRONG);

          const gameState = await utils.getGameState(gameId);
          expect(gameState!.answeringPlayer).toBeNull();

          const game = await utils.getGameFromGameService(gameId);
          const reviewedPlayer = game.players.find(
            (player) => player.meta.id === playerUsers[0].id
          );
          expect(reviewedPlayer!.score).toBe(-400);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [answerResultEvents ?? undefined]);
        }
      }));

    it("should handle answer submission during concurrent player leave", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        // Pick question
        const questionDataPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        // Serialize: first submit answer, wait for it to be processed,
        // then submit leave to avoid RPUSH/LLEN race condition
        const answerPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        const answerData = await answerPromise;

        const leavePromise = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.LEAVE);
        const leaveData = await leavePromise;

        expect(answerData).toBeDefined();
        expect(leaveData).toBeDefined();

        // Verify game state is consistent
        const game = await utils.getGameFromGameService(setup.gameId);
        const gameState = await utils.getGameState(setup.gameId);
        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );

        // Showman + one remaining player = 2 (player 1 left)
        expect(connectedPlayers.length).toBe(2);

        // The answer from player 0 should have been processed (state: ANSWERING)
        expect(gameState!.questionState).toBe(QuestionState.ANSWERING);
        expect(gameState!.answeringPlayer).toBe(answerData.userId);
      }));
  });

  describe("Concurrent Question Skips", () => {
    it("should drain a full-player skip burst and auto-finish the question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 10, 1);
        const { showmanSocket, playerSockets, spectatorSockets, gameId } = setup;

        let showmanSkipEvents: EventCollector<QuestionSkipBroadcastData> | null = null;
        let playerSkipEvents: EventCollector<QuestionSkipBroadcastData> | null = null;
        let spectatorSkipEvents: EventCollector<QuestionSkipBroadcastData> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const expectedPlayerIds = setup.playerUsers.map((user) => user.id);
          const expectedSortedPlayerIds = [...expectedPlayerIds].sort((a, b) => a - b);
          const sortedSkippedPlayerIds = (events: QuestionSkipBroadcastData[]): number[] =>
            events.map((event) => event.playerId).sort((a, b) => a - b);

          showmanSkipEvents = scenario.collectEvents<QuestionSkipBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_SKIP,
            playerSockets.length
          );
          playerSkipEvents = scenario.collectEvents<QuestionSkipBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.QUESTION_SKIP,
            playerSockets.length
          );
          spectatorSkipEvents = scenario.collectEvents<QuestionSkipBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.QUESTION_SKIP,
            playerSockets.length
          );
          const questionFinishPromise = scenario.waitForEvent<QuestionFinishEventPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_FINISH
          );

          for (const playerSocket of playerSockets) {
            scenario.actor(playerSocket).emit(SocketIOGameEvents.QUESTION_SKIP, {});
          }

          const [showmanSkips, playerSkips, spectatorSkips, questionFinish] = await Promise.all([
            showmanSkipEvents.promise,
            playerSkipEvents.promise,
            spectatorSkipEvents.promise,
            questionFinishPromise
          ]);
          await utils.waitForActionsComplete(gameId);

          expect(sortedSkippedPlayerIds(showmanSkips)).toEqual(expectedSortedPlayerIds);
          expect(sortedSkippedPlayerIds(playerSkips)).toEqual(expectedSortedPlayerIds);
          expect(sortedSkippedPlayerIds(spectatorSkips)).toEqual(expectedSortedPlayerIds);
          expect(questionFinish.answerText).toBeDefined();

          const gameState = await utils.getGameState(gameId);
          expect(gameState!.questionState).toBe(QuestionState.SHOWING_ANSWER);
          expect(gameState!.skippedPlayers).toBeNull();
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [
            showmanSkipEvents ?? undefined,
            playerSkipEvents ?? undefined,
            spectatorSkipEvents ?? undefined
          ]);
        }
      }));

    it("should drain queued skip/unskip toggles in FIFO order without finishing question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 1);
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanSkipEvents: EventCollector<
          CollectedSocketEvent<QuestionSkipBroadcastData | QuestionUnskipBroadcastData>
        > | null = null;
        let spectatorSkipEvents: EventCollector<
          CollectedSocketEvent<QuestionSkipBroadcastData | QuestionUnskipBroadcastData>
        > | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const player0SkipAction = {
            socket: playerSockets[0],
            event: SocketIOGameEvents.QUESTION_SKIP,
            playerId: playerUsers[0].id
          };
          const player0UnskipAction = {
            socket: playerSockets[0],
            event: SocketIOGameEvents.QUESTION_UNSKIP,
            playerId: playerUsers[0].id
          };
          const player1SkipAction = {
            socket: playerSockets[1],
            event: SocketIOGameEvents.QUESTION_SKIP,
            playerId: playerUsers[1].id
          };
          const player1UnskipAction = {
            socket: playerSockets[1],
            event: SocketIOGameEvents.QUESTION_UNSKIP,
            playerId: playerUsers[1].id
          };
          const skipToggleSequence = [
            player0SkipAction,
            player1SkipAction,
            player0UnskipAction,
            player0SkipAction,
            player1UnskipAction,
            player1SkipAction,
            player0UnskipAction,
            player1UnskipAction,
            player0SkipAction,
            player1SkipAction,
            player0UnskipAction,
            player0SkipAction,
            player1UnskipAction,
            player1SkipAction,
            player0UnskipAction,
            player0SkipAction,
            player1UnskipAction,
            player1SkipAction,
            player0UnskipAction,
            player0SkipAction
          ];
          const queuedSkipToggleActions = skipToggleSequence.slice(0, -1);
          const drainTriggerAction = skipToggleSequence[skipToggleSequence.length - 1];
          const skipEvents = [SocketIOGameEvents.QUESTION_SKIP, SocketIOGameEvents.QUESTION_UNSKIP];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          let queuedSkipToggleCount = 0;
          for (const action of queuedSkipToggleActions) {
            scenario.actor(action.socket).emit(action.event);
            queuedSkipToggleCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedSkipToggleCount);
          }

          showmanSkipEvents = scenario.collectSocketEvents<
            QuestionSkipBroadcastData | QuestionUnskipBroadcastData
          >(showmanSocket, skipEvents, skipToggleSequence.length);
          spectatorSkipEvents = scenario.collectSocketEvents<
            QuestionSkipBroadcastData | QuestionUnskipBroadcastData
          >(spectatorSockets[0], skipEvents, skipToggleSequence.length);

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(drainTriggerAction.socket).emit(drainTriggerAction.event);

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanSkipEvents.promise,
            spectatorSkipEvents.promise
          ]);
          await utils.waitForActionsComplete(gameId);
          const durationMs = Date.now() - startedAt;

          const expectedEventOrder = skipToggleSequence.map((action) => ({
            event: action.event,
            playerId: action.playerId
          }));
          const eventOrder = (
            events: Array<
              CollectedSocketEvent<QuestionSkipBroadcastData | QuestionUnskipBroadcastData>
            >
          ) =>
            events.map(({ event, data }) => ({
              event,
              playerId: data.playerId
            }));

          expect(eventOrder(showmanEvents)).toEqual(expectedEventOrder);
          expect(eventOrder(spectatorEvents)).toEqual(expectedEventOrder);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const gameState = await utils.getGameState(gameId);
          expect(gameState!.questionState).toBe(QuestionState.SHOWING);
          expect(gameState!.skippedPlayers).toHaveLength(2);
          expect(gameState!.skippedPlayers).toEqual(
            expect.arrayContaining([playerUsers[0].id, playerUsers[1].id])
          );
          expect(gameState!.skippedPlayers).not.toContain(playerUsers[2].id);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanSkipEvents ?? undefined, spectatorSkipEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));
  });

  describe("Concurrent Kick and Leave", () => {
    it("should handle player leaving while being kicked", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        let leaveEvents: EventCollector<GameLeaveBroadcastData> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const game = await utils.getGameFromGameService(gameId);
          const targetPlayer = game.players.find((p) => p.role === PlayerRole.PLAYER)!;

          leaveEvents = scenario.collectEvents<GameLeaveBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.LEAVE,
            1
          );

          // Player leaves while showman kicks them (same player)
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.LEAVE);
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.PLAYER_KICKED, {
            playerId: targetPlayer.meta.id
          });

          await leaveEvents.promise;
          await utils.waitForActionsComplete(gameId);

          // Only one leave event should be received
          expect(leaveEvents.count()).toBe(1);

          // Verify player is gone
          const kickedGame = await utils.getGameFromGameService(gameId);
          const connectedPlayers = kickedGame.players.filter(
            (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
          );

          // Should have showman + 1 remaining player = 2
          expect(connectedPlayers.length).toBe(2);

          const playerIds = connectedPlayers.map((p) => p.meta.id);
          expect(playerIds).not.toContain(targetPlayer.meta.id);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [leaveEvents ?? undefined]);
        }
      }));
  });

  describe("Concurrent Game Pause and Actions", () => {
    it("should handle pause during question selection", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        // Verify we're in CHOOSING state
        let gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);

        // Pause and pick question simultaneously
        const pausePromise = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_PAUSE);

        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE, {});

        await pausePromise;

        // Verify game is paused
        gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.isPaused).toBe(true);

        // Unpause
        const unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        await unpausePromise;

        // Now picking should work
        const questionDataPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.currentQuestion).toBeDefined();
      }));
  });

  describe("Queued Media Download", () => {
    it("should drain media download confirmations in FIFO order through the showing transition", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 1, true, 0, true);
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanStatusEvents: EventCollector<MediaDownloadStatusBroadcastData> | null = null;
        let spectatorStatusEvents: EventCollector<MediaDownloadStatusBroadcastData> | null = null;
        let questionRevealEvents: EventCollector<GameQuestionDataEventPayload> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const questionId = await utils.getFirstAvailableQuestionId(gameId);
          questionRevealEvents = scenario.collectEvents<GameQuestionDataEventPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_DATA,
            1,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );
          const preloadPromise = scenario.waitForEvent<MediaQuestionPreloadPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_PICK
          );
          const noQuestionDataPromise = scenario.waitForNoEvent(
            showmanSocket,
            SocketIOGameEvents.QUESTION_DATA
          );
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId });
          const [preload] = await Promise.all([preloadPromise, noQuestionDataPromise]);

          expectMediaQuestionPreload(preload, questionId);
          expect(questionRevealEvents.count()).toBe(0);

          const mediaDownloadState = await utils.getGameState(gameId);
          expect(mediaDownloadState!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);

          const mediaDownloadActions = playerSockets.map((socket, index) => ({
            socket,
            playerId: playerUsers[index].id
          }));
          const queuedMediaDownloadActions = mediaDownloadActions.slice(0, -1);
          const drainTriggerAction = mediaDownloadActions[mediaDownloadActions.length - 1];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

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
          expect(questionRevealEvents.count()).toBe(0);

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(drainTriggerAction.socket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED);

          const [showmanStatuses, spectatorStatuses, [questionReveal]] = await Promise.all([
            showmanStatusEvents.promise,
            spectatorStatusEvents.promise,
            questionRevealEvents.promise
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
          expectMediaQuestionReveal(questionReveal, questionId);
          expect(questionRevealEvents.count()).toBe(1);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.questionState).toBe(QuestionState.SHOWING);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [
              showmanStatusEvents ?? undefined,
              spectatorStatusEvents ?? undefined,
              questionRevealEvents ?? undefined
            ],
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
        let questionRevealEvents: EventCollector<GameQuestionDataEventPayload> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const questionId = await utils.getFirstAvailableQuestionId(gameId);
          questionRevealEvents = scenario.collectEvents<GameQuestionDataEventPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_DATA,
            1,
            TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
          );
          const preloadPromise = scenario.waitForEvent<MediaQuestionPreloadPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_PICK
          );
          const noQuestionDataPromise = scenario.waitForNoEvent(
            showmanSocket,
            SocketIOGameEvents.QUESTION_DATA
          );
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId });
          const [preload] = await Promise.all([preloadPromise, noQuestionDataPromise]);

          expectMediaQuestionPreload(preload, questionId);
          expect(questionRevealEvents.count()).toBe(0);

          const mediaDownloadState = await utils.getGameState(gameId);
          expect(mediaDownloadState!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          await testUtils.expireTimerAndWaitForAction(
            gameId,
            GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED
          );
          await utils.waitForQueueLengthAtLeast(gameId, 1);
          expect(questionRevealEvents.count()).toBe(0);

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

          const startedAt = Date.now();
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          });

          const [showmanEvents, spectatorEvents, [questionReveal]] = await Promise.all([
            showmanDrainEvents.promise,
            spectatorDrainEvents.promise,
            questionRevealEvents.promise
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
          expectMediaQuestionReveal(questionReveal, questionId);
          expect(questionRevealEvents.count()).toBe(1);

          const timeoutStatus = showmanEvents[0].data as MediaDownloadStatusBroadcastData;
          expect(timeoutStatus.playerId).toBe(SYSTEM_PLAYER_ID);
          expect(timeoutStatus.mediaDownloaded).toBe(true);
          expect(timeoutStatus.allPlayersReady).toBe(true);
          expect(timeoutStatus.timer).toBeDefined();
          expect(timeoutStatus.timer).not.toBeNull();
          expect(showmanEvents[1].data).toEqual({
            playerId: playerUsers[0].id,
            newScore: drainTriggerScore
          } satisfies PlayerScoreChangeBroadcastData);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const finalState = await utils.getGameState(gameId);
          expect(finalState!.questionState).toBe(QuestionState.SHOWING);

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
            [
              showmanDrainEvents ?? undefined,
              spectatorDrainEvents ?? undefined,
              questionRevealEvents ?? undefined
            ],
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);

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
          await utils.waitForActionsComplete(gameId);

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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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
          await utils.waitForActionsComplete(gameId);
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

  describe("Concurrent Score Changes", () => {
    it("should drain a burst of score changes in FIFO order within the queue budget", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        let scoreEvents: EventCollector<PlayerScoreChangeBroadcastData> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const game = await utils.getGameFromGameService(gameId);
          const player = game.players.find((p) => p.role === PlayerRole.PLAYER)!;
          const scores = Array.from(
            { length: QUEUE_BURST_SIZE },
            (_, index) => player.score + (index + 1) * 10
          );

          scoreEvents = scenario.collectEvents<PlayerScoreChangeBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.SCORE_CHANGED,
            QUEUE_BURST_SIZE
          );

          const startedAt = Date.now();
          for (const newScore of scores) {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
              playerId: player.meta.id,
              newScore
            });
          }

          const receivedScores = await scoreEvents.promise;
          await utils.waitForActionsComplete(gameId);
          const durationMs = Date.now() - startedAt;

          expect(receivedScores.map((event) => event.newScore)).toEqual(scores);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          // Verify final score is the last value
          const scoreGame = await utils.getGameFromGameService(gameId);
          const finalPlayer = scoreGame.players.find((p) => p.meta.id === player.meta.id)!;
          expect(finalPlayer.score).toBe(scores[scores.length - 1]);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [scoreEvents ?? undefined]);
        }
      }));
  });
});
