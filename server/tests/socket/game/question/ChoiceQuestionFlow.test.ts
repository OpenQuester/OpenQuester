import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { HttpStatus } from "domain/enums/HttpStatus";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { PackageUtils } from "tests/utils/PackageUtils";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

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

  async function setupChoiceOptions(optionCount: number) {
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
        maxPlayers: 10
      } satisfies GameCreateDTO)
      .expect(HttpStatus.OK);
    const gameId: string = gameResponse.body.id;
    await utils.joinSpecificGame(showmanSocket, gameId, PlayerRole.SHOWMAN);
    const { socket: playerSocket } = await utils.createGameClient(app, userRepo);
    await utils.joinSpecificGame(playerSocket, gameId, PlayerRole.PLAYER);
    return { showmanSocket, playerSocket, gameId, expectedOptions };
  }
});
