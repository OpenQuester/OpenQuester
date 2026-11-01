import { randomUUID } from "crypto";
import { inject, singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { RedisService } from "application/services/redis/RedisService";
import {
  DISCORD_ACTIVITY_GAME_TTL_MS,
  DISCORD_ACTIVITY_LOCK_TTL_SECONDS,
  DISCORD_ACTIVITY_MEMBER_TTL_MS,
  getDiscordActivityGameKey,
  getDiscordActivityLockKey,
  getDiscordActivityMemberKey
} from "domain/constants/discord";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { COMPARE_AND_DELETE_SCRIPT } from "domain/lua/actionLuaScripts";
import { type DiscordActivityGameDTO } from "domain/types/dto/discord/DiscordActivityGameDTO";
import { type GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { type GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { type ShortUserInfo } from "domain/types/user/ShortUserInfo";
import { DiscordApiClient } from "infrastructure/discord/DiscordApiClient";
import { type Environment } from "shared/config/Environment";
import { DI_TOKENS } from "shared/di/tokens";

/**
 * One lobby per Discord Activity instance. Everyone who launches the Activity
 * in the same voice channel shares its instance id, so they all land in the
 * same game: the first one to pick a package hosts it, the rest join.
 */
@singleton()
export class DiscordActivityService {
  constructor(
    @inject(DI_TOKENS.Environment) private readonly env: Environment,
    private readonly redisService: RedisService,
    private readonly gameService: GameService,
    private readonly discordApiClient: DiscordApiClient
  ) {
    //
  }

  /**
   * The lobby hands out its password, so with a bot token configured only the
   * people Discord lists in the instance get it. Without one, any Activity
   * session that knows the instance id does (instance ids are hard to guess).
   */
  public async assertInCall(instanceId: string, discordUserId: string | null): Promise<void> {
    if (!this.env.DISCORD_BOT_TOKEN) {
      return;
    }

    if (!discordUserId) {
      throw new ClientError(ClientResponse.DISCORD_ACTIVITY_NOT_IN_CALL, HttpStatus.FORBIDDEN);
    }

    const memberKey = getDiscordActivityMemberKey(instanceId, discordUserId);

    if (await this.redisService.get(memberKey)) {
      return;
    }

    const users = await this.discordApiClient.getActivityInstanceUsers(instanceId);

    if (!users?.includes(discordUserId)) {
      throw new ClientError(ClientResponse.DISCORD_ACTIVITY_NOT_IN_CALL, HttpStatus.FORBIDDEN);
    }

    await this.redisService.set(memberKey, "1", DISCORD_ACTIVITY_MEMBER_TTL_MS);
  }

  /** The instance's game, or an empty result when there is none to join */
  public async getInstanceGame(instanceId: string): Promise<DiscordActivityGameDTO> {
    const gameId = await this.redisService.get(getDiscordActivityGameKey(instanceId));

    if (!gameId) {
      return this._emptyResult();
    }

    const game = await this._findPlayableGame(gameId);

    if (!game) {
      await this.redisService.del(getDiscordActivityGameKey(instanceId));

      return this._emptyResult();
    }

    return { game, password: await this._getPassword(game.id), created: false };
  }

  /**
   * Returns the instance's game, creating it first when there is none.
   * The lobby is always private: only people in the call get its password.
   */
  public async getOrCreateInstanceGame(
    instanceId: string,
    createdByUser: ShortUserInfo,
    gameData: GameCreateDTO
  ): Promise<DiscordActivityGameDTO> {
    const lockKey = getDiscordActivityLockKey(instanceId);
    const lockToken = randomUUID();
    const locked = await this.redisService.setLockKey(
      lockKey,
      DISCORD_ACTIVITY_LOCK_TTL_SECONDS,
      lockToken
    );

    if (!locked) {
      throw new ClientError(ClientResponse.DISCORD_ACTIVITY_GAME_BUSY, HttpStatus.CONFLICT);
    }

    try {
      const existing = await this.getInstanceGame(instanceId);

      if (existing.game) {
        return existing;
      }

      const game = await this.gameService.create(createdByUser, { ...gameData, isPrivate: true });

      await this.redisService.set(
        getDiscordActivityGameKey(instanceId),
        game.id,
        DISCORD_ACTIVITY_GAME_TTL_MS
      );

      return { game, password: await this._getPassword(game.id), created: true };
    } finally {
      // A slow create can outlive the lock's TTL; never drop a lock another launch took since
      await this.redisService.eval(COMPARE_AND_DELETE_SCRIPT, 1, lockKey, lockToken);
    }
  }

  private async _findPlayableGame(gameId: string): Promise<GameListItemDTO | null> {
    let game: GameListItemDTO;

    try {
      game = await this.gameService.get(gameId);
    } catch (error) {
      if (error instanceof ClientError) {
        return null;
      }

      throw error;
    }

    // A finished game makes room for the next one in the same call
    return game.finishedAt ? null : game;
  }

  private async _getPassword(gameId: string): Promise<string | null> {
    const game = await this.gameService.getGameEntity(gameId);

    return game.gameState.password ?? null;
  }

  private _emptyResult(): DiscordActivityGameDTO {
    return { game: null, password: null, created: false };
  }
}
