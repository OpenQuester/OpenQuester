import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { GameStatistics } from "infrastructure/database/models/statistics/GameStatistics";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

describe("Game Statistics Persistence Tests", () => {
  let suite: SocketGameTestSuite;
  let _app: Express;
  let userRepo: Repository<User>;
  let gameStatsRepo: Repository<GameStatistics>;
  let playerGameStatsRepo: Repository<PlayerGameStats>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    _app = suite.app;
    userRepo = suite.userRepo;
    gameStatsRepo = suite.dataSource.getRepository(GameStatistics);
    playerGameStatsRepo = suite.dataSource.getRepository(PlayerGameStats);
    utils = suite.utils;
  });

  beforeEach(async () => {
    await deleteAll(playerGameStatsRepo);
    await deleteAll(gameStatsRepo);
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  it("should record statistics to database when game ends", async () => {
    const setup = await utils.setupGameTestEnvironment(userRepo, _app, 1, 0, false);
    const { showmanSocket, playerSockets } = setup;

    await utils.startGame(showmanSocket);
    await utils.progressToNextRound(showmanSocket);

    const gameFinishedPromise = utils.waitForEvent<boolean>(
      playerSockets[0],
      SocketIOGameEvents.GAME_FINISHED
    );
    showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});

    expect(await gameFinishedPromise).toBe(true);
    await utils.waitForActionsComplete(setup.gameId);
    await expectPersistedGameStatistics(gameStatsRepo);
  });

  it("should record statistics to database when game ends via answer result", async () => {
    // Setup game with 1 player
    const setup = await utils.setupGameTestEnvironment(userRepo, _app, 1, 0);
    const { showmanSocket, playerSockets } = setup;

    await utils.startGame(showmanSocket);
    await utils.progressToNextRound(showmanSocket);
    await utils.progressToNextRound(showmanSocket);

    const questionId = await utils.getFirstAvailableQuestionId(setup.gameId);
    await utils.pickQuestion(showmanSocket, questionId, playerSockets);

    const gameFinishedPromise = utils.waitForEvent<boolean>(
      playerSockets[0],
      SocketIOGameEvents.GAME_FINISHED
    );
    showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
      questionId,
      answerType: AnswerResultType.CORRECT,
      scoreResult: 100
    });

    expect(await gameFinishedPromise).toBe(true);
    await utils.waitForActionsComplete(setup.gameId);
    await expectPersistedGameStatistics(gameStatsRepo);
  });

  it("should record statistics to database when game ends via skip question force", async () => {
    // Setup game with 1 player
    const setup = await utils.setupGameTestEnvironment(userRepo, _app, 1, 0, false);
    const { showmanSocket, playerSockets, gameId } = setup;

    await utils.startGame(showmanSocket);

    await utils.progressToNextRound(showmanSocket);

    const gameFinishedPromise = utils.waitForEvent<boolean>(
      playerSockets[0],
      SocketIOGameEvents.GAME_FINISHED
    );
    let gameFinished = false;
    const markedGameFinishedPromise = gameFinishedPromise.then((data) => {
      gameFinished = true;
      return data;
    });

    while (!gameFinished) {
      const questionIds = await utils.getAllAvailableQuestionIds(gameId);
      if (questionIds.length === 0) {
        break;
      }

      await utils.pickAndCompleteQuestion(showmanSocket, playerSockets, questionIds[0], false);
    }

    expect(await markedGameFinishedPromise).toBe(true);
    await utils.waitForActionsComplete(gameId);
    await expectPersistedGameStatistics(gameStatsRepo);
  });
});

async function expectPersistedGameStatistics(
  gameStatsRepo: Repository<GameStatistics>
): Promise<void> {
  const savedStats = await gameStatsRepo.find();

  expect(savedStats.length).toBeGreaterThan(0);
  expect(savedStats[0].started_at).toBeDefined();
  expect(savedStats[0].finished_at).toBeDefined();
  expect(savedStats[0].duration).toBeGreaterThan(0);
  expect(savedStats[0].created_by).toBeDefined();
}
