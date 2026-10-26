import { ChainableCommander } from "ioredis";
import { performance } from "node:perf_hooks";

import { GAME_INDEX_CREATED_AT_KEY, GAME_INDEX_PREFIX } from "domain/constants/game";
import { gameKey } from "domain/constants/redisKeys";
import { REDIS_LOCK_GAMES_CLEANUP_ORPHANED } from "domain/constants/redis";
import { SECOND_MS } from "domain/constants/time";
import { GameStatusFilter } from "domain/enums/game/GameStatusFilter";
import { ServerError } from "domain/errors/ServerError";
import { GameIndexesInputDTO } from "domain/types/dto/game/GameIndexesInputDTO";
import { PaginationOptsBase, PaginationOrder } from "domain/types/pagination/PaginationOpts";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { ValueUtils } from "domain/utils/ValueUtils";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";

export class GameIndexManager {
  private readonly TEMP_KEY_TTL = 30; // seconds
  private readonly STATUS_FILTER_BATCH_SIZE = 200;

  constructor(
    private readonly redisRepository: RedisRepository,
    private readonly logger: ILogger
  ) {
    //
  }

  public addGameToIndexesPipeline(
    pipeline: ChainableCommander,
    gameData: GameIndexesInputDTO
  ): ChainableCommander {
    // Add all index operations to the same pipeline
    pipeline.zadd(this._createdAtIndexKey, gameData.createdAt.getTime(), gameData.id);

    pipeline.sadd(this._privacyIndexKey(gameData.isPrivate), gameData.id);

    pipeline.zadd(this._titleIndexKey, 0, `${gameData.title.toLowerCase()}:${gameData.id}`);

    return pipeline;
  }

  public updateGameIndexesPipeline(
    pipeline: ChainableCommander,
    previous: GameIndexesInputDTO,
    next: GameIndexesInputDTO
  ): ChainableCommander {
    // Privacy index
    pipeline.srem(this._privacyIndexKey(previous.isPrivate), previous.id);
    pipeline.sadd(this._privacyIndexKey(next.isPrivate), next.id);

    // Title index
    pipeline.zrem(this._titleIndexKey, `${previous.title.toLowerCase()}:${previous.id}`);
    pipeline.zadd(this._titleIndexKey, 0, `${next.title.toLowerCase()}:${next.id}`);

    return pipeline;
  }

  public removeGameFromIndexesPipeline(
    pipeline: ChainableCommander,
    gameId: string,
    gameData: GameIndexesInputDTO
  ): ChainableCommander {
    pipeline.zrem(this._createdAtIndexKey, gameId);
    pipeline.srem(this._privacyIndexKey(gameData.isPrivate), gameId);
    pipeline.zrem(this._titleIndexKey, `${gameData.title.toLowerCase()}:${gameId}`);

    return pipeline;
  }

  public async removeGameFromIndexes(gameId: string, gameData: GameIndexesInputDTO) {
    this.logger.debug("Removing game from indexes", {
      prefix: LogPrefix.GAME_INDEX,
      gameId
    });
    return Promise.all([
      this.redisRepository.zrem(this._createdAtIndexKey, [gameId]),
      this.redisRepository.srem(this._privacyIndexKey(gameData.isPrivate), gameId),
      this.redisRepository.zrem(this._titleIndexKey, [`${gameData.title.toLowerCase()}:${gameId}`])
    ]);
  }

