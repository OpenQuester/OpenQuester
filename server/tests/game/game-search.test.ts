import { performance } from "node:perf_hooks";
import { container } from "tsyringe";

import { GAME_INDEX_CREATED_AT_KEY } from "domain/constants/game";
import { gameKey } from "domain/constants/redisKeys";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameStatusFilter } from "domain/enums/game/GameStatusFilter";
import { type GameIndexesInputDTO } from "domain/types/dto/game/GameIndexesInputDTO";
import { type GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { type GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
import { GameIndexManager } from "infrastructure/database/managers/game/GameIndexManager";
import { Package } from "infrastructure/database/models/package/Package";
import { User } from "infrastructure/database/models/User";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { DI_TOKENS } from "shared/di/tokens";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { PackageUtils } from "tests/utils/PackageUtils";
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

describe("Game title search", () => {
  let harness: ServerTestHarness;
  let http: HttpTestClient;
  let index: GameIndexManager;
  let redis: RedisRepository;

  beforeAll(async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    index = container.resolve<GameIndexManager>(DI_TOKENS.GameIndexManager);
    redis = container.resolve(RedisRepository);
  });

  beforeEach(() => {
    http = createHttpTestClient(harness.serverUrl);
  });

  afterEach(async () => {
    if (!harness) {
      return;
    }

    await deleteAll(harness.dataSource.getRepository(Package));
    await deleteAll(harness.dataSource.getRepository(User));
    await harness.resetState();
  });

  afterAll(async () => {
    await harness?.stop();
  });

  async function addToIndex(games: GameIndexesInputDTO[]): Promise<void> {
    const pipeline = redis.pipeline();
    for (const game of games) {
      index.addGameToIndexesPipeline(pipeline, game);
    }
    await pipeline.exec();
  }

  const pagination: GamePaginationOpts = {
    sortBy: "createdAt",
    order: PaginationOrder.ASC,
    limit: 10,
    offset: 0
  };

  it("paginates the permanent creation index directly when no filter is applied", async () => {
    await addToIndex([
      { id: "ZZZZ", title: "Oldest game", isPrivate: false, createdAt: new Date(1000) },
      { id: "AAAA", title: "Newest game", isPrivate: true, createdAt: new Date(2000) }
    ]);
    const copyIndex = jest.spyOn(redis, "zinterstore");
    const removeKeys = jest.spyOn(redis, "delMultiple");

    try {
      expect(await index.findGamesByIndex({}, { ...pagination, limit: 1 })).toEqual({
        ids: ["ZZZZ"],
        total: 2
      });
      expect(
        await index.findGamesByIndex(
          { titlePrefix: "" },
          { ...pagination, order: PaginationOrder.DESC, limit: 1 }
        )
      ).toEqual({ ids: ["AAAA"], total: 2 });
      expect(copyIndex).not.toHaveBeenCalled();
      expect(removeKeys).not.toHaveBeenCalled();
      expect(await redis.pipeline().ttl(GAME_INDEX_CREATED_AT_KEY).exec()).toEqual([[null, -1]]);
    } finally {
      copyIndex.mockRestore();
      removeKeys.mockRestore();
    }
  });

  it.each([false, true])(
    "removes temporary indexes after pagination settles (failure: %s)",
    async (failPagination) => {
      await addToIndex([
        { id: "TEST", title: "Match game", isPrivate: false, createdAt: new Date(2000) }
      ]);
      const paginationError = new Error("Controlled pagination failure");
      const originalRange = redis.zrange.bind(redis);
      const readPage = jest.spyOn(redis, "zrange");
      const removeKeys = jest.spyOn(redis, "delMultiple");

      if (failPagination) {
        readPage.mockRejectedValueOnce(paginationError);
      } else {
        readPage.mockImplementationOnce(async (key, start, stop) => {
          // A real Redis round trip exposes cleanup that runs before pagination finishes.
          const temporaryKeys = [key, `${key}:title`, `${key}:createdAt`];
          const state = await redis
            .pipeline()
            .exists(...temporaryKeys)
            .ttl(key)
            .exec();
          expect(state?.[0]).toEqual([null, 3]);
          expect(state?.[1][1]).toBeGreaterThan(0);
          return originalRange(key, start, stop);
        });
      }

      try {
        const result = index.findGamesByIndex(
          {
            titlePrefix: "Match",
            isPrivate: false,
            createdAtMin: new Date(1000),
            createdAtMax: new Date(3000)
          },
          pagination
        );

        if (failPagination) {
          await expect(result).rejects.toBe(paginationError);
        } else {
          await expect(result).resolves.toEqual({ ids: ["TEST"], total: 1 });
        }

        expect(removeKeys).toHaveBeenCalledTimes(1);
        const temporaryKeys = removeKeys.mock.calls[0][0];
        const state = await redis
          .pipeline()
          .exists(...temporaryKeys)
          .ttl(GAME_INDEX_CREATED_AT_KEY)
          .exec();
        expect(state).toEqual([
          [null, 0],
          [null, -1]
        ]);
      } finally {
        readPage.mockRestore();
        removeKeys.mockRestore();
      }
    }
  );

  it("cleans a partially prepared title filter when its expiry command fails", async () => {
    await addToIndex([
      { id: "TEST", title: "Match game", isPrivate: false, createdAt: new Date(2000) }
    ]);
    const expiryError = new Error("Controlled filter expiry failure");
    const expireKey = jest.spyOn(redis, "expire").mockRejectedValueOnce(expiryError);
    const removeKeys = jest.spyOn(redis, "delMultiple");

    try {
      await expect(index.findGamesByIndex({ titlePrefix: "Match" }, pagination)).rejects.toBe(
        expiryError
      );
      expect(removeKeys).toHaveBeenCalledTimes(1);
      const temporaryKeys = removeKeys.mock.calls[0][0];
      expect(
        await redis
          .pipeline()
          .exists(...temporaryKeys)
          .exec()
      ).toEqual([[null, 0]]);
    } finally {
      expireKey.mockRestore();
      removeKeys.mockRestore();
    }
  });

  it.each([
    { title: "ГраКиїв", prefix: "гРа" },
    { title: "Quiz🎯", prefix: "qUiZ" },
    { title: "Quiz: evening: finals", prefix: "quiz" },
    { title: "Quiz[*]? evening", prefix: "quiz[*]?" }
  ])("matches the literal case-insensitive prefix $prefix in $title", async ({ title, prefix }) => {
    await addToIndex([
      { id: "TEST", title, isPrivate: false, createdAt: new Date(2000) },
      { id: "OTHER", title: `Other ${title}`, isPrivate: false, createdAt: new Date(1000) }
    ]);

    expect(await index.findGamesByIndex({ titlePrefix: prefix }, pagination)).toEqual({
      ids: ["TEST"],
      total: 1
    });
  });

  it("does not match a prefix against the title and ID separator", async () => {
    const matching = {
      id: "EVEN",
      title: "Quiz: evening",
      isPrivate: false,
      createdAt: new Date(2000)
    };
    await addToIndex([
      { id: "TEST", title: "Quiz", isPrivate: false, createdAt: new Date(1000) },
      matching
    ]);
    const filters = { titlePrefix: "quiz:", isPrivate: false };

    expect(await index.findGamesByIndex(filters, pagination)).toEqual({
      ids: ["EVEN"],
      total: 1
    });

    await index.removeGameFromIndexes(matching.id, matching);
    expect(await index.findGamesByIndex(filters, pagination)).toEqual({ ids: [], total: 0 });
  });

  it("combines status and indexed filters before pagination across candidate batches", async () => {
    const lobbyIds = new Set(["G000", "G201", "G203"]);
    const playingIds = new Set(["G001", "G202", "G204"]);
    const games = Array.from({ length: 205 }, (_, index) => ({
      id: `G${String(index).padStart(3, "0")}`,
      title: index === 204 ? "Different game" : "ПошукКиїв: test",
      isPrivate: index === 203,
      createdAt: new Date(1000 + index)
    }));
    await addToIndex(games);
    const lifecycle = redis.pipeline();
    for (const game of games) {
      lifecycle.hset(gameKey(game.id), {
        startedAt: lobbyIds.has(game.id) ? "" : "1000",
        finishedAt: lobbyIds.has(game.id) || playingIds.has(game.id) ? "" : "2000"
      });
    }
    await lifecycle.exec();
    const newestFirst = { ...pagination, order: PaginationOrder.DESC, limit: 50 };
    const firstPage = await index.findGamesByIndex({}, newestFirst);
    expect(firstPage.ids).not.toContain("G000");
    expect(firstPage.ids).not.toContain("G001");

    for (const status of Object.values(GameStatusFilter)) {
      const filters = {
        titlePrefix: "пОшУк",
        isPrivate: false,
        createdAtMin: new Date(500),
        createdAtMax: new Date(2000),
        status
      };
      const expectedIds = status === GameStatusFilter.LOBBY ? ["G201", "G000"] : ["G202", "G001"];
      expect(await index.findGamesByIndex(filters, newestFirst)).toEqual({
        ids: expectedIds,
        total: 2
      });
      expect(
        await index.findGamesByIndex(filters, { ...newestFirst, limit: 1, offset: 1 })
      ).toEqual({ ids: [expectedIds[1]], total: 2 });
      expect(
        await index.findGamesByIndex({ status }, { ...newestFirst, limit: 1, offset: 1 })
      ).toEqual({ ids: [expectedIds[0]], total: 3 });
    }
  });

  it("reads current lifecycle fields on every status query and excludes missing game hashes", async () => {
    await addToIndex([
      { id: "LIVE", title: "Match game", isPrivate: false, createdAt: new Date(1000) },
      { id: "LOST", title: "Match deleted", isPrivate: false, createdAt: new Date(2000) }
    ]);
    await redis.hset(gameKey("LIVE"), { startedAt: "", finishedAt: "" });
    const lobby = { titlePrefix: "Match", status: GameStatusFilter.LOBBY };
    const playing = { titlePrefix: "Match", status: GameStatusFilter.PLAYING };
    expect(await index.findGamesByIndex(lobby, pagination)).toEqual({ ids: ["LIVE"], total: 1 });
    expect(await index.findGamesByIndex(playing, pagination)).toEqual({ ids: [], total: 0 });

    await redis.hset(gameKey("LIVE"), { startedAt: "1000" });
    expect(await index.findGamesByIndex(lobby, pagination)).toEqual({ ids: [], total: 0 });
    expect(await index.findGamesByIndex(playing, pagination)).toEqual({ ids: ["LIVE"], total: 1 });

    await redis.hset(gameKey("LIVE"), { finishedAt: "2000" });
    expect(await index.findGamesByIndex(lobby, pagination)).toEqual({ ids: [], total: 0 });
    expect(await index.findGamesByIndex(playing, pagination)).toEqual({ ids: [], total: 0 });
    expect(await index.findGamesByIndex({ titlePrefix: "Match" }, pagination)).toEqual({
      ids: ["LIVE", "LOST"],
      total: 2
    });
  });

  it.each([0, 16_000])(
    "bounds exact candidate batches and renews the snapshot only when due (batch time: %s ms)",
    async (batchTimeMs) => {
      const games = Array.from({ length: 400 }, (_, gameIndex) => ({
        id: `G${String(gameIndex).padStart(3, "0")}`,
        title: "Match game",
        isPrivate: false,
        createdAt: new Date(1000 + gameIndex)
      }));
      await addToIndex(games);
      const lifecycle = redis.pipeline();
      for (const game of games) {
        lifecycle.hset(gameKey(game.id), { startedAt: "", finishedAt: "" });
      }
      await lifecycle.exec();

      let elapsedMs = 0;
      let expiresAtMs = Infinity;
      const clock = jest.spyOn(performance, "now").mockImplementation(() => elapsedMs);
      const originalExpire = redis.expire.bind(redis);
      const expireKey = jest.spyOn(redis, "expire").mockImplementation(async (key, ttlSeconds) => {
        expiresAtMs = elapsedMs + ttlSeconds * 1000;
        return originalExpire(key, ttlSeconds);
      });
      const originalRange = redis.zrange.bind(redis);
      const readRange = jest.spyOn(redis, "zrange").mockImplementation(async (key, start, stop) => {
        // Model Redis expiry against the controlled clock without sleeping.
        if (elapsedMs >= expiresAtMs) {
          await redis.del(key);
        }
        const ids = await originalRange(key, start, stop);
        if (stop - start + 1 === 200) {
          elapsedMs += batchTimeMs;
        }
        return ids;
      });

      try {
        expect(
          await index.findGamesByIndex(
            { status: GameStatusFilter.LOBBY },
            { ...pagination, offset: 399, limit: 1 }
          )
        ).toEqual({ ids: ["G399"], total: 400 });
        expect(readRange).toHaveBeenCalledTimes(3); // Two candidate batches and one page.
        expect(expireKey).toHaveBeenCalledTimes(batchTimeMs === 0 ? 1 : 2);
      } finally {
        readRange.mockRestore();
        expireKey.mockRestore();
        clock.mockRestore();
      }
    }
  );

  it("rejects a disappeared status snapshot instead of returning an empty result", async () => {
    await addToIndex([
      { id: "TEST", title: "Match game", isPrivate: false, createdAt: new Date(1000) }
    ]);
    const originalRange = redis.zrange.bind(redis);
    const readCandidates = jest
      .spyOn(redis, "zrange")
      .mockImplementationOnce(async (key, start, stop) => {
        await redis.del(key);
        return originalRange(key, start, stop);
      });

    try {
      await expect(
        index.findGamesByIndex({ status: GameStatusFilter.LOBBY }, pagination)
      ).rejects.toThrow("temporary index is missing candidates");
      expect(await redis.zcard(GAME_INDEX_CREATED_AT_KEY)).toBe(1);
    } finally {
      readCandidates.mockRestore();
    }
  });

  it("excludes a game deleted between reading candidates and lifecycle fields", async () => {
    await addToIndex([
      { id: "LIVE", title: "Match game", isPrivate: false, createdAt: new Date(1000) },
      { id: "LOST", title: "Match deleted", isPrivate: false, createdAt: new Date(2000) }
    ]);
    await redis.hset(gameKey("LIVE"), { startedAt: "", finishedAt: "" });
    await redis.hset(gameKey("LOST"), { startedAt: "", finishedAt: "" });
    const originalRange = redis.zrange.bind(redis);
    const readCandidates = jest
      .spyOn(redis, "zrange")
      .mockImplementationOnce(async (key, start, stop) => {
        const ids = await originalRange(key, start, stop);
        expect(ids).toEqual(["LIVE", "LOST"]);
        await redis.del(gameKey("LOST"));
        return ids;
      });

    try {
      expect(await index.findGamesByIndex({ status: GameStatusFilter.LOBBY }, pagination)).toEqual({
        ids: ["LIVE"],
        total: 1
      });
      expect(await redis.hmget(gameKey("LOST"), ["startedAt", "finishedAt"])).toEqual([null, null]);
    } finally {
      readCandidates.mockRestore();
    }
  });

  it("propagates status pipeline command errors and removes its temporary index", async () => {
    await addToIndex([
      { id: "TEST", title: "Match game", isPrivate: false, createdAt: new Date(1000) }
    ]);
    await redis.pipeline().set(gameKey("TEST"), "not a game hash").exec();
    const removeKeys = jest.spyOn(redis, "delMultiple");

    try {
      await expect(
        index.findGamesByIndex({ titlePrefix: "Match", status: GameStatusFilter.LOBBY }, pagination)
      ).rejects.toThrow("WRONGTYPE");
      expect(removeKeys).toHaveBeenCalledTimes(1);
      const temporaryKeys = removeKeys.mock.calls[0][0];
      expect(
        await redis
          .pipeline()
          .exists(...temporaryKeys)
          .exec()
      ).toEqual([[null, 0]]);
      expect(await redis.zcard(GAME_INDEX_CREATED_AT_KEY)).toBe(1);
    } finally {
      removeKeys.mockRestore();
    }
  });

  it("keeps an unmatched title filter when combined with privacy and dates", async () => {
    await addToIndex([
      { id: "TEST", title: "Existing game", isPrivate: false, createdAt: new Date(2000) }
    ]);

    for (const filters of [
      { titlePrefix: "Missing" },
      { titlePrefix: "Missing", isPrivate: false },
      { titlePrefix: "Missing", status: GameStatusFilter.LOBBY },
      { titlePrefix: "Missing", createdAtMin: new Date(1000), createdAtMax: new Date(3000) },
      { titlePrefix: "Missing", isPrivate: false, createdAtMin: new Date(1000) }
    ]) {
      expect(await index.findGamesByIndex(filters, pagination)).toEqual({ ids: [], total: 0 });
    }
  });

  it("preserves chronological ordering and totals through composed filters and pagination", async () => {
    await addToIndex([
      { id: "ZZZZ", title: "Match oldest", isPrivate: false, createdAt: new Date(1000) },
      { id: "AAAA", title: "Match middle", isPrivate: false, createdAt: new Date(2000) },
      { id: "MMMM", title: "Match newest", isPrivate: false, createdAt: new Date(3000) },
      { id: "PRIV", title: "Match private", isPrivate: true, createdAt: new Date(2500) },
      { id: "DIFF", title: "Different game", isPrivate: false, createdAt: new Date(1500) }
    ]);

    const filters = {
      titlePrefix: "Match",
      isPrivate: false,
      createdAtMin: new Date(500),
      createdAtMax: new Date(3500)
    };
    expect(await index.findGamesByIndex(filters, { ...pagination, limit: 2 })).toEqual({
      ids: ["ZZZZ", "AAAA"],
      total: 3
    });
    expect(await index.findGamesByIndex(filters, { ...pagination, limit: 2, offset: 2 })).toEqual({
      ids: ["MMMM"],
      total: 3
    });
    expect(
      await index.findGamesByIndex(filters, { ...pagination, order: PaginationOrder.DESC })
    ).toEqual({ ids: ["MMMM", "AAAA", "ZZZZ"], total: 3 });
    expect(await index.findGamesByIndex(filters, { ...pagination, offset: 3 })).toEqual({
      ids: [],
      total: 3
    });
  });

  it("refreshes title and privacy matches when indexes are updated and removed", async () => {
    const previous = {
      id: "TEST",
      title: "Old title",
      isPrivate: false,
      createdAt: new Date(2000)
    };
    const next = { ...previous, title: "Нова🎯: гра", isPrivate: true };
    await addToIndex([previous]);
    const update = redis.pipeline();
    index.updateGameIndexesPipeline(update, previous, next);
    await update.exec();

    expect(
      await index.findGamesByIndex({ titlePrefix: "Old", isPrivate: false }, pagination)
    ).toEqual({ ids: [], total: 0 });
    expect(
      await index.findGamesByIndex({ titlePrefix: "нОвА", isPrivate: true }, pagination)
    ).toEqual({ ids: ["TEST"], total: 1 });
    expect(
      await index.findGamesByIndex({ titlePrefix: "нОвА", isPrivate: false }, pagination)
    ).toEqual({ ids: [], total: 0 });

    const remove = redis.pipeline();
    index.removeGameFromIndexesPipeline(remove, next.id, next);
    await remove.exec();
    expect(await index.findGamesByIndex({ titlePrefix: "нОвА" }, pagination)).toEqual({
      ids: [],
      total: 0
    });
  });

  it("combines title and status before HTTP pagination and removes deleted matches", async () => {
    await http
      .get("/v1/games")
      .query({ ...pagination, status: "finished" })
      .expect(400);
    const users = harness.dataSource.getRepository(User);
    const user = await users.save(
      users.create({ username: "search_host", email: "search@test.com", is_deleted: false })
    );
    const login = await http.post("/v1/test/login").send({ userId: user.id }).expect(200);
    const cookie = login.headers["set-cookie"];
    const packageResponse = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: new PackageUtils().createTestPackageData(user, false) })
      .expect(200);
    const createGame = async (title: string): Promise<GameListItemDTO> => {
      const response = await http
        .post("/v1/games")
        .set("Cookie", cookie)
        .send({
          title,
          packageId: packageResponse.body.id,
          isPrivate: false,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 5
        })
        .expect(200);
      return response.body;
    };
    const matching = await createGame("ПошукКиїв: вечір 🎯");
    await createGame("Інша гра");
    const query = { ...pagination, titlePrefix: "пОшУк", isPrivate: false };
    const list = await http.get("/v1/games").query(query).expect(200);
    expect(list.body.data.map((game: GameListItemDTO) => game.id)).toEqual([matching.id]);
    expect(list.body.data[0].title).toBe(matching.title);
    expect(list.body.pageInfo.total).toBe(1);

    const playing = await createGame("ПошукКиїв: playing");
    await redis.hset(gameKey(playing.id), { startedAt: "1000" });
    for (let index = 0; index < 51; index++) {
      const finished = await createGame(`ПошукКиїв: finished ${index}`);
      await redis.hset(gameKey(finished.id), { startedAt: "1000", finishedAt: "2000" });
    }

    const firstPage = await http
      .get("/v1/games")
      .query({ ...query, order: PaginationOrder.DESC, limit: 50 })
      .expect(200);
    const firstPageIds = firstPage.body.data.map((game: GameListItemDTO) => game.id);
    expect(firstPageIds).not.toContain(matching.id);
    expect(firstPageIds).not.toContain(playing.id);
    expect(firstPage.body.pageInfo.total).toBe(53);

    for (const status of ["lobby", "playing"] as const) {
      const filtered = await http
        .get("/v1/games")
        .query({ ...query, status, order: PaginationOrder.DESC, limit: 50 })
        .expect(200);
      expect(filtered.body.data.map((game: GameListItemDTO) => game.id)).toEqual([
        status === "lobby" ? matching.id : playing.id
      ]);
      expect(filtered.body.pageInfo.total).toBe(1);
    }

    const missing = await http
      .get("/v1/games")
      .query({ ...query, titlePrefix: "Відсутня" })
      .expect(200);
    expect(missing.body).toEqual({ data: [], pageInfo: { total: 0 } });

    await http.delete(`/v1/games/${matching.id}`).set("Cookie", cookie).expect(204);
    const deleted = await http
      .get("/v1/games")
      .query({ ...query, status: "lobby" })
      .expect(200);
    expect(deleted.body).toEqual({ data: [], pageInfo: { total: 0 } });
  });
});
