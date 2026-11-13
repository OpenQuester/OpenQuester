import { AddQuestionAuthoredContent_0_34_3_1794418572614 } from "infrastructure/database/migrations/0.34.3_AddQuestionAuthoredContent_1794418572614";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { GameActionType } from "domain/enums/GameActionType";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import type { GameScenario } from "tests/e2e/scenario/GameScenario";
import type { GameClientSocket } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { timerKey } from "domain/constants/redisKeys";
import { RedisConfig } from "shared/config/RedisConfig";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import type { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import type { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import type { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import type { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import type {
  GamePauseBroadcastData,
  GameUnpauseBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TEST_MEDIA_FILE_MD5 } from "tests/utils/PackageUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

async function rejectPrematureAnswer(
  scenario: GameScenario,
  gameId: string,
  sender: GameClientSocket,
  recipients: GameClientSocket[],
  event: SocketIOGameEvents,
  actionType: GameActionType,
  answer: { answerText: string; choiceOrder?: number } = { answerText: "Premature" }
) {
  const mark = scenario.mark();
  const error = scenario.waitForEvent(sender, SocketIOEvents.ERROR);
  const accepted = scenario.createAcceptedActionProbe({ gameId, actionType }).waitForCount(1);
  scenario.actor(sender).emit(event, answer);
  await Promise.all([error, accepted]);
  await scenario.assert.waitForActionsComplete({ gameId });
  await scenario.assert.noInboundMany({
    actors: recipients.map((socket) => scenario.actor(socket)),
    event,
    afterSequence: mark,
    durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
  });
}

describe("Authored content transport", () => {
  let suite: SocketGameTestSuite;
  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
  });
  afterEach(async () => {
    if (suite) suite.utils.packageTransform = null;
    await suite?.reset();
  });
  afterAll(async () => {
    await suite?.stop();
  });

  it.each(["leave", "paused leave", "disconnect"] as const)(
    "handles the secret recipient's %s before media ACK",
    async (mode) => {
      await suite.scenario(async (scenario) => {
        const utils = suite.utils;
        utils.packageTransform = (pkg) => {
          const questions = pkg.rounds[0].themes.flatMap((theme) => theme.questions);
          const simple = questions.find((q) => q.type === PackageQuestionType.SIMPLE)!;
          const secret = questions.find((q) => q.type === PackageQuestionType.SECRET)!;
          secret.questionFiles = [{ ...simple.questionFiles![0], displayTime: 1000 }];
          secret.answerDurationMs = 15000;
          secret.showAnswerDuration = 6000;
        };
        const { gameId, showmanSocket, playerSockets, playerUsers } =
          await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 2, 0, false, 0, true);
        const [recipient, remaining] = playerSockets;
        const recipientId = playerUsers[0].id;
        await utils.startGame(showmanSocket);
        const question = await utils.findQuestionByType(PackageQuestionType.SECRET, gameId);
        await utils.pickQuestion(showmanSocket, question!.id);
        const preparation = scenario.waitForEvent<GameQuestionDataEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );
        const transferred = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.SECRET_QUESTION_TRANSFER
          })
          .waitForCount(1);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: recipientId
        });
        const [questionData] = await Promise.all([preparation, transferred]);
        expect(questionData.data.questionFiles).toHaveLength(1);

        const ack = scenario.waitForEvent<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        const ackAccepted = scenario
          .createAcceptedActionProbe({ gameId, actionType: GameActionType.MEDIA_DOWNLOADED })
          .waitForCount(1);
        scenario.actor(remaining).emit(SocketIOGameEvents.MEDIA_DOWNLOADED, {});
        const [partial] = await Promise.all([ack, ackAccepted]);
        expect(partial.timer).toBeNull();
        await scenario.assert.waitForActionsComplete({ gameId });
        const before = (await utils.getGameState(gameId))!;
        expect(before).toMatchObject({
          questionState: QuestionState.MEDIA_DOWNLOADING,
          answeringPlayer: recipientId
        });

        const paused = mode === "paused leave";
        if (paused) {
          await utils.pauseGame(showmanSocket);
          await scenario.assert.waitForActionsComplete({ gameId });
        }
        const mark = scenario.mark();
        const host = scenario.actor(showmanSocket);
        const left = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
        const accepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: mode === "disconnect" ? GameActionType.DISCONNECT : GameActionType.LEAVE
          })
          .waitForCount(1);
        if (mode === "disconnect") {
          const disconnected = scenario.waitForEvent(recipient, "disconnect");
          scenario.actor(recipient).disconnect();
          await disconnected;
        } else {
          scenario.actor(recipient).emit(SocketIOGameEvents.LEAVE);
        }
        await Promise.all([left, accepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        const state = (await utils.getGameState(gameId))!;
        if (mode === "disconnect") {
          expect(state).toMatchObject({
            questionState: QuestionState.ANSWERING,
            answeringPlayer: recipientId
          });
          await scenario.assert.noInbound({
            actor: host,
            event: SocketIOGameEvents.ANSWER_RESULT,
            afterSequence: mark,
            durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
          });
          const { socket } = await utils.createSocketForExistingUser(suite.app, recipientId);
          const joined = await utils.joinSpecificGameWithData(socket, gameId, PlayerRole.PLAYER);
          expect(joined.gameState).toMatchObject({
            questionState: QuestionState.ANSWERING,
            answeringPlayer: recipientId,
            timer: state.timer
          });
          return;
        }

        expect(state).toMatchObject({
          questionState: QuestionState.SHOWING_ANSWER,
          isPaused: paused,
          answeringPlayer: null,
          answerShowData: {
            answerResult: { player: recipientId, answerType: AnswerResultType.SKIP, result: 0 }
          }
        });
        const redis = RedisConfig.getClient();
        expect(await redis.get(timerKey(gameId, QuestionState.MEDIA_DOWNLOADING))).toBeNull();
        const activeKey = timerKey(gameId);
        if (paused) expect(await redis.get(activeKey)).toBeNull();
        const revealKey = paused ? timerKey(gameId, QuestionState.SHOWING_ANSWER) : activeKey;
        expect(JSON.parse((await redis.get(revealKey)) ?? "null")).toMatchObject({
          durationMs: 6000,
          elapsedMs: 0
        });
        await scenario.assert.noInbound({
          actor: host,
          event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          afterSequence: mark,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
        });
        if (paused) {
          const resumed = await scenario.emitAndWaitForEvent<GameUnpauseBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.GAME_UNPAUSE,
            () => scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {})
          );
          expect(resumed.timer).toMatchObject({ durationMs: 6000, elapsedMs: 0 });
          await scenario.assert.waitForActionsComplete({ gameId });
          expect(await redis.get(revealKey)).toBeNull();
        }
        const revealEnded = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_END
        );
        await suite.testUtils.expireTimer(gameId);
        await revealEnded;
        await scenario.assert.waitForActionsComplete({ gameId });
        expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.CHOOSING);
        for (const event of [
          SocketIOGameEvents.ANSWER_RESULT,
          SocketIOGameEvents.QUESTION_FINISH
        ]) {
          scenario.assert.expectDirectedEventCount({
            actor: host,
            direction: "inbound",
            event,
            afterSequence: mark,
            expectedCount: 1
          });
        }
      });
    }
  );

  it.each([
    "button",
    "direct",
    "single-direct",
    "all-play",
    "normal-all-play",
    "direct-select"
  ] as const)("preserves authored timing and private content in %s mode", async (mode) => {
    await suite.scenario(async (scenario) => {
      const directSelect = mode === "direct-select";
      const direct = mode === "direct" || mode === "single-direct" || directSelect;
      const allPlay = mode === "all-play" || mode === "normal-all-play";
      const questionType = direct
        ? PackageQuestionType.SECRET
        : mode === "all-play"
          ? PackageQuestionType.NO_RISK
          : PackageQuestionType.SIMPLE;
      const contentMs = directSelect ? 4000 : 5000;
      const opensAtMs = contentMs + (directSelect ? 500 : 0);
      const timerDurationMs = opensAtMs + 15000;
      const imageChoiceOrder = 0;
      const choice = { answerText: "Same", choiceOrder: 1 };
      const utils = suite.utils;
      utils.packageTransform = (pkg) => {
        const questions = pkg.rounds[0].themes.flatMap((theme) => theme.questions);
        const simple = questions.find((q) => q.type === PackageQuestionType.SIMPLE)!;
        const q = questions.find((item) => item.type === questionType)!;
        if (allPlay) q.subType = PackageQuestionSubType.FOR_EVERYONE;
        if (mode === "normal-all-play" || directSelect) q.realPrice = 500;
        q.text = "Public clue";
        q.textOrder = 0;
        q.textDurationMs = 2000;
        q.answerDurationMs = 15000;
        q.questionFiles = directSelect
          ? null
          : [{ ...simple.questionFiles![0], order: 1, displayTime: 1000 }];
        q.textItems = [
          { order: 2, text: "Private spoken clue", placement: "replic", durationMs: 2000 }
        ];
        q.answerText = directSelect ? choice.answerText : "Paris";
        if (directSelect) {
          q.answerType = AnswerType.SELECT;
          q.correctChoiceOrder = choice.choiceOrder;
          q.showDelay = 500;
          q.answers = [
            {
              order: imageChoiceOrder,
              text: choice.answerText,
              file: simple.questionFiles![0].file
            },
            { order: choice.choiceOrder, text: choice.answerText, file: null }
          ];
        }
        q.showmanComments = "Private instruction";
        q.answerExplanation = "Reveal explanation";
        q.answerFiles = [{ ...simple.questionFiles![0], order: 1, displayTime: 1000 }];
        q.answerTextItems = [
          { order: 0, text: "Before answer image", durationMs: 1000 },
          { order: 2, text: "After answer image", durationMs: 2000 },
          { order: 3, text: "Private answer speech", placement: "replic", durationMs: 1500 }
        ];
      };
      const setup = await utils.setupGameTestEnvironment(
        suite.userRepo,
        suite.app,
        mode === "single-direct" ? 1 : 2,
        1,
        false,
        0,
        true
      );
      const { showmanSocket, playerSockets, playerUsers, spectatorSockets, gameId } = setup;
      await utils.startGame(showmanSocket);
      const configured = await utils.getGameFromGameService(gameId);
      configured.settings = { ...configured.settings, falseStart: false };
      await utils.updateGame(configured);
      const q = await utils.findQuestionByType(questionType, gameId);
      const hostData = scenario.waitForEvent<GameQuestionDataEventPayload>(
        showmanSocket,
        SocketIOGameEvents.QUESTION_DATA
      );
      const playerData = scenario.waitForEvent<GameQuestionDataEventPayload>(
        playerSockets[0],
        SocketIOGameEvents.QUESTION_DATA
      );
      const observerData = scenario.waitForEvent<GameQuestionDataEventPayload>(
        spectatorSockets[0],
        SocketIOGameEvents.QUESTION_DATA
      );
      await utils.pickQuestion(showmanSocket, q!.id);
      if (direct && mode !== "single-direct") {
        const accepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.SECRET_QUESTION_TRANSFER
          })
          .waitForCount(1);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: playerUsers[0].id
        });
        await accepted;
      }
      const [host, player, observer] = await Promise.all([hostData, playerData, observerData]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(host.data).toMatchObject({
        showmanComments: "Private instruction",
        textItems: [{ text: "Private spoken clue" }]
      });
      for (const data of [player.data, observer.data]) {
        expect(JSON.stringify(data)).not.toMatch(
          /Private spoken|Private instruction|Before answer|After answer|Reveal explanation|Paris/
        );
        expect(data.textItems).toEqual([
          { order: 2, text: "", placement: "replic", durationMs: 2000 }
        ]);
        if (directSelect) {
          expect(data.questionFiles).toBeNull();
          const imageOption = data.answers?.find((option) => option.order === imageChoiceOrder);
          expect(imageOption?.file).toMatchObject({
            md5: TEST_MEDIA_FILE_MD5,
            type: PackageFileType.IMAGE
          });
          expect(data).not.toHaveProperty("correctChoiceOrder");
        }
      }
      expect((await utils.getGameState(gameId))!.questionState).toBe(
        QuestionState.MEDIA_DOWNLOADING
      );
      const event = allPlay
        ? SocketIOGameEvents.ALL_PLAY_ANSWER
        : SocketIOGameEvents.ANSWER_SUBMITTED;
      const action = allPlay
        ? GameActionType.EVERYONE_ANSWER_SUBMIT
        : GameActionType.ANSWER_SUBMITTED;
      const reject = async () => {
        await rejectPrematureAnswer(
          scenario,
          gameId,
          playerSockets[0],
          [showmanSocket, ...playerSockets.slice(1), ...spectatorSockets],
          event,
          action,
          directSelect ? choice : undefined
        );
        const state = (await utils.getGameState(gameId))!;
        expect(state.submittedAnswer ?? null).toBeNull();
        if (allPlay) expect(state.allPlay?.entries.every((entry) => !entry.submitted)).toBe(true);
      };
      if (mode !== "button") await reject();
      for (const [index, socket] of playerSockets.entries()) {
        const status = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          (data) => data.playerId === playerUsers[index].id
        );
        const accepted = scenario
          .createAcceptedActionProbe({ gameId, actionType: GameActionType.MEDIA_DOWNLOADED })
          .waitForCount(1);
        scenario.actor(socket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED, {});
        const [data] = await Promise.all([status, accepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        if (index + 1 < playerSockets.length) expect(data.timer).toBeNull();
      }
      let state = (await utils.getGameState(gameId))!;
      if (state.questionTransition) {
        const released = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          (data) => !!data.timer
        );
        await suite.testUtils.expireTimer(gameId, "question-transition");
        await released;
        await scenario.assert.waitForActionsComplete({ gameId });
      }
      state = (await utils.getGameState(gameId))!;
      expect(state.timer?.durationMs).toBe(timerDurationMs);
      expect(state.questionContentPlan?.totalMs).toBe(contentMs);
      expect(state.questionState).toBe(direct ? QuestionState.ANSWERING : QuestionState.SHOWING);
      if (directSelect) expect(state.buzzerOpensAtMs).toBe(opensAtMs);
      if (mode === "normal-all-play")
        expect(state.allPlay).toMatchObject({ mode: "simple", price: 500 });

      if (mode !== "button") {
        const running = await utils.getGameFromGameService(gameId);
        running.gameState.timer!.startedAt = new Date(Date.now() + 10000);
        running.gameState.timer!.resumedAt = null;
        await utils.updateGame(running);
        await reject();
        running.gameState.timer!.startedAt = new Date();
        await utils.updateGame(running);
        await reject();
        running.gameState.timer!.startedAt = new Date(Date.now() - opensAtMs);
        await utils.updateGame(running);
        // Pause reads the running Redis timer and parks it under the phase key.
        await RedisConfig.getClient().set(
          timerKey(gameId),
          JSON.stringify(running.gameState.timer),
          "PX",
          15000
        );
        const paused = scenario.waitForEvent<GamePauseBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.GAME_PAUSE
        );
        await utils.pauseGame(showmanSocket);
        const pausedClock = (await paused).timer!;
        await scenario.assert.waitForActionsComplete({ gameId });
        expect((await utils.getGameState(gameId))!.isPaused).toBe(true);
        expect(pausedClock.elapsedMs).toBeGreaterThanOrEqual(opensAtMs);
        const resumed = await scenario.emitAndWaitForEvent<GameUnpauseBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE,
          () => scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {})
        );
        await scenario.assert.waitForActionsComplete({ gameId });
        expect(resumed.timer).toMatchObject({
          durationMs: timerDurationMs,
          elapsedMs: pausedClock.elapsedMs
        });
        const submitted = scenario.waitForEvent(showmanSocket, event);
        const accepted = scenario
          .createAcceptedActionProbe({ gameId, actionType: action })
          .waitForCount(1);
        const result = directSelect
          ? scenario.waitForEvent<QuestionAnswerResultEventPayload>(
              showmanSocket,
              SocketIOGameEvents.ANSWER_RESULT
            )
          : null;
        const answer = directSelect ? choice : { answerText: "Accepted after presentation" };
        scenario.actor(playerSockets[0]).emit(event, answer);
        const [broadcast] = await Promise.all([submitted, accepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        if (result) {
          expect((await result).answerResult).toMatchObject({
            player: playerUsers[0].id,
            result: 500,
            choiceOrder: choice.choiceOrder,
            answerType: AnswerResultType.CORRECT
          });
          return;
        }
        const stored = (await utils.getGameState(gameId))!;
        if (allPlay) {
          expect(
            stored.allPlay?.entries.find((entry) => entry.playerId === playerUsers[0].id)
          ).toMatchObject({ submitted: true, answer: answer.answerText });
          expect(JSON.stringify(broadcast)).not.toContain(answer.answerText);
          return;
        }
        expect(stored.submittedAnswer).toBe(answer.answerText);
      }
      const { socket: lateObserver } = await utils.createGameClient(suite.app, suite.userRepo);
      const before = await utils.joinSpecificGameWithData(
        lateObserver,
        gameId,
        PlayerRole.SPECTATOR
      );
      expect(before.gameState.timer?.durationMs).toBe(20000);
      expect(JSON.stringify(before.gameState.currentQuestion)).not.toMatch(
        /Private spoken|Paris|Before answer|Reveal explanation/
      );
      const finish = scenario.waitForEvent<QuestionFinishEventPayload>(
        showmanSocket,
        SocketIOGameEvents.QUESTION_FINISH
      );
      const publicFinish = scenario.waitForEvent<QuestionFinishEventPayload>(
        spectatorSockets[0],
        SocketIOGameEvents.QUESTION_FINISH
      );
      const acceptedSkip = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.SKIP_QUESTION_FORCE })
        .waitForCount(1);
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});
      const [reveal, visibleReveal] = await Promise.all([finish, publicFinish, acceptedSkip]);
      expect(reveal.answerTextItems?.at(-1)?.text).toBe("Private answer speech");
      expect(visibleReveal.answerTextItems?.at(-1)).toMatchObject({
        order: 3,
        text: "",
        placement: "replic",
        durationMs: 1500
      });
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(reveal).toMatchObject({
        answerText: "Paris",
        answerExplanation: "Reveal explanation",
        answerFiles: [{ order: 1 }],
        answerTextItems: [
          { order: 0, text: "Before answer image" },
          { order: 2, text: "After answer image" },
          { order: 3, text: "Private answer speech", placement: "replic" }
        ]
      });
      expect(reveal.answerContentPlan?.steps.map((step) => step.items[0].order)).toEqual([
        0, 1, 2, 3
      ]);
      const { socket: revealObserver } = await utils.createGameClient(suite.app, suite.userRepo);
      const after = await utils.joinSpecificGameWithData(
        revealObserver,
        gameId,
        PlayerRole.SPECTATOR
      );
      expect(after.gameState.answerShowData).toMatchObject({
        answerTextItems: visibleReveal.answerTextItems,
        answerExplanation: "Reveal explanation"
      });
    });
  });
  it("starts the final's common answer window after the authored presentation", async () => {
    await suite.scenario(async (scenario) => {
      const utils = suite.utils;
      utils.packageTransform = (pkg) => {
        const final = pkg.rounds.find((round) => round.type === PackageRoundType.FINAL)!;
        for (const question of final.themes.flatMap((theme) => theme.questions)) {
          question.text = "Final prompt";
          question.textOrder = 0;
          question.textDurationMs = 3000;
          question.textWaitForFinish = false;
          question.textItems = [{ order: 1, text: "Second clue", durationMs: 2000 }];
          question.answerDurationMs = 15000;
          question.questionFiles = [];
        }
      };
      const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } =
        await suite.testUtils.setupFinalRoundGame({ playersCount: 2, playerScores: [500, 500] });
      await suite.testUtils.completeThemeElimination(playerSockets, gameId, playerUsers);
      const ready = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_QUESTION_DATA);
      for (const socket of playerSockets) {
        await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.FINAL_BID_SUBMIT, () =>
          scenario.actor(socket).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 100 })
        );
      }
      await ready;
      await scenario.assert.waitForActionsComplete({ gameId });
      const running = await utils.getGameFromGameService(gameId);
      expect(running.gameState.timer?.durationMs).toBe(20000);
      expect(running.gameState.finalRoundData?.questionData?.contentPlan?.totalMs).toBe(5000);
      expect(
        running.gameState.finalRoundData?.questionData?.contentPlan?.steps.map(
          ({ durationMs }) => durationMs
        )
      ).toEqual([3000, 2000]);
      const reject = async () => {
        await rejectPrematureAnswer(
          scenario,
          gameId,
          playerSockets[0],
          [showmanSocket, playerSockets[1], spectatorSockets[0]],
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
          GameActionType.FINAL_ANSWER_SUBMIT
        );
        expect((await utils.getGameState(gameId))!.finalRoundData?.answers).toEqual([]);
      };
      running.gameState.timer!.startedAt = new Date(Date.now() + 10000);
      await utils.updateGame(running);
      await reject();
      running.gameState.timer!.startedAt = new Date();
      await utils.updateGame(running);
      await reject();
      running.gameState.timer!.startedAt = new Date(Date.now() - 5000);
      await utils.updateGame(running);
      const broadcast = await scenario.emitAndWaitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        () =>
          scenario
            .actor(playerSockets[0])
            .emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, { answerText: "Accepted final answer" })
      );
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(JSON.stringify(broadcast)).not.toContain("Accepted final answer");
      expect((await utils.getGameState(gameId))!.finalRoundData?.answers).toMatchObject([
        { answer: "Accepted final answer" }
      ]);
    });
  });

  it("round-trips the nullable migration up/down on PostgreSQL without touching native columns", async () => {
    await suite.scenario(async () => {
      const runner = suite.dataSource.createQueryRunner();
      const migration = new AddQuestionAuthoredContent_0_34_3_1794418572614();
      await runner.startTransaction();
      try {
        await migration.down(runner);
        expect(
          (await runner.getTable("package_question"))!.findColumnByName("answer_duration_ms")
        ).toBeUndefined();
        expect(
          (await runner.getTable("package_question"))!.findColumnByName("answer_delay")
        ).toBeDefined();
        await migration.up(runner);
        const table = (await runner.getTable("package_question"))!;
        for (const name of [
          "text_duration_ms",
          "text_wait_for_finish",
          "answer_duration_ms",
          "answer_text_items",
          "showman_comments",
          "answer_explanation"
        ])
          expect(table.findColumnByName(name)?.isNullable).toBe(true);
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    });
  });
});
