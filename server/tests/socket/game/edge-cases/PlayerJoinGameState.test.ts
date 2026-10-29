import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { container } from "tsyringe";
import { GameService } from "application/services/game/GameService";

import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { GameActionType } from "domain/enums/GameActionType";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  FinalAnswerSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData
} from "domain/types/socket/events/FinalRoundEventData";
import { GameJoinOutputData } from "domain/types/socket/events/SocketEventInterfaces";
import { type PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { TestUtils } from "tests/utils/TestUtils";

describe("Player Join Game State Tests", () => {
  let suite: SocketGameTestSuite;
  let utils: TestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    utils = suite.testUtils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Player joining during Final Round phases", () => {
    it("finishes a paused zero-duration final timeline when all players leave", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId, showmanSocket, playerSockets, playerUsers } =
          await utils.setupFinalRoundGame({ playersCount: 2, playerScores: [1500, 1200] });
        const bidding = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await bidding;
        const state = await utils.getGameState(gameId);
        const theme = state.currentRound!.themes.find(
          (t) => !t.questions?.some((q) => q.isPlayed)
        )!;
        const id = theme.questions![0].id;
        const store = container.resolve(PackageStore);
        const stored = await store.getQuestionWithTheme(gameId, id);
        const question = {
          ...stored!.question,
          text: "",
          textOrder: null,
          textItems: [],
          questionFiles: [
            {
              order: 0,
              displayTime: 1000,
              placement: "background",
              waitForFinish: false,
              file: { md5: "sound", type: PackageFileType.AUDIO }
            }
          ]
        };
        await container.resolve(RedisRepository).hset(store.getPackageKey(gameId), {
          [`q:${id}`]: JSON.stringify(question)
        });
        const bid = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_BID_SUBMIT);
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await bid;
        const prepared = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        const data = await prepared;
        expect(data.questionData.contentPlan?.totalMs).toBe(0);
        const phase = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_PHASE_COMPLETE);
        for (const socket of playerSockets) {
          scenario
            .actor(socket)
            .emit(SocketIOGameEvents.MEDIA_DOWNLOADED, {
              mediaPreparationId: data.questionData.mediaPreparationId
            });
        }
        await phase;
        const paused = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.GAME_PAUSE);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE);
        await paused;
        for (const socket of playerSockets) {
          const leave = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
          scenario.actor(socket).emit(SocketIOGameEvents.LEAVE);
          await leave;
        }
        const resumed = scenario.waitForEvent<{ timer: { durationMs: number } }>(
          showmanSocket,
          SocketIOGameEvents.GAME_UNPAUSE
        );
        const completed = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_SUBMIT_END);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE);
        expect((await resumed).timer.durationMs).toBe(1);
        await completed;
      });
    });

    it("preserves the media readiness timeout after a paused auto-loss player rejoins", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId, showmanSocket, playerSockets, playerUsers } =
          await utils.setupFinalRoundGame({ playersCount: 2, playerScores: [1500, 1200] });
        const bidding = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await bidding;
        const state = await utils.getGameState(gameId);
        const theme = state.currentRound!.themes.find(
          (t) => !t.questions?.some((q) => q.isPlayed)
        )!;
        const id = theme.questions![0].id;
        const store = container.resolve(PackageStore);
        const stored = await store.getQuestionWithTheme(gameId, id);
        const question = {
          ...stored!.question,
          text: "",
          textOrder: null,
          textItems: [],
          questionFiles: [
            { order: 0, displayTime: 1000, file: { md5: "image", type: PackageFileType.IMAGE } }
          ]
        };
        await container.resolve(RedisRepository).hset(store.getPackageKey(gameId), {
          [`q:${id}`]: JSON.stringify(question)
        });
        const bid = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_BID_SUBMIT);
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await bid;
        const prepared = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        const data = await prepared;
        const paused = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.GAME_PAUSE);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE);
        await paused;
        for (const socket of playerSockets) await utils.disconnectAndCleanup(socket);
        const { socket } = await utils.createSocketForExistingUser(playerUsers[0].id);
        const snapshot = scenario.waitForEvent<GameJoinOutputData>(
          socket,
          SocketIOGameEvents.GAME_DATA
        );
        scenario.actor(socket).emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.PLAYER });
        const joined = await snapshot;
        expect(joined.gameState.finalRoundData?.answers).toHaveLength(2);
        const resumed = scenario.waitForEvent<{ timer: { durationMs: number } }>(
          showmanSocket,
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE);
        expect((await resumed).timer.durationMs).toBe(30000);
        expect((await utils.getGameState(gameId)).questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );
        const phase = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        scenario.actor(socket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED, {
          mediaPreparationId: data.questionData.mediaPreparationId
        });
        expect((await phase).timer!.durationMs).toBe(data.questionData.contentPlan!.totalMs);
      });
    });

    it.each([false, true])(
      "finishes final media after all bidders leave (paused: %s)",
      async (pause) => {
        await suite.scenario(async (scenario) => {
          const { gameId, showmanSocket, playerSockets, playerUsers } =
            await utils.setupFinalRoundGame({ playersCount: 2, playerScores: [1500, 1200] });
          const bidding = scenario.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
          await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
          await bidding;
          const state = await utils.getGameState(gameId);
          const theme = state.currentRound!.themes.find(
            (t) => !t.questions?.some((q) => q.isPlayed)
          )!;
          const id = theme.questions![0].id;
          const store = container.resolve(PackageStore);
          const stored = await store.getQuestionWithTheme(gameId, id);
          const question = {
            ...stored!.question,
            text: "",
            textOrder: null,
            textItems: [],
            questionFiles: [
              { order: 0, displayTime: 1000, file: { md5: "image", type: PackageFileType.IMAGE } }
            ]
          };
          await container
            .resolve(RedisRepository)
            .hset(store.getPackageKey(gameId), { [`q:${id}`]: JSON.stringify(question) });
          const firstBid = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_BID_SUBMIT
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
          await firstBid;
          const prepared = scenario.waitForEvent<FinalQuestionEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_QUESTION_DATA
          );
          scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
          const plan = (await prepared).questionData.contentPlan!;
          if (pause) {
            const paused = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.GAME_PAUSE);
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE);
            await paused;
          }
          const phase = scenario.waitForEvent<FinalPhaseCompleteEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
          for (const socket of playerSockets) {
            const leave = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
            scenario.actor(socket).emit(SocketIOGameEvents.LEAVE);
            await leave;
          }
          if (pause) {
            expect((await utils.getGameState(gameId)).questionState).toBe(
              QuestionState.MEDIA_DOWNLOADING
            );
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE);
          }
          expect((await phase).timer!.durationMs).toBe(plan.totalMs);
        });
      }
    );

    it.each(["leave", "role", "timeout", "rejoin"])(
      "finishes final media preparation on %s",
      async (mode) => {
        await suite.scenario(async (scenario) => {
          const { gameId, showmanSocket, playerSockets, playerUsers } =
            await utils.setupFinalRoundGame({ playersCount: 2, playerScores: [1500, 1200] });
          const bidding = scenario.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
          await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
          await bidding;
          const state = await utils.getGameState(gameId);
          const theme = state.currentRound!.themes.find(
            (t) => !t.questions?.some((q) => q.isPlayed)
          )!;
          const id = theme.questions![0].id;
          const store = container.resolve(PackageStore);
          const stored = await store.getQuestionWithTheme(gameId, id);
          const question = {
            ...stored!.question,
            textItems: [],
            questionFiles: [
              { order: 1, displayTime: 1000, file: { md5: "image", type: PackageFileType.IMAGE } }
            ]
          };
          await container
            .resolve(RedisRepository)
            .hset(store.getPackageKey(gameId), { [`q:${id}`]: JSON.stringify(question) });
          const firstBid = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_BID_SUBMIT
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
          await firstBid;
          const prepared = scenario.waitForEvent<FinalQuestionEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_QUESTION_DATA
          );
          scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
          const preparationId = (await prepared).questionData.mediaPreparationId!;
          const firstReady = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
          );
          scenario
            .actor(playerSockets[0])
            .emit(SocketIOGameEvents.MEDIA_DOWNLOADED, { mediaPreparationId: preparationId });
          await firstReady;
          await scenario.assert.waitForActionsComplete({ gameId });
          const ready = scenario.assert.inbound<[{ allPlayersReady: boolean; timedOut?: boolean }]>(
            {
              actor: scenario.actor(showmanSocket),
              event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
              timeoutMs: 5000,
              predicate: ({ args }) => args[0].allPlayersReady
            }
          );
          if (mode === "leave") scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.LEAVE);
          if (mode === "role")
            scenario
              .actor(playerSockets[1])
              .emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, { newRole: PlayerRole.SPECTATOR });
          if (mode === "timeout") {
            const game = await utils.getGameFromGameService(gameId);
            await container.resolve(GameService).saveTimer(game.gameState.timer!, gameId, 30);
          }
          if (mode === "rejoin") {
            await utils.disconnectAndCleanup(playerSockets[0]);
            const { socket } = await utils.createSocketForExistingUser(playerUsers[0].id);
            const snapshot = scenario.waitForEvent<GameJoinOutputData>(
              socket,
              SocketIOGameEvents.GAME_DATA
            );
            scenario
              .actor(socket)
              .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.PLAYER });
            const joined = await snapshot;
            expect(
              joined.players.find((p) => p.meta.id === playerUsers[0].id)?.mediaDownloaded
            ).toBe(false);
            const secondReady = scenario.waitForEvent(
              showmanSocket,
              SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
            );
            scenario
              .actor(playerSockets[1])
              .emit(SocketIOGameEvents.MEDIA_DOWNLOADED, { mediaPreparationId: preparationId });
            await secondReady;
            expect((await utils.getGameState(gameId)).questionState).toBe(
              QuestionState.MEDIA_DOWNLOADING
            );
            scenario
              .actor(socket)
              .emit(SocketIOGameEvents.MEDIA_DOWNLOADED, { mediaPreparationId: preparationId });
          }
          const event = await ready;
          expect(event.args[0].timedOut ?? false).toBe(mode === "timeout");
          await scenario.assert.waitForActionsComplete({ gameId });
          const after = await utils.getGameState(gameId);
          expect(after.questionState).toBe(QuestionState.ANSWERING);
          expect(after.finalRoundData?.questionData?.mediaPreparationId).toBeUndefined();
          expect(after.finalRoundData?.questionData?.mediaPreparationTimedOut ?? false).toBe(
            mode === "timeout"
          );
          if (mode === "leave" || mode === "role") {
            const departed = (await utils.getGameFromGameService(gameId)).players.find(
              (p) => p.meta.id === playerUsers[1].id
            )!;
            expect(departed.score).toBe(600);
            expect(after.finalRoundData?.answers).toContainEqual(
              expect.objectContaining({
                playerId: playerUsers[1].id,
                autoLoss: true,
                isCorrect: false
              })
            );
          }
          scenario
            .actor(mode === "rejoin" ? playerSockets[1] : playerSockets[0])
            .emit(SocketIOGameEvents.MEDIA_DOWNLOADED, { mediaPreparationId: preparationId });
          await scenario.assert.waitForActionsComplete({ gameId });
          expect((await utils.getGameState(gameId)).questionState).toBe(QuestionState.ANSWERING);
        });
      }
    );

    it.each([false, true])(
      "finishes auto-losses at the content boundary (paused: %s)",
      async (pause) => {
        await suite.scenario(async (scenario) => {
          const { gameId, showmanSocket, playerSockets, playerUsers } =
            await utils.setupFinalRoundGame({ playersCount: 2, playerScores: [1500, 1200] });
          const bidding = scenario.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
          await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
          await bidding;
          const state = await utils.getGameState(gameId);
          const theme = state.currentRound!.themes.find(
            (t) => !t.questions?.some((q) => q.isPlayed)
          )!;
          const id = theme.questions![0].id;
          const store = container.resolve(PackageStore);
          const stored = await store.getQuestionWithTheme(gameId, id);
          const question = {
            ...stored!.question,
            text: "",
            textOrder: null,
            questionFiles: [],
            textItems: [{ order: 0, text: "Clue" }]
          };
          await container
            .resolve(RedisRepository)
            .hset(store.getPackageKey(gameId), { [`q:${id}`]: JSON.stringify(question) });
          const firstBid = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.FINAL_BID_SUBMIT
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
          await firstBid;
          const finalQuestion = scenario.waitForEvent<FinalQuestionEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_QUESTION_DATA
          );
          scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
          const plan = (await finalQuestion).questionData.contentPlan!;
          if (pause) {
            const paused = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.GAME_PAUSE);
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE);
            await paused;
          }
          for (const socket of playerSockets) {
            const leave = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
            scenario.actor(socket).emit(SocketIOGameEvents.LEAVE);
            await leave;
          }
          await scenario.assert.waitForActionsComplete({ gameId });
          const pausedState = await utils.getGameState(gameId);
          expect(pausedState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
          const completed = scenario.assert.inbound({
            actor: scenario.actor(showmanSocket),
            event: SocketIOGameEvents.FINAL_SUBMIT_END,
            timeoutMs: 5000
          });
          if (pause) {
            const resumed = scenario.waitForEvent<{ timer: { durationMs: number } }>(
              showmanSocket,
              SocketIOGameEvents.GAME_UNPAUSE
            );
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE);
            expect((await resumed).timer.durationMs).toBe(plan.totalMs);
          } else {
            expect(pausedState.timer?.durationMs).toBe(plan.totalMs);
          }
          await completed;
        });
      }
    );

    it("synchronizes sequenced final content, pause and rejoin while rejecting early answers", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId, showmanSocket, playerSockets, playerUsers } =
          await utils.setupFinalRoundGame({ playersCount: 2, playerScores: [1500, 1200] });
        const bidding = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await bidding;
        const state = await utils.getGameState(gameId);
        const finalTheme = state.currentRound!.themes.find(
          (theme) => !theme.questions?.some((question) => question.isPlayed)
        )!;
        const id = finalTheme.questions![0].id;
        const store = container.resolve(PackageStore);
        const stored = await store.getQuestionWithTheme(gameId, id);
        const question: PackageQuestionDTO = {
          ...stored!.question,
          text: "Main",
          textOrder: 0,
          textItems: [{ order: 2, text: "Clue" }],
          answerType: AnswerType.POINT,
          answerPoint: { x: 0.7, y: 0.3, imageAspectRatio: 2 },
          pointImageOrder: 3,
          questionFiles: [1, 3].map((order) => ({
            order,
            displayTime: 1000,
            file: {
              md5: `image-${order}`,
              type: PackageFileType.IMAGE,
              link: `https://example.test/${order}.png`
            }
          }))
        };
        await container.resolve(RedisRepository).hset(store.getPackageKey(gameId), {
          [`q:${id}`]: JSON.stringify(question)
        });
        const firstBid = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_BID_SUBMIT);
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await firstBid;
        const publicQuestion = scenario.waitForEvent<FinalQuestionEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        const hostQuestion = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        const [visible, host] = await Promise.all([publicQuestion, hostQuestion]);
        const plan = visible.questionData.contentPlan!;
        const preparationId = visible.questionData.mediaPreparationId!;
        expect(preparationId).toBeDefined();
        expect(visible.timer?.durationMs).toBe(30000);
        expect(host.timer?.durationMs).toBe(30000);
        expect(plan.steps.map((step) => step.items[0].order)).toEqual([0, 1, 2, 3]);
        expect(visible.questionData.question).toMatchObject({
          pointImageOrder: 3,
          textItems: question.textItems
        });
        expect(visible.questionData.question).not.toHaveProperty("answerPoint");
        expect(host.questionData.question).toMatchObject({ answerPoint: question.answerPoint });
        const game = await utils.getGameFromGameService(gameId);
        expect(game.gameState.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
        const rejected = scenario.waitForEvent(playerSockets[0], SocketIOEvents.ERROR);
        scenario
          .actor(playerSockets[0])
          .emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, { answerText: "0.2,0.4" });
        await rejected;
        expect((await utils.getGameState(gameId)).finalRoundData?.answers).toHaveLength(0);
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.MEDIA_DOWNLOADED, {
          mediaPreparationId: "00000000-0000-4000-8000-000000000000"
        });
        await scenario.assert.waitForActionsComplete({ gameId });
        expect(
          (await utils.getGameFromGameService(gameId)).players.find(
            (p) => p.meta.id === playerUsers[0].id
          )?.mediaDownloaded
        ).toBe(false);
        const paused = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_PAUSE);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE);
        await paused;
        const { socket: spectator } = await utils.createGameClient();
        const snapshot = scenario.waitForEvent<GameJoinOutputData>(
          spectator,
          SocketIOGameEvents.GAME_DATA
        );
        scenario
          .actor(spectator)
          .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
        const joined = await snapshot;
        expect(joined.gameState.isPaused).toBe(true);
        expect(joined.gameState.timer?.elapsedMs).toBeGreaterThanOrEqual(0);
        expect(joined.gameState.timer?.durationMs).toBe(30000);
        expect(joined.gameState.finalRoundData?.questionData?.mediaPreparationId).toBe(
          preparationId
        );
        expect((await utils.getGameState(gameId)).timer).toBeNull();
        expect(joined.gameState.finalRoundData?.questionData?.contentPlan).toEqual(plan);
        expect(joined.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerPoint"
        );
        for (const socket of playerSockets) {
          const status = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
          );
          scenario
            .actor(socket)
            .emit(SocketIOGameEvents.MEDIA_DOWNLOADED, { mediaPreparationId: preparationId });
          await status;
        }
        expect((await utils.getGameState(gameId)).questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );
        const resumed = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_UNPAUSE);
        const phase = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE);
        await resumed;
        expect((await phase).timer!.durationMs).toBe(
          game.settings.timers.finalAnswerMs + plan.totalMs
        );
        await scenario.assert.waitForActionsComplete({ gameId });
        const advanced = await utils.getGameFromGameService(gameId);
        advanced.gameState.timer!.elapsedMs = plan.totalMs;
        advanced.gameState.timer!.resumedAt = new Date();
        await utils.updateGame(advanced);
        const answer = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_ANSWER_SUBMIT);
        scenario
          .actor(playerSockets[0])
          .emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, { answerText: "0.2,0.4" });
        await answer;
        const review = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_SUBMIT_END);
        scenario
          .actor(playerSockets[1])
          .emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, { answerText: "0.8,0.6" });
        await review;
      });
    });

    it("restores the private final point to the rejoining showman only after the snapshot", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId, showmanSocket, showmanUser, playerSockets, playerUsers, spectatorSockets } =
          await utils.setupFinalRoundGame({ playersCount: 2, playerScores: [1500, 1200] });
        const phase = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phase;

        const state = await utils.getGameState(gameId);
        const finalTheme = state.currentRound!.themes.find(
          (theme) => !theme.questions?.some((question) => question.isPlayed)
        )!;
        const questionId = finalTheme.questions![0].id;
        const store = container.resolve(PackageStore);
        const stored = await store.getQuestionWithTheme(gameId, questionId);
        expect(stored).not.toBeNull();
        const question: PackageQuestionDTO = {
          ...stored!.question,
          answerType: AnswerType.POINT,
          answerPoint: { x: 0.7, y: 0.3, imageAspectRatio: 2 },
          answerDeviation: 0.1,
          questionFiles: [
            {
              order: 0,
              displayTime: null,
              file: {
                md5: "point-image",
                type: PackageFileType.IMAGE,
                link: "https://example.test/point.png"
              }
            }
          ]
        };
        await container.resolve(RedisRepository).hset(store.getPackageKey(gameId), {
          [`q:${questionId}`]: JSON.stringify(question)
        });

        const firstBid = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_BID_SUBMIT);
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await firstBid;
        const finalQuestion = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        expect((await finalQuestion).questionData.question).toMatchObject({
          answerPoint: question.answerPoint
        });
        const firstAnswer = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        scenario
          .actor(playerSockets[0])
          .emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, { answerText: "0.2,0.4" });
        await firstAnswer;
        const review = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_SUBMIT_END);
        const accepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.FINAL_ANSWER_SUBMIT,
            socketId: playerSockets[1].id
          })
          .waitForCount(1);
        scenario
          .actor(playerSockets[1])
          .emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, { answerText: "0.8,0.6" });
        await Promise.all([review, accepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        const reviewingState = await utils.getGameState(gameId);
        expect(reviewingState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);
        expect(reviewingState.currentQuestion?.id).toBeUndefined();

        await utils.disconnectAndCleanup(showmanSocket);
        const { socket: rejoinedHost } = await utils.createSocketForExistingUser(showmanUser.id);
        const hostJoinMark = scenario.mark();
        const hostJoinAccepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.JOIN,
            socketId: rejoinedHost.id
          })
          .waitForCount(1);
        const hostEvents = scenario.collectSocketEvents<
          GameJoinOutputData | FinalQuestionEventData
        >(rejoinedHost, [SocketIOGameEvents.GAME_DATA, SocketIOGameEvents.FINAL_QUESTION_DATA], 2);
        scenario
          .actor(rejoinedHost)
          .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SHOWMAN });
        const [events] = await Promise.all([hostEvents.promise, hostJoinAccepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        await scenario.assert.noInboundMany({
          actors: [...playerSockets, ...spectatorSockets].map((socket) => scenario.actor(socket)),
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          afterSequence: hostJoinMark,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
        });
        expect(events.map((entry) => entry.event)).toEqual([
          SocketIOGameEvents.GAME_DATA,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        ]);
        const snapshot = events[0].data as GameJoinOutputData;
        const restored = events[1].data as FinalQuestionEventData;
        expect(snapshot.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerPoint"
        );
        expect(snapshot.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerDeviation"
        );
        expect(restored.questionData.question).toMatchObject({
          id: questionId,
          answerPoint: question.answerPoint,
          answerDeviation: 0.1,
          questionFiles: question.questionFiles
        });

        await utils.disconnectAndCleanup(playerSockets[0]);
        const { socket: rejoinedPlayer } = await utils.createSocketForExistingUser(
          playerUsers[0].id
        );
        const playerActor = scenario.actor(rejoinedPlayer);
        const playerMark = scenario.mark();
        const playerJoinAccepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.JOIN,
            socketId: rejoinedPlayer.id
          })
          .waitForCount(1);
        const playerSnapshot = scenario.waitForEvent<GameJoinOutputData>(
          rejoinedPlayer,
          SocketIOGameEvents.GAME_DATA
        );
        scenario
          .actor(rejoinedPlayer)
          .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.PLAYER });
        const [playerData] = await Promise.all([playerSnapshot, playerJoinAccepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        expect(playerData.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerPoint"
        );
        expect(playerData.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerDeviation"
        );
        await scenario.assert.noInbound({
          actor: playerActor,
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          afterSequence: playerMark,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
        });

        const { socket: spectator } = await utils.createGameClient();
        const spectatorActor = scenario.actor(spectator);
        const spectatorMark = scenario.mark();
        const spectatorJoinAccepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.JOIN,
            socketId: spectator.id
          })
          .waitForCount(1);
        const spectatorSnapshot = scenario.waitForEvent<GameJoinOutputData>(
          spectator,
          SocketIOGameEvents.GAME_DATA
        );
        scenario
          .actor(spectator)
          .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
        const [spectatorData] = await Promise.all([spectatorSnapshot, spectatorJoinAccepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        expect(spectatorData.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerPoint"
        );
        expect(spectatorData.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerDeviation"
        );
        await scenario.assert.noInbound({
          actor: spectatorActor,
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          afterSequence: spectatorMark,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
        });

        await utils.disconnectAndCleanup(rejoinedHost);
        const { socket: missingHost } = await utils.createSocketForExistingUser(showmanUser.id);
        const missingResource = jest
          .spyOn(store, "getQuestionWithTheme")
          .mockResolvedValueOnce(null);
        try {
          const missingActor = scenario.actor(missingHost);
          const missingMark = scenario.mark();
          const missingJoinAccepted = scenario
            .createAcceptedActionProbe({
              gameId,
              actionType: GameActionType.JOIN,
              socketId: missingHost.id
            })
            .waitForCount(1);
          const snapshotWithoutResource = scenario.waitForEvent(
            missingHost,
            SocketIOGameEvents.GAME_DATA
          );
          scenario
            .actor(missingHost)
            .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SHOWMAN });
          await Promise.all([snapshotWithoutResource, missingJoinAccepted]);
          await scenario.assert.waitForActionsComplete({ gameId });
          await scenario.assert.noInbound({
            actor: missingActor,
            event: SocketIOGameEvents.FINAL_QUESTION_DATA,
            afterSequence: missingMark,
            durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
          });
          expect(missingResource).toHaveBeenCalledWith(gameId, questionId);
        } finally {
          missingResource.mockRestore();
        }
      });
    });

    it("should receive questionData when joining during FINAL_ANSWERING phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that a player joining during the final round answering phase
         * receives the question data in their game state.
         *
         * Flow:
         * 1. Set up game and progress to final round answering phase
         * 2. New player joins the game
         * 3. Verify the joined player receives questionData in gameState.finalRoundData
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        // Complete theme elimination
        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        // Submit bids to transition to answering phase
        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800
        });
        await firstBidPromise;

        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600
        });
        const questionDataEvent = await questionDataPromise;

        // Verify we're in answering phase
        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

        // Verify questionData is stored in game state
        expect(gameState.finalRoundData?.questionData).toBeDefined();
        expect(gameState.finalRoundData?.questionData?.themeId).toBe(
          questionDataEvent.questionData.themeId
        );
        expect(gameState.finalRoundData?.questionData?.themeName).toBe(
          questionDataEvent.questionData.themeName
        );

        // Now create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        // Join as spectator (since game is in progress, can't join as player)
        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player receives questionData
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeDefined();
        expect(joinedGameData.gameState.finalRoundData?.questionData?.themeId).toBe(
          questionDataEvent.questionData.themeId
        );
        expect(joinedGameData.gameState.finalRoundData?.questionData?.themeName).toBe(
          questionDataEvent.questionData.themeName
        );
        expect(joinedGameData.gameState.finalRoundData?.questionData?.question).toBeDefined();
      });
    });

    it("should hide submitted final answer text when a spectator joins during FINAL_ANSWERING phase", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800
        });
        await firstBidPromise;

        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600
        });
        await questionDataPromise;

        const submittedAnswer = "Private answer that must stay hidden";
        const submitPromise = scenario.waitForEvent<FinalAnswerSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: submittedAnswer
        });

        const submitBroadcast = await submitPromise;
        expect(submitBroadcast).toEqual({ playerId: playerUsers[0].id });
        expect(submitBroadcast).not.toHaveProperty("answerText");

        const persistedState = await utils.getGameState(gameId);
        expect(persistedState.finalRoundData?.answers).toHaveLength(1);
        expect(persistedState.finalRoundData?.answers[0].answer).toBe(submittedAnswer);

        const { socket: lateSpectatorSocket } = await utils.createGameClient();

        const joinedGameData = await utils.joinGameWithData(
          lateSpectatorSocket,
          gameId,
          PlayerRole.SPECTATOR
        );
        const visibleAnswers = joinedGameData.gameState.finalRoundData?.answers;

        expect(joinedGameData.gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(visibleAnswers).toHaveLength(1);
        expect(visibleAnswers?.[0].playerId).toBe(playerUsers[0].id);
        expect(visibleAnswers?.[0].answer).toBe("");
        expect(JSON.stringify(joinedGameData.gameState)).not.toContain(submittedAnswer);
      });
    });

    it("should receive questionData when joining during FINAL_REVIEWING phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that questionData persists and is accessible when joining
         * during the reviewing phase.
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        // Complete theme elimination
        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        // Submit bids to transition to answering phase
        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800
        });
        await firstBidPromise;

        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600
        });
        const questionDataEvent = await questionDataPromise;

        // Verify we're in answering phase
        let gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);

        // Submit answers to transition to reviewing phase
        const submitEndPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_SUBMIT_END
        );

        const firstAnswerPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Player 1 answer"
        });
        await firstAnswerPromise;

        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Player 2 answer"
        });
        await submitEndPromise;

        // Verify we're in reviewing phase
        gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.REVIEWING);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

        // questionData should still be present
        expect(gameState.finalRoundData?.questionData).toBeDefined();

        // Now create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        // Join as spectator
        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player receives questionData
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.REVIEWING);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeDefined();
        expect(joinedGameData.gameState.finalRoundData?.questionData?.themeId).toBe(
          questionDataEvent.questionData.themeId
        );
      });
    });

    it("should NOT have questionData when joining during FINAL_BIDDING phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that questionData is NOT present when joining during bidding phase
         * (before the question is revealed).
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { playerSockets, gameId, playerUsers } = setupResult;

        // Complete theme elimination to transition to bidding phase
        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        // Verify we're in bidding phase
        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.BIDDING);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);

        // questionData should NOT be present yet
        expect(gameState.finalRoundData?.questionData).toBeUndefined();

        // Create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player does NOT receive questionData (it's not revealed yet)
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.BIDDING);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeUndefined();
        expect(
          joinedGameData.gameState.currentRound?.themes.every(
            (theme) => theme.questions.length === 0
          )
        ).toBe(true);

        const stateAfterJoin = await utils.getGameState(gameId);
        expect(
          stateAfterJoin.currentRound?.themes.some((theme) => (theme.questions ?? []).length > 0)
        ).toBe(true);
      });
    });

    it("should NOT have questionData when joining during FINAL_THEME_ELIMINATION phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that questionData is NOT present when joining during theme elimination phase.
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { gameId } = setupResult;

        // Verify we're in theme elimination phase
        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.THEME_ELIMINATION);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.THEME_ELIMINATION);

        // questionData should NOT be present
        expect(gameState.finalRoundData?.questionData).toBeUndefined();
        expect(
          gameState.currentRound?.themes.some((theme) => (theme.questions ?? []).length > 0)
        ).toBe(true);

        // Create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player does NOT receive questionData
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.THEME_ELIMINATION);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(
          FinalRoundPhase.THEME_ELIMINATION
        );
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeUndefined();
        expect(
          joinedGameData.gameState.currentRound?.themes.every(
            (theme) => theme.questions.length === 0
          )
        ).toBe(true);

        const stateAfterJoin = await utils.getGameState(gameId);
        expect(
          stateAfterJoin.currentRound?.themes.some((theme) => (theme.questions ?? []).length > 0)
        ).toBe(true);
      });
    });
  });

  describe("Player joining during paused game states", () => {
    it("should receive correct state when joining during paused answering phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that a player joining during a paused game receives the correct state,
         * including the pause status and questionData if in answering phase.
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        // Complete theme elimination
        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        // Submit bids to transition to answering phase
        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800
        });
        await firstBidPromise;

        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600
        });
        const questionDataEvent = await questionDataPromise;

        // Verify we're in answering phase
        let gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(gameState.isPaused).toBe(false);

        // Pause the game
        const pausePromise = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_PAUSE);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE);
        await pausePromise;

        // Verify game is paused
        gameState = await utils.getGameState(gameId);
        expect(gameState.isPaused).toBe(true);

        // Create a new player and have them join
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player sees the paused state
        expect(joinedGameData.gameState.isPaused).toBe(true);
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeDefined();
        expect(joinedGameData.gameState.finalRoundData?.questionData?.themeId).toBe(
          questionDataEvent.questionData.themeId
        );
      });
    });
  });
});