  /**
   * This method has little lower performance than `removeGameFromIndexes`
   * and should be used only on key expiration
   */
  public async removeGameFromAllIndexes(gameId: string): Promise<void> {
    const createdAtPromise = this.redisRepository.zrem(this._createdAtIndexKey, [gameId]);

    const privacyPromises = [
      this.redisRepository.srem(this._privacyIndexKey(true), gameId),
      this.redisRepository.srem(this._privacyIndexKey(false), gameId)
    ];

    // Use SCAN to find matching entries
    const titlePromise = (async () => {
      let cursor = "0";
      do {
        const [nextCursor, members] = await this.redisRepository.zScanMatch(
          this._titleIndexKey,
          cursor,
          `*:${gameId}`
        );

        cursor = nextCursor;
        if (members.length > 0) {
          // Extract member names (e.g., "title:gameId")
          // Members are [member1, score1, member2, score2, ...]
          const toRemove = members.filter((_: unknown, index: number) => index % 2 === 0);
          if (toRemove.length > 0) {
            await this.redisRepository.zrem(this._titleIndexKey, toRemove);
          }
        }
      } while (cursor !== "0");
    })();

    // Execute all removals concurrently
    await Promise.all([createdAtPromise, ...privacyPromises, titlePromise]);
  }

  /**
   * Scans the createdAt index and removes gameIds whose game keys are missing or have TTL <= 10 seconds.
   * Cleans up all related indexes using removeGameFromAllIndexes.
   */
  public async cleanOrphanedGameIndexes(): Promise<void> {
    const acquired = await this.redisRepository.setLockKey(REDIS_LOCK_GAMES_CLEANUP_ORPHANED);

    if (!acquired) {
      return; // Another instance acquired the lock
    }

    let cursor = "0";
    const orphanedGameIds: string[] = [];

    // Scan createdAt index in chunks
    do {
      const [nextCursor, members] = await this.redisRepository.zScanCount(
        this._createdAtIndexKey,
        cursor,
        100
      );
      cursor = nextCursor;

      if (members.length === 0) continue;

      // Extract gameIds (members are [gameId, score, ...])
      const gameIds = members.filter((_: unknown, index: number) => index % 2 === 0);

      // Pipeline TTL checks for efficiency
      const pipeline = this.redisRepository.pipeline();
      for (const gameId of gameIds) {
        pipeline.ttl(`game:${gameId}`);
      }
      const ttlResults = await pipeline.exec();

      if (!ttlResults) {
        continue;
      }

      // Check TTLs and mark orphaned gameIds
      gameIds.forEach((gameId: string, index: number) => {
        const ttlResult = ttlResults[index];
        if (ttlResult[1] === null) {
          this.logger.error(`TTL command failed for game:${gameId}`, {
            prefix: LogPrefix.GAME_INDEX
          });
          return;
        }
        const ttl = ttlResult[1] as number;
        // TTL <= 10 seconds or key doesn't exist (ttl = -2)
        if (ttl <= 10) {
          orphanedGameIds.push(gameId);
        }
      });
    } while (cursor != "0");

    // Clean up orphaned gameIds
    if (orphanedGameIds.length > 0) {
      this.logger.info(`Found ${orphanedGameIds.length} orphaned gameIds`, {
        prefix: LogPrefix.GAME_INDEX
      });
      const cleanupPromises = orphanedGameIds.map((gameId: string) =>
        this.removeGameFromAllIndexes(gameId).catch((err: unknown) => {
          this.logger.error(`Failed to clean indexes for game ${gameId}: ${err}`, {
            prefix: LogPrefix.GAME_INDEX
          });
        })
      );
      await Promise.all(cleanupPromises);
    }
  }

  public async findGamesByIndex<T>(
    filters: {
      createdAtMin?: Date;
      createdAtMax?: Date;
      isPrivate?: boolean;
      titlePrefix?: string;
      status?: GameStatusFilter;
    },
    pagination: PaginationOptsBase<T>
  ): Promise<{ ids: string[]; total: number }> {
    const hasFilters =
      !!filters.createdAtMin ||
      !!filters.createdAtMax ||
      ValueUtils.isBoolean(filters.isPrivate) ||
      !!filters.titlePrefix ||
      !!filters.status;

    if (!hasFilters) {
      return this._paginateResults(this._createdAtIndexKey, pagination);
    }

    const tempKey = `${GAME_INDEX_PREFIX}:temp:${Date.now()}:${ValueUtils.generateUUID()}`;

    try {
      const candidateCount = await this._buildCompositeIndex(tempKey, {
        createdAt: {
          max: filters.createdAtMax,
          min: filters.createdAtMin
        },
        isPrivate: filters.isPrivate,
        titlePrefix: filters.titlePrefix
      });
      await this.redisRepository.expire(tempKey, this.TEMP_KEY_TTL);
      if (filters.status) {
        await this._applyStatusFilter(tempKey, filters.status, candidateCount);
      }
      return await this._paginateResults<T>(tempKey, pagination);
    } finally {
      await this.redisRepository.delMultiple([tempKey, `${tempKey}:title`, `${tempKey}:createdAt`]);
    }
  }

