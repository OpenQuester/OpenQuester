import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { GameActionType } from "domain/enums/GameActionType";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import type { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Point reveal reconnect", () => {
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

  it.each([
    "normal",
    "all-play",
    "force-skip",
    "siq",
    "siq-all-play",
    "siq-timeout",
    "siq-leave"
  ] as const)(
    "retains the selected image in %s reveal snapshots without leaking the target early",
    async (mode) => {
      await suite.scenario(async (scenario) => {
        const utils = suite.utils;
        const imported = mode.startsWith("siq");
        const everyone = mode === "all-play" || mode === "siq-all-play";
        const answerDeviation = mode === "siq" ? null : 0.1;
        utils.packageTransform = (pkg) => {
          const questions = pkg.rounds[0].themes.flatMap((theme) => theme.questions);
          const simple = questions.find((q) => q.type === PackageQuestionType.SIMPLE)!;
          const selected = everyone
            ? questions.find((q) => q.type === PackageQuestionType.NO_RISK)!
            : simple;
          if (everyone) {
            selected.subType = PackageQuestionSubType.FOR_EVERYONE;
            selected.questionFiles = simple.questionFiles;
          }
          selected.answerType = AnswerType.POINT;
          selected.answerPoint = {
            x: 0.5,
            y: 0.5,
            imageAspectRatio: 2,
            ...(imported ? { sourceGeometry: { kind: "sigame" as const, aspectRatio: 1 } } : {})
          };
          if (imported) {
            const image = simple.questionFiles!.find((item) => item.file.type === "image")!;
            selected.questionFiles = [
              { ...image, order: 0 },
              { ...image, order: 1 }
            ];
            selected.pointImageOrder = 1;
          }
          selected.answerDeviation = answerDeviation;
          selected.showAnswerDuration = 30_000;
        };
        const { showmanSocket, showmanUser, playerSockets, playerUsers, spectatorSockets, gameId } =
          await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 2, 1, false, 0, true);
        await utils.startGame(showmanSocket);
        const q = await utils.findQuestionByType(
          everyone ? PackageQuestionType.NO_RISK : PackageQuestionType.SIMPLE,
          gameId
        );
        const host = scenario.waitForEvent<GameQuestionDataEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );
        const player = scenario.waitForEvent<GameQuestionDataEventPayload>(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        const spectator = scenario.waitForEvent<GameQuestionDataEventPayload>(
          spectatorSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, q!.id, playerSockets);
        const [hostData, playerData, spectatorData] = await Promise.all([host, player, spectator]);
        expect(hostData.data).toMatchObject({
          answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 }
        });
        expect(playerData.data).not.toHaveProperty("answerPoint");
        expect(spectatorData.data).not.toHaveProperty("answerPoint");
        if (imported) await utils.pauseGame(showmanSocket);
        const { socket: beforeRevealSpectator } = await utils.createGameClient(
          suite.app,
          suite.userRepo
        );
        const beforeReveal = await utils.joinSpecificGameWithData(
          beforeRevealSpectator,
          gameId,
          PlayerRole.SPECTATOR
        );
        expect(beforeReveal.gameState.answerShowData).toBeNull();
        expect(beforeReveal.gameState.currentQuestion).not.toHaveProperty("answerPoint");
        if (imported) {
          expect(
            "answerPoint" in hostData.data && hostData.data.answerPoint?.sourceGeometry
          ).toEqual({ kind: "sigame", aspectRatio: 1 });
          expect(playerData.data.pointImageOrder).toBe(1);
          expect(beforeReveal.gameState.currentQuestion?.pointImageOrder).toBe(1);
        }
        if (imported) {
          expect(beforeReveal.gameState.isPaused).toBe(true);
          await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.GAME_UNPAUSE, () =>
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {})
          );
        }
        const image = playerData.data.questionFiles?.find(
          (file) => file.file.type === "image" && (!imported || file.order === 1)
        )?.file.link;
        expect(image).toBeTruthy();
        const finish = scenario.waitForEvent<QuestionFinishEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_FINISH
        );
        if (mode === "siq-leave") {
          await utils.answerQuestion(playerSockets[0], showmanSocket);
          expect((await utils.getGameState(gameId))!.answeringPlayer).toBe(playerUsers[0].id);
          const after = scenario.mark();
          const accepted = scenario
            .createAcceptedActionProbe({
              gameId,
              actionType: GameActionType.LEAVE,
              socketId: playerSockets[0].id
            })
            .waitForCount(1);
          const skipped = scenario.waitForEvent<QuestionAnswerResultEventPayload>(
            showmanSocket,
            SocketIOGameEvents.ANSWER_RESULT
          );
          const left = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.LEAVE);
          const [result] = await Promise.all([skipped, accepted, left]);
          await scenario.assert.waitForActionsComplete({ gameId });
          expect(result.answerResult).toMatchObject({
            player: playerUsers[0].id,
            result: 0,
            answerType: "skip"
          });
          const resumed = (await utils.getGameState(gameId))!;
          expect(resumed).toMatchObject({
            questionState: QuestionState.SHOWING,
            answeringPlayer: null,
            answerShowData: null
          });
          expect(resumed.currentQuestion?.pointImageOrder).toBe(1);
          await scenario.assert.noInboundMany({
            actors: [scenario.actor(playerSockets[1]), scenario.actor(spectatorSockets[0])],
            event: SocketIOGameEvents.QUESTION_FINISH,
            afterSequence: after,
            durationMs: 100
          });
          const { socket: watchingAfterLeave } = await utils.createGameClient(
            suite.app,
            suite.userRepo
          );
          const snapshot = await utils.joinSpecificGameWithData(
            watchingAfterLeave,
            gameId,
            PlayerRole.SPECTATOR
          );
          expect(snapshot.gameState.currentQuestion).not.toHaveProperty("answerPoint");
          expect(snapshot.gameState.answerShowData).toBeNull();
          await utils.answerQuestion(playerSockets[1], showmanSocket);
          expect((await utils.getGameState(gameId))!.answeringPlayer).toBe(playerUsers[1].id);
          scenario
            .actor(playerSockets[1])
            .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "0.500,0.500" });
        } else if (mode === "siq-timeout") {
          await suite.testUtils.expireTimerAndWaitForAction(
            gameId,
            GameActionType.TIMER_QUESTION_SHOWING_EXPIRED
          );
        } else if (mode === "siq") {
          await utils.answerQuestion(playerSockets[0], showmanSocket);
          const rejected = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
            showmanSocket,
            SocketIOGameEvents.ANSWER_RESULT,
            () =>
              scenario
                .actor(playerSockets[0])
                .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "0.530,0.500" })
          );
          expect(rejected.answerResult).toMatchObject({
            player: playerUsers[0].id,
            answerType: "wrong"
          });
          await utils.answerQuestion(playerSockets[1], showmanSocket);
          scenario
            .actor(playerSockets[1])
            .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "0.510,0.500" });
        } else if (mode === "normal") {
          await utils.answerQuestion(playerSockets[0], showmanSocket);
          scenario
            .actor(playerSockets[0])
            .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "0.500,0.500" });
        } else if (everyone) {
          await scenario.assert.waitForActionsComplete({ gameId });
          const game = await utils.getGameFromGameService(gameId);
          const { timer, questionContentPlan } = game.gameState;
          if (!timer || !questionContentPlan?.totalMs)
            throw new Error("Expected an active authored presentation");
          if (timer.resumedAt) {
            timer.elapsedMs = Math.max(timer.elapsedMs, questionContentPlan.totalMs);
          } else {
            timer.startedAt = new Date(Date.now() - questionContentPlan.totalMs);
          }
          await utils.updateGame(game);
          for (const socket of playerSockets)
            await scenario.emitAndWaitForEvent(
              showmanSocket,
              SocketIOGameEvents.ALL_PLAY_ANSWER,
              () =>
                scenario
                  .actor(socket)
                  .emit(SocketIOGameEvents.ALL_PLAY_ANSWER, { answerText: "0.500,0.500" })
            );
        } else {
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});
        }
        const revealed = await finish;
        if (imported)
          expect(revealed.answerPoint?.sourceGeometry).toEqual({ kind: "sigame", aspectRatio: 1 });
        expect(revealed).toMatchObject({
          answerPointImage: image,
          answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
          answerDeviation
        });
        for (const [userId, role] of [
          [showmanUser.id, PlayerRole.SHOWMAN],
          [playerUsers[0].id, PlayerRole.PLAYER]
        ] as const) {
          const { socket } = await utils.createSocketForExistingUser(suite.app, userId);
          const snapshot = await utils.joinSpecificGameWithData(socket, gameId, role);
          if (imported)
            expect(snapshot.gameState.answerShowData?.answerPoint?.sourceGeometry).toEqual({
              kind: "sigame",
              aspectRatio: 1
            });
          expect(snapshot.gameState.questionState).toBe(QuestionState.SHOWING_ANSWER);
          expect(snapshot.gameState.currentQuestion).toBeNull();
          expect(snapshot.gameState.answerShowData).toMatchObject({
            answerPointImage: image,
            answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
            answerDeviation
          });
        }
        const { socket: lateSpectator } = await utils.createGameClient(suite.app, suite.userRepo);
        const snapshot = await utils.joinSpecificGameWithData(
          lateSpectator,
          gameId,
          PlayerRole.SPECTATOR
        );
        expect(snapshot.gameState.answerShowData).toMatchObject({
          answerPointImage: image,
          answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
          answerDeviation
        });
      });
    }
  );
});
