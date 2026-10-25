import { container } from "tsyringe";

import { GAME_INDEX_CREATED_AT_KEY } from "domain/constants/game";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
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
          const state = await redis.pipeline().exists(...temporaryKeys).ttl(key).exec();
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
        expect(state).toEqual([[null, 0], [null, -1]]);
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
      expect(await redis.pipeline().exists(...temporaryKeys).exec()).toEqual([[null, 0]]);
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

  it("keeps an unmatched title filter when combined with privacy and dates", async () => {
    await addToIndex([
      { id: "TEST", title: "Existing game", isPrivate: false, createdAt: new Date(2000) }
    ]);

    for (const filters of [
      { titlePrefix: "Missing" },
      { titlePrefix: "Missing", isPrivate: false },
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

  it("lists literal Unicode and colon titles through HTTP and removes deleted matches", async () => {
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

    const missing = await http
      .get("/v1/games")
      .query({ ...query, titlePrefix: "Відсутня" })
      .expect(200);
    expect(missing.body).toEqual({ data: [], pageInfo: { total: 0 } });

    await http.delete(`/v1/games/${matching.id}`).set("Cookie", cookie).expect(204);
    const deleted = await http.get("/v1/games").query(query).expect(200);
    expect(deleted.body).toEqual({ data: [], pageInfo: { total: 0 } });
  });
});