  private async _buildCompositeIndex(
    tempKey: string,
    filters: {
      createdAt: { min?: Date; max?: Date };
      isPrivate?: boolean;
      titlePrefix?: string;
    }
  ): Promise<number> {
    // Keep creation timestamps as the score source for every combination of filters.
    const indexKeys = [this._createdAtIndexKey];

    await this._applyPrivacyFilter(filters, indexKeys);
    await this._applyTitleFilter(filters, tempKey, indexKeys);
    await this._applyDateRangeFilter(filters, tempKey, indexKeys);

    return this.redisRepository.zinterstore(tempKey, indexKeys.length, [
      ...indexKeys,
      "WEIGHTS",
      ...indexKeys.map((_, i) => (i === 0 ? 1 : 0))
    ]);
  }

  private async _applyPrivacyFilter(filters: { isPrivate?: boolean }, indexKeys: string[]) {
    if (ValueUtils.isBoolean(filters.isPrivate)) {
      indexKeys.push(this._privacyIndexKey(filters.isPrivate));
    }
  }

  private async _applyTitleFilter(
    filters: { titlePrefix?: string },
    tempKey: string,
    indexKeys: string[]
  ): Promise<void> {
    if (filters.titlePrefix) {
      const titleFilterKey = `${tempKey}:title`;
      await this._prepareTitleFilter(filters.titlePrefix, titleFilterKey);
      // A missing key still represents an empty filter; never drop it from the intersection.
      indexKeys.push(titleFilterKey);
    }
  }

  private async _applyDateRangeFilter(
    filters: { createdAt: { min?: Date; max?: Date } },
    tempKey: string,
    indexKeys: string[]
  ) {
    if (filters.createdAt.max || filters.createdAt.min) {
      const createdAtIndexKeyToUse = `${tempKey}:createdAt`;
      await this.redisRepository.zunionstore(createdAtIndexKeyToUse, 1, [this._createdAtIndexKey]);

      await this.redisRepository.expire(createdAtIndexKeyToUse, this.TEMP_KEY_TTL);

      const minScore = filters.createdAt.min ? filters.createdAt.min.getTime() : "-inf";
      const maxScore = filters.createdAt.max ? filters.createdAt.max.getTime() : "+inf";

      await this.redisRepository.zremrangebyscore(createdAtIndexKeyToUse, "-inf", minScore);
      await this.redisRepository.zremrangebyscore(createdAtIndexKeyToUse, maxScore, "+inf");

      indexKeys.push(createdAtIndexKeyToUse);
    }
  }

  private async _prepareTitleFilter(prefix: string, titleFilterKey: string): Promise<void> {
    const normalizedPrefix = prefix.toLowerCase();
    const lowerBound = `[${normalizedPrefix}`;
    // Redis compares bytes; UTF-8 title suffixes sort below the raw FF sentinel.
    const upperBound = Buffer.concat([Buffer.from(lowerBound), Buffer.from([0xff])]);
    const titleMatches = await this.redisRepository.zrangebylex(
      this._titleIndexKey,
      lowerBound,
      upperBound
    );

    const gameIds: string[] = [];
    for (const member of titleMatches) {
      const separatorIndex = member.lastIndexOf(":");
      const title = member.slice(0, separatorIndex);

      // Search the title only: its separator and game ID must not complete the prefix.
      if (!title.startsWith(normalizedPrefix)) {
        continue;
      }

      const gameId = member.slice(separatorIndex + 1);
      gameIds.push(gameId);
    }

    if (gameIds.length > 0) {
      await this.redisRepository.sadd(titleFilterKey, gameIds);
      await this.redisRepository.expire(titleFilterKey, this.TEMP_KEY_TTL);
    }
  }

