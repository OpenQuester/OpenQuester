import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
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

  it.each(["normal", "all-play", "force-skip"] as const)(
    "retains the first image in %s reveal snapshots without leaking the target early",
    async (mode) => {
      await suite.scenario(async (scenario) => {
        const utils = suite.utils;
        utils.packageTransform = (pkg) => {
          const questions = pkg.rounds[0].themes.flatMap((theme) => theme.questions);
          const simple = questions.find((q) => q.type === PackageQuestionType.SIMPLE)!;
          const selected =
            mode === "all-play"
              ? questions.find((q) => q.type === PackageQuestionType.NO_RISK)!
              : simple;
          if (mode === "all-play") {
            selected.subType = PackageQuestionSubType.FOR_EVERYONE;
            selected.questionFiles = simple.questionFiles;
          }
          selected.answerType = AnswerType.POINT;
          selected.answerPoint = { x: 0.5, y: 0.5, imageAspectRatio: 2 };
          selected.answerDeviation = 0.1;
          selected.showAnswerDuration = 30_000;
        };
        const { showmanSocket, showmanUser, playerSockets, playerUsers, spectatorSockets, gameId } =
          await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 2, 1, false, 0, true);
        await utils.startGame(showmanSocket);
        const q = await utils.findQuestionByType(
          mode === "all-play" ? PackageQuestionType.NO_RISK : PackageQuestionType.SIMPLE,
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
        const image = playerData.data.questionFiles?.find((file) => file.file.type === "image")
          ?.file.link;
        expect(image).toBeTruthy();
        const finish = scenario.waitForEvent<QuestionFinishEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_FINISH
        );
        if (mode === "normal") {
          await utils.answerQuestion(playerSockets[0], showmanSocket);
          scenario
            .actor(playerSockets[0])
            .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "0.500,0.500" });
        } else if (mode === "all-play") {
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
        expect(await finish).toMatchObject({
          answerPointImage: image,
          answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
          answerDeviation: 0.1
        });
        for (const [userId, role] of [
          [showmanUser.id, PlayerRole.SHOWMAN],
          [playerUsers[0].id, PlayerRole.PLAYER]
        ] as const) {
          const { socket } = await utils.createSocketForExistingUser(suite.app, userId);
          const snapshot = await utils.joinSpecificGameWithData(socket, gameId, role);
          expect(snapshot.gameState.questionState).toBe(QuestionState.SHOWING_ANSWER);
          expect(snapshot.gameState.currentQuestion).toBeNull();
          expect(snapshot.gameState.answerShowData).toMatchObject({
            answerPointImage: image,
            answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
            answerDeviation: 0.1
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
          answerDeviation: 0.1
        });
      });
    }
  );
});
