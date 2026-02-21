import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { PackageService } from "application/services/package/PackageService";
import { UserService } from "application/services/user/UserService";
import {
  GAME_EXPIRATION_WARNING_NAMESPACE,
  GAME_EXPIRATION_WARNING_SECONDS,
  GAME_ID_CHARACTERS,
  GAME_ID_CHARACTERS_LENGTH,
  GAME_NAMESPACE,
  GAME_TTL_IN_SECONDS,
} from "domain/constants/game";
import { PACKAGE_DETAILED_RELATIONS } from "domain/constants/package";
import { REDIS_LOCK_GAMES_CLEANUP } from "domain/constants/redis";
import { TIMER_NSP } from "domain/constants/timer";
import { SECOND_MS } from "domain/constants/time";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { GameMapper } from "domain/mappers/GameMapper";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { GameIndexesInputDTO } from "domain/types/dto/game/GameIndexesInputDTO";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { type PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { ShortUserInfo } from "domain/types/user/ShortUserInfo";
import { PasswordUtils } from "domain/utils/PasswordUtils";
import { GameRedisValidator } from "domain/validators/GameRedisValidator";
import { GameIndexManager } from "infrastructure/database/managers/game/GameIndexManager";
import {
  PackageMetaDTO,
  PackageStore,
} from "infrastructure/database/repositories/PackageStore";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Repository for Game entity operations (stored in Redis).
 */
@singleton()
export class GameRepository {
  constructor(
    private readonly redisService: RedisService,
    @inject(DI_TOKENS.GameIndexManager)
    private readonly gameIndexManager: GameIndexManager,
    private readonly userService: UserService,
    private readonly packageService: PackageService,
    private readonly storage: S3StorageService,
    private readonly packageStore: PackageStore,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public getGameKey(gameId: string) {
    return `${GAME_NAMESPACE}:${gameId}`;
  }

  private getGameExpirationWarningKey(gameId: string) {
    return `${GAME_EXPIRATION_WARNING_NAMESPACE}:${gameId}`;
  }

  public async getGameEntity(
    gameId: string,
    updatedTtl?: number
  ): Promise<Game> {
    const key = this.getGameKey(gameId);
    const data = await this.redisService.hgetall(key, updatedTtl);

    if (!data || ValueUtils.isEmpty(data)) {
      throw new ClientError(
        ClientResponse.GAME_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { gameId }
      );
    }

    const validatedData = GameRedisValidator.validateRedisData(data);
    return GameMapper.deserializeGameHash(validatedData);
  }

  public async updateGame(game: Game): Promise<void> {
    const gameKey = this.getGameKey(game.id);
    const packageKey = this.packageStore.getPackageKey(game.id);
    const warningKey = this.getGameExpirationWarningKey(game.id);
    const warningTtlSeconds = Math.max(
      GAME_TTL_IN_SECONDS - GAME_EXPIRATION_WARNING_SECONDS,
      0
    );

    const pipeline = this.redisService.pipeline();
    pipeline.hset(gameKey, GameMapper.serializeGameToHash(game));
    pipeline.expire(gameKey, GAME_TTL_IN_SECONDS);
    pipeline.expire(packageKey, GAME_TTL_IN_SECONDS);
    if (warningTtlSeconds > 0) {
      pipeline.set(
        warningKey,
        "1",
        "PX",
        warningTtlSeconds * SECOND_MS
      );
    }
    await pipeline.exec();
  }

  public async updateGameWithIndexes(
    game: Game,
    previousIndexData: GameIndexesInputDTO
  ): Promise<void> {
    const gameKey = this.getGameKey(game.id);
    const packageKey = this.packageStore.getPackageKey(game.id);
    const warningKey = this.getGameExpirationWarningKey(game.id);
    const warningTtlSeconds = Math.max(
      GAME_TTL_IN_SECONDS - GAME_EXPIRATION_WARNING_SECONDS,
      0
    );

    const pipeline = this.redisService.pipeline();
    pipeline.hset(gameKey, GameMapper.serializeGameToHash(game));
    this.gameIndexManager.updateGameIndexesPipeline(
      pipeline,
      previousIndexData,
      game.toIndexData()
    );
    pipeline.expire(gameKey, GAME_TTL_IN_SECONDS);
    pipeline.expire(packageKey, GAME_TTL_IN_SECONDS);
    if (warningTtlSeconds > 0) {
      pipeline.set(
        warningKey,
        "1",
        "PX",
        warningTtlSeconds * SECOND_MS
      );
    }
    await pipeline.exec();
  }

  private async _isGameExists(gameId: string) {
    const key = this.getGameKey(gameId);
    const data = await this.redisService.hgetall(key);

    if (data && !ValueUtils.isEmpty(data)) {
      return true;
    }

    return false;
  }

  public async getGame(
    gameId: string,
    updatedTtl?: number
  ): Promise<GameListItemDTO> {
    const game = await this.getGameEntity(gameId, updatedTtl);
    return this.gameToListItemDTO(game);
  }

  public async getAllGames(
    paginationOpts: GamePaginationOpts
  ): Promise<PaginatedResult<GameListItemDTO[]>> {
    const { ids, total } = await this.gameIndexManager.findGamesByIndex<Game>(
      {
        createdAtMax: paginationOpts.createdAtMax,
        createdAtMin: paginationOpts.createdAtMin,
        isPrivate: paginationOpts.isPrivate,
        titlePrefix: paginationOpts.titlePrefix,
      },
      {
        limit: paginationOpts.limit,
        offset: paginationOpts.offset,
        order: paginationOpts.order,
        sortBy: paginationOpts.sortBy,
      }
    );

    const userIds = new Set<number>();
    const games = await this._fetchGameDetails(ids);

    if (!games?.length) {
      return { data: [], pageInfo: { total } };
    }

    games.forEach((game: Game) => {
      userIds.add(game.createdBy);
    });

    const users = await this.userService.findByIds(Array.from(userIds), {
      select: ["id", "username"],
      relations: [],
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const gamesItems: GameListItemDTO[] = (
      await Promise.all(
        games.map(async (game: Game) => {
          const createdBy = userMap.get(game.createdBy);
          const packMeta = await this.packageStore.getMeta(game.id);

          if (!packMeta || !packMeta.author || !createdBy) {
            return null;
          }

          return this._parseGameToListItemDTO(game, createdBy, packMeta);
        })
      )
    ).filter((g): g is GameListItemDTO => g !== null);

    return {
      data: gamesItems,
      pageInfo: {
        total,
      },
    };
  }

  public async createGame(
    gameData: GameCreateDTO,
    createdBy: User
  ): Promise<GameListItemDTO> {
    const packageData = await this.packageService.getPackageRaw(
      gameData.packageId,
      undefined,
      PACKAGE_DETAILED_RELATIONS
    );

    if (!packageData) {
      throw new ClientError(
        ClientResponse.PACKAGE_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    if (!packageData.author) {
      throw new ClientError(
        ClientResponse.PACKAGE_AUTHOR_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    let gameId = "";
    let collisionsCounter = -1;
    do {
      gameId = this._generateGameId();
      collisionsCounter++;

      if (collisionsCounter === 10) {
        throw new ClientError(ClientResponse.BAD_GAME_CREATION);
      }
    } while (await this._isGameExists(gameId));

    if (collisionsCounter > 0) {
      this.logger.warn(
        `Game id collisions while game creation: ${collisionsCounter}`,
        {
          prefix: LogPrefix.GAME,
        }
      );
    }

    const key = this.getGameKey(gameId);

    const counts = await this.packageService.getCountsForPackage(
      gameData.packageId
    );

    const packageDTO = packageData.toDTO(this.storage, {
      fetchIds: true,
    });

    const initialGameState = GameStateMapper.initGameState();

    // Handle password for private games
    if (gameData.isPrivate) {
      initialGameState.password =
        gameData.password || PasswordUtils.generateGamePassword();
    }

    const game = new Game({
      id: gameId,
      title: gameData.title,
      createdBy: createdBy.id,
      createdAt: new Date(),
      isPrivate: gameData.isPrivate,
      ageRestriction: gameData.ageRestriction,
      maxPlayers: gameData.maxPlayers,
      startedAt: null,
      finishedAt: null,
      roundIndex: PackageStore.buildRoundIndex(packageDTO),
      roundsCount: counts.roundsCount,
      questionsCount: counts.questionsCount,
      players: [],
      gameState: initialGameState,
    });

    // Store immutable package data separately
    await this.packageStore.storePackage(gameId, packageDTO);

    const pipeline = this.redisService.pipeline();
    pipeline.hset(key, GameMapper.serializeGameToHash(game));
    this.gameIndexManager.addGameToIndexesPipeline(
      pipeline,
      game.toIndexData()
    );
    pipeline.expire(key, GAME_TTL_IN_SECONDS);

    const warningTtlSeconds = Math.max(
      GAME_TTL_IN_SECONDS - GAME_EXPIRATION_WARNING_SECONDS,
      0
    );
    if (warningTtlSeconds > 0) {
      const warningKey = this.getGameExpirationWarningKey(gameId);
      pipeline.set(
        warningKey,
        "1",
        "PX",
        warningTtlSeconds * SECOND_MS
      );
    }
    await pipeline.exec();

    const packMeta: PackageMetaDTO = {
      id: packageDTO.id,
      title: packageDTO.title,
      description: packageDTO.description,
      author: {
        id: packageDTO.author.id,
        username: packageDTO.author.username,
      },
      ageRestriction: packageDTO.ageRestriction,
      language: packageDTO.language,
      logo: packageDTO.logo,
      tags: packageDTO.tags.map((t) => ({ tag: t.tag })),
      createdAt:
        packageDTO.createdAt instanceof Date
          ? packageDTO.createdAt.toISOString()
          : String(packageDTO.createdAt),
    };

    return this._parseGameToListItemDTO(game, createdBy, packMeta);
  }

  /**
   * **Warning:** This method bypasses host check, so it can be used only in
   * automated flows (e.g. when everyone leaves and game is finished)
   */
  public async deleteInternally(gameId: string): Promise<void> {
    this.logger.debug("Delete game internally", {
      prefix: LogPrefix.GAME,
      gameId,
    });

    const key = this.getGameKey(gameId);
    const game = await this.getGameEntity(gameId);

    await this.clearAllTimers(gameId);
    await this.redisService.del(key);
    await this.packageStore.deletePackage(gameId);
    await this.clearExpirationWarning(gameId);
    await this.gameIndexManager.removeGameFromIndexes(
      gameId,
      game.toIndexData()
    );
  }

  public async deleteGame(user: number, gameId: string) {
    this.logger.debug("Delete game", {
      prefix: LogPrefix.GAME,
      gameId,
    });
    const key = this.getGameKey(gameId);
    const game = await this.getGameEntity(gameId);

    if (!game) {
      throw new ClientError(
        ClientResponse.GAME_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { gameId }
      );
    }

    if (game.createdBy !== user) {
      throw new ClientError(ClientResponse.ONLY_HOST_CAN_DELETE);
    }

    await this.clearAllTimers(gameId);

    await this.gameIndexManager.removeGameFromIndexes(
      gameId,
      game.toIndexData()
    );

    await this.redisService.del(key);
    await this.packageStore.deletePackage(gameId);
    await this.clearExpirationWarning(gameId);
  }

  public async gameToListItemDTO(game: Game): Promise<GameListItemDTO> {
    const createdBy = await this.userService.get(game.createdBy, {
      select: ["id", "username"],
      relations: [],
    });

    const packMeta = await this.packageStore.getMeta(game.id);

    if (!packMeta) {
      throw new ClientError(
        ClientResponse.PACKAGE_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    if (!packMeta.author) {
      throw new ClientError(
        ClientResponse.PACKAGE_AUTHOR_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    if (!createdBy) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return this._parseGameToListItemDTO(game, createdBy, packMeta);
  }

  /**
   * Cleans up all active games from Redis on server start.
   *
   * For each game:
   * 1. Sets all players as disconnected
   * 2. If game has an active timer:
   *    - Clears existing Redis timer keys
   *    - Recreates timer starting from 0 (elapsedMs=0)
   *    - Pauses the game
   * 3. Updates game state in Redis
   *
   * This ensures games can continue after server restart without stuck states.
   */
  public async cleanupAllGames(): Promise<void> {
    const acquired = await this.redisService.setLockKey(
      REDIS_LOCK_GAMES_CLEANUP
    );

    if (!acquired) {
      return; // Another instance acquired the lock
    }

    const startTime = Date.now();

    const keys = await this.redisService.scan(this.getGameKey("*"));
    let gamesCounter = 0;
    let timerRecoveryCounter = 0;

    const gamesPromises = [];
    const games: Game[] = [];

    for (const key of keys) {
      gamesPromises.push(
        this.getGameEntity(key.split(":")[1])
          .then((game) => {
            games.push(game);
          })
          .catch(() => {
            // Game not found - ignore (for game:index and other keys)
          })
      );
    }

    await Promise.all(gamesPromises);

    const gamesUpdates = [];

    for (const game of games) {
      // Set all players as disconnected
      game.players.forEach((player) => {
        player.gameStatus = PlayerGameStatus.DISCONNECTED;
      });

      // Handle timer recovery for games with active timers
      if (game.gameState.timer && game.gameState.questionState) {
        await this._recoverGameTimer(game);
        timerRecoveryCounter++;
      }

      gamesCounter++;
      gamesUpdates.push(this.updateGame(game));
    }

    await Promise.all(gamesUpdates);

    this.logger.info(
      `Games updated: ${gamesCounter}, timers recovered: ${timerRecoveryCounter}, in ${
        Date.now() - startTime
      } ms`,
      { prefix: LogPrefix.GAME }
    );
  }

  /**
   * Recovers timer state for a game after server restart.
   *
   * 1. Clears any existing timer keys (may have expired during downtime)
   * 2. Recreates the timer starting from 0 (elapsedMs=0)
   * 3. Saves it as a paused timer restore point
   * 4. Pauses the game
   */
  private async _recoverGameTimer(game: Game): Promise<void> {
    const timer = game.gameState.timer!;
    const questionState = game.gameState.questionState!;

    // Clear any existing timer keys
    await this.clearTimer(game.id);
    await this.clearTimer(game.id, questionState);

    // Restart timer from 0 on server restart.
    // Rationale: timers might have expired while server was down and the expiration
    // event would be missed. We restore the game to a safe paused state and allow
    // resuming from this restore point.
    timer.elapsedMs = 0;
    timer.startedAt = new Date();

    // Save paused timer with question state suffix for later unpause
    const pausedTimerTtl = Math.ceil(GAME_TTL_IN_SECONDS * 1000 * 1.25);
    await this.saveTimer(timer, game.id, questionState, pausedTimerTtl);

    // Pause game and clear active timer
    game.pause();
    game.setTimer(null);

    this.logger.debug(
      `Timer recovered for game ${game.id}: state=${questionState}, elapsed=${timer.elapsedMs}ms/${timer.durationMs}ms`,
      { prefix: LogPrefix.GAME }
    );
  }

  public async cleanOrphanedGames() {
    return this.gameIndexManager.cleanOrphanedGameIndexes();
  }

  /**
   * @param timerAdditional means additional body between timer and gameId,
   *  e.g. timer:showing:ABCD, it this case timerAdditional is 'showing'
   */
  public async getTimer(gameId: string, timerAdditional?: string) {
    const key = this._getTimerKey(gameId, timerAdditional);

    try {
      const timer = await this.redisService.get(key);
      if (ValueUtils.isBad(timer) || ValueUtils.isEmpty(timer)) {
        return null;
      }

      return JSON.parse(timer) as GameStateTimerDTO;
    } catch {
      return null;
    }
  }

  /**
   * @param timerAdditional means additional body between timer and gameId,
   *  e.g. timer:showing:ABCD, it this case timerAdditional is 'showing'
   * @param ttl in milliseconds
   */
  public async saveTimer(
    timer: GameStateTimerDTO,
    gameId: string,
    timerAdditional?: string,
    ttl?: number
  ) {
    const key = this._getTimerKey(gameId, timerAdditional);

    await this.redisService.set(
      key,
      JSON.stringify(timer),
      ttl ? ttl : timer.durationMs
    );
  }

  public async clearTimer(gameId: string, timerAdditional?: string) {
    await this.redisService.del(this._getTimerKey(gameId, timerAdditional));
  }

  private async setExpirationWarning(gameId: string): Promise<void> {
    const warningTtlSeconds = Math.max(
      GAME_TTL_IN_SECONDS - GAME_EXPIRATION_WARNING_SECONDS,
      0
    );
    if (warningTtlSeconds === 0) {
      return;
    }

    await this.redisService.set(
      this.getGameExpirationWarningKey(gameId),
      "1",
      warningTtlSeconds * SECOND_MS
    );
  }

  private async clearExpirationWarning(gameId: string): Promise<void> {
    await this.redisService.del(this.getGameExpirationWarningKey(gameId));
  }

  /**
   * Clears all timer keys associated with a game (active + paused/elapsed).
   * Timer keys follow the pattern: timer:{gameId} and timer:{suffix}:{gameId}
   */
  public async clearAllTimers(gameId: string): Promise<void> {
    // Scan for suffixed keys (timer:{suffix}:{gameId}) using colon delimiter
    // to avoid substring collisions with other gameIds
    const suffixedKeys = await this.redisService.scan(
      `${TIMER_NSP}:*:${gameId}`
    );
    // Always include the bare key (timer:{gameId}) which has no suffix
    const bareKey = this._getTimerKey(gameId);
    const allKeys = [bareKey, ...suffixedKeys];

    await Promise.all(allKeys.map((key) => this.redisService.del(key)));
  }

  private _getTimerKey(gameId: string, timerAdditional?: string) {
    return timerAdditional
      ? `${TIMER_NSP}:${timerAdditional}:${gameId}`
      : `${TIMER_NSP}:${gameId}`;
  }

  private async _parseGameToListItemDTO(
    game: Game,
    createdBy: ShortUserInfo,
    packMeta: PackageMetaDTO
  ): Promise<GameListItemDTO> {
    const currentRound = game.gameState.currentRound
      ? game.gameState.currentRound.order + 1
      : null;

    const currentQuestion = game.gameState.currentQuestion
      ? game.gameState.currentQuestion
      : null;

    return {
      id: game.id,
      title: game.title,
      ageRestriction: game.ageRestriction,
      isPrivate: game.isPrivate,
      maxPlayers: game.maxPlayers,
      players: game.players.map((p) => ({
        id: p.meta.id,
        role: p.role,
        slot: p.gameSlot,
      })),
      createdBy: {
        id: createdBy.id,
        username: createdBy.username,
      },
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      createdAt: game.createdAt,
      currentRound,
      currentQuestion: currentQuestion?.id ?? null,
      package: {
        id: packMeta.id!,
        title: packMeta.title,
        description: packMeta.description,
        ageRestriction: packMeta.ageRestriction as AgeRestriction,
        author: { id: packMeta.author.id, username: packMeta.author.username },
        createdAt: new Date(packMeta.createdAt),
        language: packMeta.language,
        logo: packMeta.logo as { file: PackageFileDTO } | null | undefined,
        roundsCount: game.roundsCount ?? 0,
        questionsCount: game.questionsCount ?? 0,
        tags: packMeta.tags.map((t) => t.tag),
      },
    };
  }

  private _generateGameId() {
    let result = "";
    for (let i = 0; i < GAME_ID_CHARACTERS_LENGTH; i++) {
      result +=
        GAME_ID_CHARACTERS[
          Math.floor(Math.random() * GAME_ID_CHARACTERS.length)
        ];
    }
    return result;
  }

  private async _fetchGameDetails(gameIds: string[]) {
    const pipeline = this.redisService.pipeline();
    gameIds.forEach((id) => pipeline.hgetall(this.getGameKey(id)));

    const results = await pipeline.exec();
    if (!results) {
      return;
    }

    return results
      .map(([, data]) => {
        try {
          const validatedData = GameRedisValidator.validateRedisData(
            data as Record<string, string>
          );
          return GameMapper.deserializeGameHash(validatedData);
        } catch (error) {
          this.logger.warn("Skipping invalid game Redis data", {
            prefix: LogPrefix.GAME,
            error: error instanceof Error ? error.message : String(error),
            gameIdsCount: gameIds.length,
          });
        }
      })
      .filter((g): g is Game => !!g);
  }

  /**
   * @param expire seconds to expire the lock
   */
  public async gameLock(key: string, expire: number): Promise<boolean> {
    const acquired = await this.redisService.setLockKey(key, expire);
    return acquired === "OK";
  }

  /**
   * Releases a game lock by deleting the lock key from Redis
   */
  public async gameUnlock(key: string): Promise<number> {
    return this.redisService.del(key);
  }
}
