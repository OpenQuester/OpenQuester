import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { Repository } from "typeorm";

import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TestUtils } from "tests/utils/TestUtils";

describe("Empty game deletion on last user exit", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let socketUtils: SocketGameTestUtils;
  let testUtils: TestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    socketUtils = suite.utils;
    testUtils = suite.testUtils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  const expectGameRemovedFromLobbyIndexes = async (gameId: string): Promise<void> => {
    const { cookie } = await testUtils.createAndLoginUser(`lobby-index-${gameId}`);
    const listRes = await createHttpTestClient(suite.serverUrl)
      .get("/v1/games")
      .set("Cookie", cookie)
      .query({ limit: 10, offset: 0 });

    expect(listRes.status).toBe(200);
    expect(listRes.body.pageInfo.total).toBe(0);
    expect(listRes.body.data).toEqual([]);
  };

  const expectGameEntityDeleted = async (gameId: string): Promise<void> => {
    const gameLookup = testUtils.getGameEntity(gameId);

    await expect(gameLookup).rejects.toBeInstanceOf(ClientError);
    await expect(gameLookup).rejects.toThrow(ClientResponse.GAME_NOT_FOUND);
  };

  it("should delete game when last user disconnects before game start", async () => {
    await suite.scenario(async () => {
      const setup = await socketUtils.setupGameTestEnvironment(userRepo, app, 0, 0);
      const { gameId, showmanSocket } = setup;

      await socketUtils.disconnectAndCleanup(showmanSocket);

      await expectGameEntityDeleted(gameId);
      await expectGameRemovedFromLobbyIndexes(gameId);
    });
  });

  it("should delete game when last user disconnects after game is finished", async () => {
    await suite.scenario(async () => {
      const setup = await socketUtils.setupGameTestEnvironment(userRepo, app, 0, 0);
      const { gameId, showmanSocket } = setup;

      const game = await testUtils.getGameEntity(gameId);
      game.startedAt = new Date();
      game.finish();
      await testUtils.updateGame(game);

      await socketUtils.disconnectAndCleanup(showmanSocket);

      await expectGameEntityDeleted(gameId);
      await expectGameRemovedFromLobbyIndexes(gameId);
    });
  });

  it("should delete game when last user leaves before game start", async () => {
    await suite.scenario(async () => {
      const setup = await socketUtils.setupGameTestEnvironment(userRepo, app, 0, 0);
      const { gameId, showmanSocket } = setup;

      await socketUtils.leaveGame(showmanSocket);

      await expectGameEntityDeleted(gameId);
      await expectGameRemovedFromLobbyIndexes(gameId);
    });
  });

  it("should delete game when last user leaves after game is finished", async () => {
    await suite.scenario(async () => {
      const setup = await socketUtils.setupGameTestEnvironment(userRepo, app, 0, 0);
      const { gameId, showmanSocket } = setup;

      const game = await testUtils.getGameEntity(gameId);
      game.startedAt = new Date();
      game.finish();
      await testUtils.updateGame(game);

      await socketUtils.leaveGame(showmanSocket);

      await expectGameEntityDeleted(gameId);
      await expectGameRemovedFromLobbyIndexes(gameId);
    });
  });
});
