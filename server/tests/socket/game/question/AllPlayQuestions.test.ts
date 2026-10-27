import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { AnswerType } from "domain/enums/package/AnswerType";
import { GameActionType } from "domain/enums/GameActionType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AllPlayMode } from "domain/types/dto/game/state/AllPlayDataDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import {
  AllPlayReviewEventPayload,
  AllPlayReviewingEventPayload,
  AllPlayStartEventPayload
} from "domain/types/socket/events/game/AllPlayEventPayloads";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { User } from "infrastructure/database/models/User";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { container } from "tsyringe";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { TestUtils } from "tests/utils/TestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import {
  GameClientSocket,
  SocketGameTestUtils
} from "tests/socket/game/utils/SocketIOGameTestUtils";

/**
 * "Everyone answers" questions (SIGame stakeAll / forAll): every player
 * answers in writing, the showman rules on each answer.
 */
describe("Everyone-answers questions", () => {
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

  function forEveryone(type: PackageQuestionType) {
    utils.packageTransform = (pkg) => {
      const question = pkg.rounds
        .flatMap(({ themes }) => themes)
        .flatMap(({ questions }) => questions)
        .find((q) => q.type === type)!;
      question.subType = PackageQuestionSubType.FOR_EVERYONE;
    };
  }

  /** Both players type an answer; returns the review-start payload */
  async function answerAll(
    scenario: GameScenario,
    showman: GameClientSocket,
    players: GameClientSocket[],
    answers: string[]
  ): Promise<AllPlayReviewingEventPayload> {
    const reviewing = scenario.waitForEvent<AllPlayReviewingEventPayload>(
      showman,
      SocketIOGameEvents.ALL_PLAY_REVIEWING
    );
    for (const [i, socket] of players.entries()) {
      await scenario.emitAndWaitForEvent(showman, SocketIOGameEvents.ALL_PLAY_ANSWER, () =>
        scenario.actor(socket).emit(SocketIOGameEvents.ALL_PLAY_ANSWER, { answerText: answers[i] })
      );
    }
    return reviewing;
  }

  async function review(
    scenario: GameScenario,
    showman: GameClientSocket,
    playerId: number,
    isCorrect: boolean
  ): Promise<AllPlayReviewEventPayload> {
    return scenario.emitAndWaitForEvent<AllPlayReviewEventPayload>(
      showman,
      SocketIOGameEvents.ALL_PLAY_REVIEW,
      () =>
        scenario.actor(showman).emit(SocketIOGameEvents.ALL_PLAY_REVIEW, { playerId, isCorrect })
    );
  }

  async function expectSavedStats(
    scenario: GameScenario,
    showman: GameClientSocket,
    gameId: string,
    players: User[],
    scores: number[]
  ): Promise<void> {
    await utils.progressToNextRound(showman);
    expect(
      await scenario.emitAndWaitForEvent<boolean>(showman, SocketIOGameEvents.GAME_FINISHED, () =>
        scenario.actor(showman).emit(SocketIOGameEvents.NEXT_ROUND, {})
      )
    ).toBe(true);
    await scenario.assert.waitForActionsComplete({ gameId });
    const repository = suite.dataSource.getRepository(PlayerGameStats);
    for (const [index, player] of players.entries()) {
      expect(await repository.findOneByOrFail({ user_id: player.id })).toMatchObject({
        final_score: scores[index],
        placement: index + 1,
        questions_answered: 1,
        correct_answers: index === 0 ? 1 : 0,
        wrong_answers: index === 0 ? 0 : 1
      });
    }
  }

  it("no-risk for everyone: everyone answers, right wins price × multiplier, wrong costs nothing", async () => {
    await suite.scenario(async (scenario) => {
      forEveryone(PackageQuestionType.NO_RISK);
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId);

      const start = scenario.waitForEvent<AllPlayStartEventPayload>(
        playerSockets[0],
        SocketIOGameEvents.ALL_PLAY_START
      );
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
      expect(await start).toMatchObject({
        mode: AllPlayMode.NO_RISK,
        players: playerUsers.map((u) => u.id).sort((a, b) => a - b),
        timer: null
      });

      // There's no buzzer
      await scenario.emitAndWaitForEvent(playerSockets[0], SocketIOEvents.ERROR, () =>
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER)
      );

      const reviewing = await answerAll(scenario, showmanSocket, playerSockets, [
        "No risk answer",
        "Something"
      ]);
      expect(reviewing.allPlay.entries.map((e) => e.answer)).toEqual(
        expect.arrayContaining(["No risk answer", "Something"])
      );
      expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.REVIEWING);

      const right = await review(scenario, showmanSocket, playerUsers[0].id, true);
      expect(right.scoreChange).toBe(800);
      expect(right.newScore).toBe(800);

      const finish = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.QUESTION_FINISH);
      const wrong = await review(scenario, showmanSocket, playerUsers[1].id, false);
      expect(wrong.scoreChange).toBe(0);
      await finish;

      expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.SHOWING_ANSWER);

      // Rulings count in player statistics like buzzer answers do
      const statsRepository = container.resolve(PlayerGameStatsRepository);
      expect(await statsRepository.getStats(gameId, playerUsers[0].id)).toMatchObject({
        questionsAnswered: "1",
        correctAnswers: "1",
        currentScore: "800"
      });
      expect(await statsRepository.getStats(gameId, playerUsers[1].id)).toMatchObject({
        questionsAnswered: "1",
        wrongAnswers: "1"
      });
      await expectSavedStats(scenario, showmanSocket, gameId, playerUsers, [800, 0]);
    });
  });

  it("reveals the answer right away when every answer was judged automatically", async () => {
    await suite.scenario(async (scenario) => {
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds
          .flatMap(({ themes }) => themes)
          .flatMap(({ questions }) => questions)
          .find((q) => q.type === PackageQuestionType.NO_RISK)!;
        question.subType = PackageQuestionSubType.FOR_EVERYONE;
        question.answerType = AnswerType.NUMBER;
        question.answerNumber = 42;
      };
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId);
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);

      // A number answer is judged by the server, so nothing is left for the showman
      const finish = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.QUESTION_FINISH);
      await answerAll(scenario, showmanSocket, playerSockets, ["42", "7"]);
      await finish;

      expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.SHOWING_ANSWER);
      await expectSavedStats(scenario, showmanSocket, gameId, playerUsers, [800, 0]);
    });
  });

  it("judges everyone-answer points using the persisted image aspect", async () => {
    await suite.scenario(async (scenario) => {
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds.flatMap(({ themes }) => themes).flatMap(({ questions }) => questions).find((q) => q.type === PackageQuestionType.NO_RISK)!;
        question.subType = PackageQuestionSubType.FOR_EVERYONE;
        question.answerType = AnswerType.POINT;
        question.answerPoint = { x: 0.5, y: 0.5, imageAspectRatio: 2 };
        question.answerDeviation = 0.1;
      };
      const { showmanSocket, playerSockets, playerUsers, gameId } = await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId);
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
      const finish = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.QUESTION_FINISH);
      await answerAll(scenario, showmanSocket, playerSockets, ["0.500,0.680", "0.500,0.701"]);
      await finish;
      expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.SHOWING_ANSWER);
      await expectSavedStats(scenario, showmanSocket, gameId, playerUsers, [800, 0]);
    });
  });

  it("persists automatic and missing-answer rulings after the everyone-answer timer expires", async () => {
    await suite.scenario(async (scenario) => {
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds
          .flatMap(({ themes }) => themes)
          .flatMap(({ questions }) => questions)
          .find((q) => q.type === PackageQuestionType.NO_RISK)!;
        question.subType = PackageQuestionSubType.FOR_EVERYONE;
        question.answerType = AnswerType.NUMBER;
        question.answerNumber = 42;
      };
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId);
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);
      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ALL_PLAY_ANSWER, () =>
        scenario
          .actor(playerSockets[0])
          .emit(SocketIOGameEvents.ALL_PLAY_ANSWER, { answerText: "42" })
      );
      const testUtils = new TestUtils(app, userRepo, suite.serverUrl);
      await scenario.runAndWaitForEvent(showmanSocket, SocketIOGameEvents.QUESTION_FINISH, () =>
        testUtils.expireTimerAndWaitForAction(gameId, GameActionType.TIMER_QUESTION_SHOWING_EXPIRED)
      );
      expect((await utils.getGameState(gameId))!.allPlay?.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ playerId: playerUsers[0].id, isCorrect: true }),
          expect.objectContaining({
            playerId: playerUsers[1].id,
            submitted: false,
            isCorrect: false
          })
        ])
      );
      await expectSavedStats(scenario, showmanSocket, gameId, playerUsers, [800, 0]);
    });
  });

  it("reveals the answer when every player times out without submitting", async () => {
    await suite.scenario(async (scenario) => {
      forEveryone(PackageQuestionType.NO_RISK);
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId);
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);

      await scenario.runAndWaitForEvent(showmanSocket, SocketIOGameEvents.QUESTION_FINISH, () =>
        suite.testUtils.expireTimerAndWaitForAction(
          gameId,
          GameActionType.TIMER_QUESTION_SHOWING_EXPIRED
        )
      );
      const state = (await utils.getGameState(gameId))!;
      expect(state.questionState).toBe(QuestionState.SHOWING_ANSWER);
      expect(state.allPlay?.entries).toHaveLength(2);
      expect(state.allPlay?.entries).toEqual(
        expect.arrayContaining(
          playerUsers.map(({ id }) =>
            expect.objectContaining({ playerId: id, submitted: false, isCorrect: false })
          )
        )
      );
      expect(state.timer).not.toBeNull();
    });
  });

  it("stake for everyone: hidden stakes, then right wins the stake and wrong loses it", async () => {
    await suite.scenario(async (scenario) => {
      forEveryone(PackageQuestionType.STAKE);
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.STAKE, gameId);

      const start = await scenario.emitAndWaitForEvent<AllPlayStartEventPayload>(
        playerSockets[0],
        SocketIOGameEvents.ALL_PLAY_START,
        () =>
          scenario
            .actor(showmanSocket)
            .emit(SocketIOGameEvents.QUESTION_PICK, { questionId: question!.id })
      );
      expect(start.mode).toBe(AllPlayMode.STAKE);
      expect(start.timer).not.toBeNull();
      expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.BIDDING);

      // Scores are 0, so the most anyone may stake is the price (200)
      await scenario.emitAndWaitForEvent(playerSockets[0], SocketIOEvents.ERROR, () =>
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ALL_PLAY_STAKE, { amount: 500 })
      );

      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ALL_PLAY_STAKE, () =>
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ALL_PLAY_STAKE, { amount: 150 })
      );
      const questionData = scenario.waitForEvent(
        playerSockets[1],
        SocketIOGameEvents.QUESTION_DATA
      );
      scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.ALL_PLAY_STAKE, { amount: 200 });
      await questionData;
      expect((await utils.getGameState(gameId))!.questionState).toBe(
        QuestionState.MEDIA_DOWNLOADING
      );

      const showing = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
        showmanSocket,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        (status) => status.allPlayersReady
      );
      for (const socket of playerSockets) {
        scenario.actor(socket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
      }
      await showing;

      const reviewing = await answerAll(scenario, showmanSocket, playerSockets, ["A", "B"]);
      const stakes = Object.fromEntries(
        reviewing.allPlay.entries.map((e) => [e.playerId, e.stake])
      );
      expect(stakes).toEqual({ [playerUsers[0].id]: 150, [playerUsers[1].id]: 200 });

      expect((await review(scenario, showmanSocket, playerUsers[0].id, true)).newScore).toBe(150);
      expect((await review(scenario, showmanSocket, playerUsers[1].id, false)).newScore).toBe(-200);
      await expectSavedStats(scenario, showmanSocket, gameId, playerUsers, [150, -200]);
    });
  });

  it("everyone answers: the review starts when the last player still answering leaves", async () => {
    await suite.scenario(async (scenario) => {
      forEveryone(PackageQuestionType.NO_RISK);
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId);
      await utils.pickQuestion(showmanSocket, question!.id, playerSockets);

      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ALL_PLAY_ANSWER, () =>
        scenario
          .actor(playerSockets[0])
          .emit(SocketIOGameEvents.ALL_PLAY_ANSWER, { answerText: "Answered before" })
      );

      // Nobody else is left to answer: no need to wait for the answer timer
      const reviewing = scenario.waitForEvent<AllPlayReviewingEventPayload>(
        showmanSocket,
        SocketIOGameEvents.ALL_PLAY_REVIEWING
      );
      await utils.leaveGame(playerSockets[1]);
      const review = await reviewing;

      expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.REVIEWING);
      expect(review.allPlay.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ playerId: playerUsers[0].id, answer: "Answered before" })
        ])
      );
    });
  });

  it("stake for everyone: the question starts when the last player still staking leaves", async () => {
    await suite.scenario(async (scenario) => {
      forEveryone(PackageQuestionType.STAKE);
      const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        2,
        0,
        false
      );
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.STAKE, gameId);
      await scenario.emitAndWaitForEvent(playerSockets[0], SocketIOGameEvents.ALL_PLAY_START, () =>
        scenario
          .actor(showmanSocket)
          .emit(SocketIOGameEvents.QUESTION_PICK, { questionId: question!.id })
      );

      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ALL_PLAY_STAKE, () =>
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ALL_PLAY_STAKE, { amount: 150 })
      );

      // The only stake still missing belongs to the player who leaves
      const questionData = scenario.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.QUESTION_DATA
      );
      await utils.leaveGame(playerSockets[1]);
      await questionData;

      expect((await utils.getGameState(gameId))!.questionState).toBe(
        QuestionState.MEDIA_DOWNLOADING
      );
    });
  });
});
