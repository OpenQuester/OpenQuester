import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Buzzer question wrong answers", () => {
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
    { type: PackageQuestionType.CHOICE, ruling: "automatic" },
    { type: PackageQuestionType.HIDDEN, ruling: "wrong" },
    { type: PackageQuestionType.HIDDEN, ruling: "skip" }
  ] as const)(
    "restores showing for $type after $ruling when other players remain",
    async ({ type, ruling }) => {
      await suite.scenario(async (scenario) => {
        const utils = suite.utils;
        utils.packageTransform = (pkg) => {
          const questions = pkg.rounds[0].themes.flatMap((theme) => theme.questions);
          if (type === PackageQuestionType.CHOICE) {
            questions.find((q) => q.type === type)!.answerText = "Option B";
          } else {
            const q = questions.find((item) => item.type === PackageQuestionType.SIMPLE)!;
            q.type = PackageQuestionType.HIDDEN;
            q.isHidden = true;
          }
        };
        const { showmanSocket, playerSockets, playerUsers, gameId } =
          await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 3, 0);
        await utils.startGame(showmanSocket);
        const question = await utils.findQuestionByType(type, gameId);
        expect(question).toBeDefined();
        await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
        const showing = (await utils.getGameState(gameId))!;
        expect(showing.currentQuestion!.type).toBe(type);
        expect(showing.timer).not.toBeNull();
        await utils.answerQuestion(playerSockets[0], showmanSocket);
        const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () => {
            if (ruling === "automatic")
              scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
                answerText: "Option C"
              });
            else
              scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
                answerType: ruling === "skip" ? AnswerResultType.SKIP : AnswerResultType.WRONG,
                scoreResult: -100
              });
          }
        );
        expect(result.answerResult.player).toBe(playerUsers[0].id);
        expect(result.answerResult.answerType).toBe(
          ruling === "skip" ? AnswerResultType.SKIP : AnswerResultType.WRONG
        );
        expect(result.timer).not.toBeNull();
        expect(result.timer!.durationMs).toBe(showing.timer!.durationMs);
        const resumed = (await utils.getGameState(gameId))!;
        expect(resumed.questionState).toBe(QuestionState.SHOWING);
        expect(resumed.timer).not.toBeNull();
        await utils.answerQuestion(playerSockets[1], showmanSocket);
        const answering = (await utils.getGameState(gameId))!;
        expect(answering.questionState).toBe(QuestionState.ANSWERING);
        expect(answering.answeringPlayer).toBe(playerUsers[1].id);
      });
    }
  );

  it("reveals a correct choice immediately even when other players remain", async () => {
    await suite.scenario(async (scenario) => {
      const utils = suite.utils;
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds[0].themes
          .flatMap((theme) => theme.questions)
          .find((item) => item.type === PackageQuestionType.CHOICE)!;
        question.answerText = "Option B";
      };
      const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
        suite.userRepo,
        suite.app,
        3,
        0
      );
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
      await utils.answerQuestion(playerSockets[0], showmanSocket);
      const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
        showmanSocket,
        SocketIOGameEvents.ANSWER_RESULT,
        () => {
          scenario
            .actor(playerSockets[0])
            .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "Option B" });
        }
      );
      expect(result.answerResult.answerType).toBe(AnswerResultType.CORRECT);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.SHOWING_ANSWER);
    });
  });

  it("broadcasts rejected choice identity and rejects another player's repeat before submission", async () => {
    await suite.scenario(async (scenario) => {
      const utils = suite.utils;
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds[0].themes
          .flatMap((theme) => theme.questions)
          .find((item) => item.type === PackageQuestionType.CHOICE)!;
        question.answerText = "Option B";
      };
      const { showmanSocket, playerSockets, spectatorSockets, gameId } =
        await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 3, 1);
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
      const choice = (await utils.getGameState(gameId))!.currentQuestion!.answers!.find(
        (answer) => answer.text === "Option C"
      )!;
      await utils.answerQuestion(playerSockets[0], showmanSocket);
      const spectatorResult = scenario.waitForEvent<QuestionAnswerResultEventPayload>(
        spectatorSockets[0],
        SocketIOGameEvents.ANSWER_RESULT
      );
      const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
        playerSockets[1],
        SocketIOGameEvents.ANSWER_RESULT,
        () => {
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
            answerText: "Option C",
            choiceOrder: choice.order
          });
        }
      );
      expect(result.answerResult).toMatchObject({
        answerType: AnswerResultType.WRONG,
        choiceOrder: choice.order
      });
      expect((await spectatorResult).answerResult.choiceOrder).toBe(choice.order);
      expect((await utils.getGameState(gameId))!.answeredPlayers?.at(-1)?.choiceOrder).toBe(
        choice.order
      );
      const { socket: observer, user } = await utils.createGameClient(suite.app, suite.userRepo);
      const joined = scenario.waitForEvent(observer, SocketIOGameEvents.GAME_DATA);
      scenario
        .actor(observer)
        .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
      expect((await joined).gameState.answeredPlayers.at(-1).choiceOrder).toBe(choice.order);
      const leave = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
      scenario.actor(observer).disconnect();
      await leave;
      await scenario.assert.waitForActionsComplete({ gameId });
      const { socket: rejoined } = await utils.createSocketForExistingUser(suite.app, user.id);
      const rejoinData = scenario.waitForEvent(rejoined, SocketIOGameEvents.GAME_DATA);
      scenario
        .actor(rejoined)
        .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
      expect((await rejoinData).gameState.answeredPlayers.at(-1).choiceOrder).toBe(choice.order);
      await utils.answerQuestion(playerSockets[1], showmanSocket);
      const mark = scenario.mark();
      const mismatchError = scenario.waitForEvent(playerSockets[1], SocketIOEvents.ERROR);
      scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        answerText: "Option B",
        choiceOrder: choice.order
      });
      await mismatchError;
      const error = scenario.waitForEvent(playerSockets[1], SocketIOEvents.ERROR);
      scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        answerText: "Option C",
        choiceOrder: choice.order
      });
      await error;
      await scenario.assert.waitForActionsComplete({ gameId });
      expect((await utils.getGameState(gameId))!.submittedChoiceOrder).toBeNull();
      expect(
        scenario.assert
          .records({ actor: scenario.actor(showmanSocket), direction: "inbound" })
          .filter(
            (record) =>
              record.sequence > mark && record.event === SocketIOGameEvents.ANSWER_SUBMITTED
          )
      ).toHaveLength(0);
    });
  });

  it("keeps an image-only choice manual when its display number collides with correct text", async () => {
    await suite.scenario(async (scenario) => {
      const utils = suite.utils;
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds[0].themes
          .flatMap((theme) => theme.questions)
          .find((item) => item.type === PackageQuestionType.CHOICE)!;
        question.answerText = "1";
        question.answers![0].text = null;
        question.answers![1].text = "1";
      };
      const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
        suite.userRepo,
        suite.app,
        2,
        0
      );
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
      await utils.answerQuestion(playerSockets[0], showmanSocket);
      const mark = scenario.mark();
      const error = scenario.waitForEvent(playerSockets[0], SocketIOEvents.ERROR);
      scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        answerText: "1",
        choiceOrder: 0
      });
      await error;
      const submitted = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_SUBMITTED);
      scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        answerText: "#1",
        choiceOrder: 0
      });
      await submitted;
      await scenario.assert.waitForActionsComplete({ gameId });
      const state = (await utils.getGameState(gameId))!;
      expect(state.questionState).toBe(QuestionState.ANSWERING);
      expect(state.submittedChoiceOrder).toBe(0);
      expect(
        scenario.assert
          .records({ actor: scenario.actor(showmanSocket), direction: "inbound" })
          .filter(
            (record) => record.sequence > mark && record.event === SocketIOGameEvents.ANSWER_RESULT
          )
      ).toHaveLength(0);
    });
  });

  it("reveals a hidden question after all three players answer incorrectly", async () => {
    await suite.scenario(async (scenario) => {
      const utils = suite.utils;
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds[0].themes
          .flatMap((theme) => theme.questions)
          .find((item) => item.type === PackageQuestionType.SIMPLE)!;
        question.type = PackageQuestionType.HIDDEN;
        question.isHidden = true;
      };
      const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
        suite.userRepo,
        suite.app,
        3,
        0
      );
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.HIDDEN, gameId);
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
      for (let index = 0; index < playerSockets.length; index++) {
        await utils.answerQuestion(playerSockets[index], showmanSocket);
        await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT, () => {
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
            answerType: AnswerResultType.WRONG,
            scoreResult: -100
          });
        });
        await scenario.assert.waitForActionsComplete({ gameId });
        expect((await utils.getGameState(gameId))!.questionState).toBe(
          index === 2 ? QuestionState.SHOWING_ANSWER : QuestionState.SHOWING
        );
      }
    });
  });
});
