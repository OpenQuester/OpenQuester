import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { HttpStatus } from "domain/enums/HttpStatus";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { PackageUtils, TEST_MEDIA_FILE_MD5 } from "tests/utils/PackageUtils";
import { GameActionType } from "domain/enums/GameActionType";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { INSTANT_BUZZER_SETTINGS } from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";

describe("Choice Question Flow Tests", () => {
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
    utils.packageTransform = null;
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Choice Question Behavior", () => {
    it("should reveal question correctly", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;
        const playerSocket = playerSockets[0];

        // Start game
        await utils.startGame(showmanSocket);

        const choiceQuestion = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
        expect(choiceQuestion).toBeDefined();
        const choiceQuestionId = choiceQuestion!.id;

        // Set up promise to capture initial question data
        const questionDataPromise = scenario.waitForEvent<GameQuestionDataEventPayload>(
          playerSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        // Pick the choice question
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: choiceQuestionId
        });

        const questionData = await questionDataPromise;

        // Verify initial question data is revealed
        expect(questionData.data).toBeDefined();
        expect(questionData.data.text).toBe("Choice question text");
        expect(questionData.data.price).toBe(300);
        expect(questionData.data.type).toBe(PackageQuestionType.CHOICE);

        expect(questionData.data.showDelay).toBeDefined();
        expect(questionData.data.answers).toBeDefined();
        expect(questionData.data.answers?.length).toBe(4);

        const downloadingGameState = await utils.getGameState(gameId);
        expect(downloadingGameState!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
        expect(downloadingGameState!.currentQuestion).toBeDefined();

        const mediaStatusPromise = scenario.waitForEvent(
          playerSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        scenario.actor(playerSocket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        await mediaStatusPromise;

        const showingGameState = await utils.getGameState(gameId);
        expect(showingGameState!.questionState).toBe(QuestionState.SHOWING);
        expect(showingGameState!.currentQuestion).toBeDefined();
      });
    });

    it("should handle choice question answer flow with multiple choice selection", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;
        const playerSocket = playerSockets[0];

        // Start game
        await utils.startGame(showmanSocket);

        const choiceQuestion = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
        expect(choiceQuestion).toBeDefined();
        const choiceQuestionId = choiceQuestion!.id;

        // Pick the choice question using utils (handles media download phase)
        await utils.pickQuestion(showmanSocket, choiceQuestionId!, playerSockets);

        // Verify we're in the showing state after picking
        const showingGameState = await utils.getGameState(gameId);
        expect(showingGameState!.questionState).toBe(QuestionState.SHOWING);
        expect(showingGameState!.currentQuestion).toBeDefined();

        // Player answers the question
        await utils.answerQuestion(playerSocket, showmanSocket);

        // Set up event listeners before emitting answer result
        const answerResultPromise = scenario.waitForEvent(
          playerSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        const answerShowStartPromise = scenario.waitForEvent(
          playerSocket,
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // Submit answer result from showman
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for answer result and show answer start
        await answerResultPromise;
        await answerShowStartPromise;

        // Skip show answer phase
        await utils.skipShowAnswer(showmanSocket);

        const finalGameState = await utils.getGameState(gameId);
        expect(finalGameState!.questionState).toBe(QuestionState.CHOOSING);
      });
    });

    it("should provide choice question data to both showman and players when picked", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;
        const playerSocket = playerSockets[0];

        // Start game
        await utils.startGame(showmanSocket);

        const choiceQuestion = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
        expect(choiceQuestion).toBeDefined();
        const choiceQuestionId = choiceQuestion!.id;

        // Set up promises to capture data sent to both showman and player
        const showmanDataPromise = scenario.waitForEvent<GameQuestionDataEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );
        const playerDataPromise = scenario.waitForEvent<GameQuestionDataEventPayload>(
          playerSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        // Pick the choice question
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: choiceQuestionId
        });

        const [showmanData, playerData] = await Promise.all([
          showmanDataPromise,
          playerDataPromise
        ]);

        // Both should receive question data
        expect(showmanData.data.type).toBe(PackageQuestionType.CHOICE);
        expect(showmanData.data.text).toBe("Choice question text");
        expect(showmanData.data.showDelay).toBe(
          TEST_TIMEOUTS.PACKAGE_QUESTION_SHOW_ANSWER_DURATION_MS
        );
        expect(showmanData.data.answers).toBeDefined();
        expect(showmanData.data.answers?.length).toBe(4);

        expect(playerData.data.type).toBe(PackageQuestionType.CHOICE);
        expect(playerData.data.text).toBe("Choice question text");
        expect(playerData.data.showDelay).toBe(
          TEST_TIMEOUTS.PACKAGE_QUESTION_SHOW_ANSWER_DURATION_MS
        );
        expect(playerData.data.answers).toBeDefined();
        expect(playerData.data.answers?.length).toBe(4);

        // Verify the choices are structured correctly
        const answers = showmanData.data.answers!;
        expect(answers[0].text).toBe("Option A");
        expect(answers[1].text).toBe("Option B");
        expect(answers[2].text).toBe("Option C");
        expect(answers[3].text).toBe("Option D");

        // All answers should have proper order
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i].order).toBe(i);
        }
      });
    });
  });

  describe("Multiple Choice Questions", () => {
    it.each([2, 4])("should handle choice question with %i options", async (optionCount) => {
      await suite.scenario(async (scenario) => {
        const { showmanSocket, playerSocket, gameId, expectedOptions } =
          await setupChoiceOptions(optionCount);
        await utils.startGame(showmanSocket);
        const choiceQuestion = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
        expect(choiceQuestion).toBeDefined();
        const data = [showmanSocket, playerSocket].map((socket) =>
          scenario.waitForEvent<GameQuestionDataEventPayload>(
            socket,
            SocketIOGameEvents.QUESTION_DATA
          )
        );
        await utils.pickQuestion(showmanSocket, choiceQuestion!.id, [playerSocket]);
        for (const payload of await Promise.all(data)) {
          expect(payload.data.type).toBe(PackageQuestionType.CHOICE);
          expect(payload.data.answers).toBeDefined();
          expect(payload.data.answers).toHaveLength(optionCount);
          expect(payload.data.answers!.map(({ text, order }) => ({ text, order }))).toEqual(
            expectedOptions
          );
        }
      });
    });
  });

  describe("Automatic check", () => {
    it("keeps an ambiguous legacy image placeholder out of rejected choice history", async () => {
      await suite.scenario(async (scenario) => {
        utils.packageTransform = (pkg) => {
          const q = pkg.rounds[0].themes
            .flatMap(({ questions }) => questions)
            .find((item) => item.type === PackageQuestionType.CHOICE)!;
          q.answerText = "1";
          q.answers = [
            {
              order: 0,
              text: null,
              file: { md5: TEST_MEDIA_FILE_MD5, type: PackageFileType.IMAGE }
            },
            { order: 1, text: "1", file: null }
          ];
        };
        const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
          userRepo,
          app,
          2,
          0,
          true,
          0,
          true
        );
        await utils.startGame(showmanSocket);
        const question = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
        await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);
        await scenario.emitAndWaitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SUBMITTED,
          () => {
            scenario
              .actor(playerSockets[0])
              .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "1" });
          }
        );
        expect((await utils.getGameState(gameId))!.submittedChoiceOrder).toBeNull();
        const wrong = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () => {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
              answerType: AnswerResultType.WRONG,
              scoreResult: 0
            });
          }
        );
        expect(wrong.answerResult.choiceOrder).toBeUndefined();
        expect(
          (await utils.getGameState(gameId))!.answeredPlayers?.at(-1)?.choiceOrder
        ).toBeUndefined();
        await utils.answerQuestion(playerSockets[1], showmanSocket);
        const right = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () => {
            scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
              answerText: "1",
              choiceOrder: 1
            });
          }
        );
        expect(right.answerResult.answerType).toBe(AnswerResultType.CORRECT);
      });
    });
    it("grades an authored image choice and reveals its image without exposing the key first", async () => {
      await suite.scenario(async (scenario) => {
        utils.packageTransform = (pkg) => {
          const q = pkg.rounds[0].themes
            .flatMap(({ questions }) => questions)
            .find((item) => item.type === PackageQuestionType.CHOICE)!;
          q.answerText = null;
          q.correctChoiceOrder = 0;
          q.answers = [
            {
              order: 0,
              text: null,
              file: { md5: TEST_MEDIA_FILE_MD5, type: PackageFileType.IMAGE }
            },
            { order: 1, text: "1", file: null }
          ];
        };
        const { showmanSocket, playerSockets, spectatorSockets, gameId } =
          await utils.setupGameTestEnvironment(userRepo, app, 2, 1, true, 0, true);
        await utils.startGame(showmanSocket);
        const question = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
        const publicQuestion = scenario.waitForEvent(
          spectatorSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        const playerQuestion = scenario.waitForEvent(
          playerSockets[1],
          SocketIOGameEvents.QUESTION_DATA
        );
        const hostQuestion = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.QUESTION_DATA);
        await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
        expect((await publicQuestion).data).not.toHaveProperty("correctChoiceOrder");
        expect((await playerQuestion).data).not.toHaveProperty("correctChoiceOrder");
        expect((await hostQuestion).data.correctChoiceOrder).toBe(0);
        expect((await utils.getGameState(gameId))!.currentQuestion).not.toHaveProperty(
          "correctChoiceOrder"
        );
        const { socket: observer, user } = await utils.createGameClient(app, userRepo);
        const joined = scenario.waitForEvent(observer, SocketIOGameEvents.GAME_DATA);
        scenario
          .actor(observer)
          .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
        const snapshot = await joined;
        expect(JSON.stringify(snapshot.gameState)).not.toContain("correctChoiceOrder");
        await utils.answerQuestion(playerSockets[0], showmanSocket);
        const reveal = scenario.waitForEvent(
          spectatorSockets[0],
          SocketIOGameEvents.QUESTION_FINISH
        );
        const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () => {
            scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
              answerText: "#1",
              choiceOrder: 0
            });
          }
        );
        expect(result.answerResult.answerType).toBe(AnswerResultType.CORRECT);
        const shown = await reveal;
        expect(shown.answerText).toBeNull();
        expect(shown.correctChoiceImage).toEqual(expect.any(String));
        expect((await utils.getGameState(gameId))!.answerShowData?.correctChoiceImage).toBe(
          shown.correctChoiceImage
        );
        const leave = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
        scenario.actor(observer).disconnect();
        await leave;
        await scenario.assert.waitForActionsComplete({ gameId });
        const { socket: rejoined } = await utils.createSocketForExistingUser(app, user.id);
        const rejoin = scenario.waitForEvent(rejoined, SocketIOGameEvents.GAME_DATA);
        scenario
          .actor(rejoined)
          .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
        expect((await rejoin).gameState.answerShowData.correctChoiceImage).toBe(
          shown.correctChoiceImage
        );
      });
    });

    it("automatically marks a wrong image choice and lets the next player choose the correct text", async () => {
      await suite.scenario(async (scenario) => {
        utils.packageTransform = (pkg) => {
          const q = pkg.rounds[0].themes
            .flatMap(({ questions }) => questions)
            .find((item) => item.type === PackageQuestionType.CHOICE)!;
          q.answerText = "1";
          q.correctChoiceOrder = 1;
          q.answers = [
            {
              order: 0,
              text: null,
              file: { md5: TEST_MEDIA_FILE_MD5, type: PackageFileType.IMAGE }
            },
            { order: 1, text: "1", file: null }
          ];
        };
        const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
          userRepo,
          app,
          2,
          0,
          true,
          0,
          true
        );
        await utils.startGame(showmanSocket);
        const question = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
        await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);
        const wrong = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () => {
            scenario
              .actor(playerSockets[0])
              .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "#1", choiceOrder: 0 });
          }
        );
        expect(wrong.answerResult).toMatchObject({
          answerType: AnswerResultType.WRONG,
          choiceOrder: 0
        });
        await utils.answerQuestion(playerSockets[1], showmanSocket);
        const right = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () => {
            scenario
              .actor(playerSockets[1])
              .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "1", choiceOrder: 1 });
          }
        );
        expect(right.answerResult.answerType).toBe(AnswerResultType.CORRECT);
      });
    });
    async function buzzOnChoice(answerText: string) {
      const setup = await setupChoiceOptions(4, answerText);
      await utils.startGame(setup.showmanSocket);
      const choiceQuestion = await utils.findQuestionByType(
        PackageQuestionType.CHOICE,
        setup.gameId
      );
      await utils.pickQuestion(setup.showmanSocket, choiceQuestion!.id, [setup.playerSocket]);
      await utils.answerQuestion(setup.playerSocket, setup.showmanSocket);
      return { ...setup, price: choiceQuestion!.price ?? 0 };
    }

    it("keeps a distinct picture-option submission for manual judgment", async () => {
      await suite.scenario(async (scenario) => {
        utils.packageTransform = (pkg) => {
          const q = pkg.rounds[0].themes
            .flatMap(({ questions }) => questions)
            .find((item) => item.type === PackageQuestionType.CHOICE)!;
          q.answerText = "2";
          q.answers = [
            { order: 0, text: "2", file: null },
            {
              order: 1,
              text: null,
              file: { md5: TEST_MEDIA_FILE_MD5, type: PackageFileType.IMAGE }
            },
            { order: 2, text: " #2 ", file: null }
          ];
        };
        const { showmanSocket, playerSockets, playerUsers, gameId } =
          await utils.setupGameTestEnvironment(userRepo, app, 1, 0, true, 0, true);
        await utils.startGame(showmanSocket);
        const question = await utils.findQuestionByType(PackageQuestionType.CHOICE, gameId);
        await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);
        const accepted = scenario.createAcceptedActionProbe({
          gameId,
          actionType: GameActionType.ANSWER_SUBMITTED
        });
        const acceptedPromise = accepted.waitForCount(1);
        const submitted = await scenario.emitAndWaitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SUBMITTED,
          () =>
            scenario
              .actor(playerSockets[0])
              .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "##2" })
        );
        expect(submitted).toEqual({ answerText: "##2" });
        await acceptedPromise;
        await scenario.assert.waitForActionsComplete({ gameId });
        expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.ANSWERING);
        expect(
          (await utils.getGameFromGameService(gameId))!.getPlayer(playerUsers[0].id, {
            fetchDisconnected: true
          })!.score
        ).toBe(0);
      });
    });

    it("scores a right pick without the showman", async () => {
      await suite.scenario(async (scenario) => {
        const { showmanSocket, playerSocket, gameId, price } = await buzzOnChoice("Option B");

        const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () =>
            scenario
              .actor(playerSocket)
              .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "option b " })
        );

        expect(result.answerResult.answerType).toBe(AnswerResultType.CORRECT);
        expect(result.answerResult.result).toBe(price);
        expect((await utils.getGameState(gameId))!.questionState).toBe(
          QuestionState.SHOWING_ANSWER
        );
      });
    });

    it("costs points for a wrong pick", async () => {
      await suite.scenario(async (scenario) => {
        const { showmanSocket, playerSocket, price } = await buzzOnChoice("Option B");

        const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () =>
            scenario
              .actor(playerSocket)
              .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "Option C" })
        );

        expect(result.answerResult.answerType).toBe(AnswerResultType.WRONG);
        expect(result.answerResult.result).toBe(-price);
      });
    });

    it("leaves the ruling to the showman when the right answer is not an option", async () => {
      await suite.scenario(async (scenario) => {
        const { showmanSocket, playerSocket, gameId } = await buzzOnChoice("Something else");

        await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_SUBMITTED, () =>
          scenario
            .actor(playerSocket)
            .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "Option A" })
        );
        await scenario.waitForNoEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT, 500);
        expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.ANSWERING);
      });
    });
  });

  describe("Automatic special-question values", () => {
    it.each(
      [PackageQuestionType.NO_RISK, PackageQuestionType.STAKE].flatMap((type) =>
        [AnswerType.NUMBER, AnswerType.POINT].flatMap((answerType) =>
          [true, false].map((correct) => ({ type, answerType, correct }))
        )
      )
    )("uses the effective value for $type/$answerType (correct=$correct)", async (testCase) => {
      await suite.scenario(async (scenario) => {
        const { type, answerType, correct } = testCase;
        utils.packageTransform = (pkg) => {
          const question = pkg.rounds[0].themes
            .flatMap(({ questions }) => questions)
            .find((q) => q.type === type)!;
          question.answerType = answerType;
          if (answerType === AnswerType.NUMBER) question.answerNumber = 42;
          else question.answerPoint = { x: 0.5, y: 0.5 };
        };
        const { showmanSocket, playerSockets, playerUsers, gameId } =
          await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        await utils.startGame(showmanSocket);
        const isStake = type === PackageQuestionType.STAKE;
        if (isStake) {
          for (const player of playerUsers) await utils.setPlayerScore(gameId, player.id, 1000);
        }

        // Both special types belong to the picker: no-risk reserves the answer for them
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);
        const question = await utils.findQuestionByType(type, gameId);
        await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
        if (isStake) {
          await scenario.emitAndWaitForEvent(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT,
            () =>
              scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
                bidType: StakeBidType.NORMAL,
                bidAmount: 300
              })
          );
          await scenario.emitAndWaitForEvent(
            showmanSocket,
            SocketIOGameEvents.STAKE_QUESTION_WINNER,
            () =>
              scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
                bidType: StakeBidType.PASS,
                bidAmount: null
              })
          );
        } else {
          await utils.answerQuestion(playerSockets[0], showmanSocket);
        }
        const answerText =
          answerType === AnswerType.NUMBER ? (correct ? "42" : "7") : correct ? "0.5,0.5" : "0,0";
        const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () =>
            scenario
              .actor(playerSockets[0])
              .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText })
        );
        const change = correct ? (isStake ? 300 : 800) : isStake ? -300 : 0;
        expect(result.answerResult).toMatchObject({
          answerType: correct ? AnswerResultType.CORRECT : AnswerResultType.WRONG,
          result: change,
          score: (isStake ? 1000 : 0) + change
        });
        expect((await utils.getGameState(gameId))!.questionState).toBe(
          QuestionState.SHOWING_ANSWER
        );
      });
    });
  });

  describe("Number answers", () => {
    it("scores a number within the allowed deviation without the showman", async () => {
      await suite.scenario(async (scenario) => {
        utils.packageTransform = (pkg) => {
          const q = pkg.rounds[0].themes[0].questions.find(
            (x) => x.type === PackageQuestionType.SIMPLE
          )!;
          q.answerType = AnswerType.NUMBER;
          q.answerNumber = 42;
          q.answerDeviation = 2;
        };
        const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
          userRepo,
          app,
          1,
          0
        );
        await utils.startGame(showmanSocket);
        const question = await utils.findQuestionByType(PackageQuestionType.SIMPLE, gameId);
        await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const accepted = scenario
          .createAcceptedActionProbe({ gameId, actionType: GameActionType.ANSWER_SUBMITTED })
          .waitForCount(1);
        const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          () =>
            scenario
              .actor(playerSockets[0])
              .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "43" })
        );
        await accepted;
        await scenario.assert.waitForActionsComplete({ gameId });
        expect(result.answerResult.answerType).toBe(AnswerResultType.CORRECT);
        expect(result.answerResult.answerText).toBe("43");
        const state = await utils.getGameState(gameId);
        expect(state?.submittedAnswer).toBeNull();
        expect(state?.answerShowData).toMatchObject({ answerResult: { answerText: "43" } });
        utils.packageTransform = null;
      });
    });
  });

  it("persists point aspect through HTTP and scores the image-space circle through sockets", async () => {
    await suite.scenario(async (scenario) => {
      utils.packageTransform = (pkg) => {
        const q = pkg.rounds[0].themes[0].questions.find(
          (item) => item.type === PackageQuestionType.SIMPLE
        )!;
        q.answerType = AnswerType.POINT;
        q.answerPoint = { x: 0.5, y: 0.5, imageAspectRatio: 2 };
        q.answerDeviation = 0.1;
      };
      const { showmanSocket, playerSockets, spectatorSockets, gameId } =
        await utils.setupGameTestEnvironment(userRepo, app, 1, 1, true, 0, true);
      await utils.startGame(showmanSocket);
      const q = await utils.findQuestionByType(PackageQuestionType.SIMPLE, gameId);
      const stored = await userRepo.manager
        .getRepository(PackageQuestion)
        .findOneByOrFail({ id: q!.id });
      expect(stored.answer_point).toEqual({ x: 0.5, y: 0.5, imageAspectRatio: 2 });
      const hostData = scenario.waitForEvent<GameQuestionDataEventPayload>(
        showmanSocket,
        SocketIOGameEvents.QUESTION_DATA
      );
      const playerData = scenario.waitForEvent<GameQuestionDataEventPayload>(
        playerSockets[0],
        SocketIOGameEvents.QUESTION_DATA
      );
      const spectatorData = scenario.waitForEvent<GameQuestionDataEventPayload>(
        spectatorSockets[0],
        SocketIOGameEvents.QUESTION_DATA
      );
      await utils.pickQuestion(showmanSocket, q!.id, playerSockets);
      const [host, player, spectator] = await Promise.all([hostData, playerData, spectatorData]);
      expect(host.data).toMatchObject({ answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 } });
      expect(player.data).not.toHaveProperty("answerPoint");
      expect(spectator.data).not.toHaveProperty("answerPoint");
      await utils.answerQuestion(playerSockets[0], showmanSocket);
      const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
        showmanSocket,
        SocketIOGameEvents.ANSWER_RESULT,
        () =>
          scenario
            .actor(playerSockets[0])
            .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "0.500,0.680" })
      );
      expect(result.answerResult.answerType).toBe(AnswerResultType.CORRECT);
    });
  });

  async function setupChoiceOptions(optionCount: number, answerText?: string) {
    const { socket: showmanSocket, user, cookie } = await utils.createGameClient(app, userRepo);
    const packageInput = new PackageUtils().createTestPackageData(user);
    const question = packageInput.rounds
      .flatMap(({ themes }) => themes)
      .flatMap(({ questions }) => questions)
      .find(({ type }) => type === PackageQuestionType.CHOICE);
    if (!question) throw new Error("Choice fixture is missing its choice question");
    const expectedOptions = ["Option A", "Option B", "Option C", "Option D"]
      .slice(0, optionCount)
      .map((text, order) => ({ text, order }));
    question.answers = expectedOptions.map((option) => ({ ...option, file: null }));
    if (answerText !== undefined) question.answerText = answerText;

    const http = createHttpTestClient(suite.serverUrl);
    const packageResponse = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageInput })
      .expect(HttpStatus.OK);
    const gameResponse = await http
      .post("/v1/games")
      .set("Cookie", cookie)
      .send({
        title: "Choice options fixture",
        packageId: packageResponse.body.id,
        isPrivate: false,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        settings: INSTANT_BUZZER_SETTINGS
      } satisfies GameCreateDTO)
      .expect(HttpStatus.OK);
    const gameId: string = gameResponse.body.id;
    await utils.joinSpecificGame(showmanSocket, gameId, PlayerRole.SHOWMAN);
    const { socket: playerSocket } = await utils.createGameClient(app, userRepo);
    await utils.joinSpecificGame(playerSocket, gameId, PlayerRole.PLAYER);
    return { showmanSocket, playerSocket, gameId, expectedOptions };
  }
});