  private async _paginateResults<T>(indexKey: string, pagination: PaginationOptsBase<T>) {
    const [ids, total] = await Promise.all([
      pagination.order === PaginationOrder.DESC
        ? this.redisRepository.zrevrange(
            indexKey,
            pagination.offset,
            pagination.offset + pagination.limit - 1
          )
        : this.redisRepository.zrange(
            indexKey,
            pagination.offset,
            pagination.offset + pagination.limit - 1
          ),
      this.redisRepository.zcard(indexKey)
    ]);

    return { ids, total };
  }

  private async _applyStatusFilter(
    indexKey: string,
    status: GameStatusFilter,
    candidateCount: number
  ): Promise<void> {
    let offset = 0;
    const ttlRefreshIntervalMs = (this.TEMP_KEY_TTL * SECOND_MS) / 2;
    let nextTtlRefreshAt = performance.now() + ttlRefreshIntervalMs;

    // The private snapshot can only shrink as this query removes nonmatching members.
    for (
      let checkedCount = 0;
      checkedCount < candidateCount;
      checkedCount += this.STATUS_FILTER_BATCH_SIZE
    ) {
      if (performance.now() >= nextTtlRefreshAt) {
        const renewed = await this.redisRepository.expire(indexKey, this.TEMP_KEY_TTL);
        if (renewed === 0) {
          throw new ServerError("Game status filter temporary index expired before completion");
        }
        nextTtlRefreshAt = performance.now() + ttlRefreshIntervalMs;
      }

      const expectedBatchSize = Math.min(
        this.STATUS_FILTER_BATCH_SIZE,
        candidateCount - checkedCount
      );
      const gameIds = await this.redisRepository.zrange(
        indexKey,
        offset,
        offset + expectedBatchSize - 1
      );
      if (gameIds.length !== expectedBatchSize) {
        throw new ServerError("Game status filter temporary index is missing candidates");
      }

      const pipeline = this.redisRepository.pipeline();
      for (const gameId of gameIds) {
        pipeline.hmget(gameKey(gameId), "startedAt", "finishedAt");
      }
      const results = await pipeline.exec();
      if (!results || results.length !== gameIds.length) {
        throw new ServerError("Game status pipeline returned an unexpected number of results");
      }

      const excludedIds: string[] = [];
      for (let index = 0; index < gameIds.length; index++) {
        const [error, fields] = results[index];
        if (error) {
          throw error;
        }
        if (!Array.isArray(fields) || fields.length !== 2) {
          throw new ServerError("Game status pipeline returned invalid lifecycle fields");
        }

        const [startedAt, finishedAt] = fields as [string | null, string | null];
        const isLobby = startedAt === "" && finishedAt === "";
        const isPlaying = startedAt !== null && startedAt !== "" && finishedAt === "";
        const matchesStatus = status === GameStatusFilter.LOBBY ? isLobby : isPlaying;
        if (!matchesStatus) {
          excludedIds.push(gameIds[index]);
        }
      }

      if (excludedIds.length > 0) {
        await this.redisRepository.zrem(indexKey, excludedIds);
      }
      // Removed members shift the next batch left; skip only already checked matches.
      offset += gameIds.length - excludedIds.length;
    }
  }

  private get _createdAtIndexKey() {
    return GAME_INDEX_CREATED_AT_KEY;
  }

  private _privacyIndexKey(isPrivate: boolean) {
    return `${GAME_INDEX_PREFIX}:isPrivate:${isPrivate}`;
  }

  private get _titleIndexKey() {
    return `${GAME_INDEX_PREFIX}:title`;
  }
}
