import { PackageService } from "application/services/package/PackageService";
import { UserService } from "application/services/user/UserService";
import {
  GAME_ID_CHARACTERS,
  GAME_ID_CHARACTERS_LENGTH,
  GAME_NAMESPACE,
  GAME_TTL_IN_SECONDS,
} from "domain/constants/game";
import { PACKAGE_DETAILED_RELATIONS } from "domain/constants/package";
import { REDIS_LOCK_GAMES_CLEANUP } from "domain/constants/redis";
import { TIMER_NSP } from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { GameMapper } from "domain/mappers/GameMapper";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { ShortUserInfo } from "domain/types/user/ShortUserInfo";
import { GameRedisValidator } from "domain/validators/GameRedisValidator";
import { GameIndexManager } from "infrastructure/database/managers/game/GameIndexManager";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class GameRepository {
  constructor(
    private readonly redisService: RedisService,
    private readonly gameIndexManager: GameIndexManager,
    private readonly userService: UserService,
    private readonly packageService: PackageService,
    private readonly storage: S3StorageService,
    private readonly logger: ILogger
  ) {
    //
  }

  public getGameKey(gameId: string) {
    return `${GAME_NAMESPACE}:${gameId}`;
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
    return GameMapper.deserializeGameHash(validatedData, this.logger);
  }

  public async updateGame(game: Game): Promise<void> {
    const key = this.getGameKey(game.id);
    await this.redisService.hset(
      key,
      GameMapper.serializeGameToHash(game),
      GAME_TTL_IN_SECONDS
    );
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
          const packData = game.package;

          if (!packData || !packData.author || !createdBy) {
            return null;
          }

          return this._parseGameToListItemDTO(game, createdBy, packData);
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
      throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND);
    }

    if (!packageData.author) {
      throw new ClientError(ClientResponse.PACKAGE_AUTHOR_NOT_FOUND);
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
          prefix: "[GameRepository]: ",
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

    const game = new Game(
      {
        id: gameId,
        title: gameData.title,
        createdBy: createdBy.id,
        createdAt: new Date(),
        isPrivate: gameData.isPrivate,
        ageRestriction: gameData.ageRestriction,
        maxPlayers: gameData.maxPlayers,
        startedAt: null,
        finishedAt: null,
        package: packageDTO,
        roundsCount: counts.roundsCount,
        questionsCount: counts.questionsCount,
        players: [],
        gameState: GameStateMapper.initGameState(),
      },
      this.logger
    );

    const pipeline = this.redisService.pipeline();
    pipeline.hset(key, GameMapper.serializeGameToHash(game));
    this.gameIndexManager.addGameToIndexesPipeline(
      pipeline,
      game.toIndexData()
    );
    pipeline.expire(key, GAME_TTL_IN_SECONDS);
    await pipeline.exec();

    return this._parseGameToListItemDTO(game, createdBy, packageDTO);
  }

  /**
   * **Warning:** This method bypasses host check, so it can be used only in
   * automated flows (e.g. when everyone leaves and game is finished)
   */
  public async deleteInternally(gameId: string): Promise<void> {
    const log = this.logger.performance("Delete game internally", {
      prefix: "[GameRepository]: ",
      gameId,
    });

    const key = this.getGameKey(gameId);
    const game = await this.getGameEntity(gameId);
    await this.redisService.del(key);
    await this.gameIndexManager.removeGameFromIndexes(
      gameId,
      game.toIndexData()
    );

    log.finish();
  }

  public async deleteGame(user: number, gameId: string) {
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

    await this.gameIndexManager.removeGameFromIndexes(
      gameId,
      game.toIndexData()
    );

    await this.redisService.del(key);
  }

  public async gameToListItemDTO(game: Game): Promise<GameListItemDTO> {
    const createdBy = await this.userService.get(game.createdBy, {
      select: ["id", "username"],
      relations: [],
    });

    const packData = game.package;

    if (!packData) {
      throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND);
    }

    if (!packData.author) {
      throw new ClientError(ClientResponse.PACKAGE_AUTHOR_NOT_FOUND);
    }

    if (!createdBy) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND);
    }

    return this._parseGameToListItemDTO(game, createdBy, packData);
  }

  /**
   * Cleans up all active games from Redis on server start.
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

    for (const game of games) {
      let playerDisconnected = false;
      for (const player of game.players) {
        if (player.gameStatus === PlayerGameStatus.IN_GAME) {
          player.gameStatus = PlayerGameStatus.DISCONNECTED;
          playerDisconnected = true;
        }
      }

      if (playerDisconnected) {
        gamesCounter++;
        await this.updateGame(game);
      }
    }

    this.logger.info(
      `Games updated: ${gamesCounter}, in ${Date.now() - startTime} ms`,
      { prefix: "[GameRepository]: " }
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

  private _getTimerKey(gameId: string, timerAdditional?: string) {
    return timerAdditional
      ? `${TIMER_NSP}:${timerAdditional}:${gameId}`
      : `${TIMER_NSP}:${gameId}`;
  }

  private async _parseGameToListItemDTO(
    game: Game,
    createdBy: ShortUserInfo,
    packData: PackageDTO
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
      players: game.playersCount,
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
        id: packData.id!,
        title: packData.title,
        description: packData.description,
        ageRestriction: packData.ageRestriction,
        author: { id: packData.author.id, username: packData.author.username },
        createdAt: packData.createdAt,
        language: packData.language,
        logo: packData.logo,
        roundsCount: game.roundsCount ?? 0,
        questionsCount: game.questionsCount ?? 0,
        tags: packData.tags.map((t) => t.tag),
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
          return GameMapper.deserializeGameHash(validatedData, this.logger);
        } catch (error) {
          // Log validation error and ignore invalid games
          this.logger.warn("Skipping invalid game Redis data", {
            prefix: "[GAME_REPOSITORY]: ",
            error: error instanceof Error ? error.message : String(error),
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
