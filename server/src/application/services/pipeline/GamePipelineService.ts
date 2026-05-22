import { randomUUID } from "crypto";
import { type ChainableCommander } from "ioredis";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import {
  GAME_EXPIRATION_WARNING_SECONDS,
  GAME_NAMESPACE,
  GAME_TTL_IN_SECONDS
} from "domain/constants/game";
import {
  expirationWarningKey,
  gameKey,
  lockKey,
  packageKey,
  queueKey,
  timerKey
} from "domain/constants/redisKeys";
import { SOCKET_SESSION_PREFIX } from "domain/constants/socket";
import { SECOND_MS } from "domain/constants/time";
import { type Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { GameMapper } from "domain/mappers/GameMapper";
import {
  type DeleteGameMutation,
  type DeleteTimerMutation,
  type SaveGameMutation,
  type SetTimerMutation
} from "domain/types/action/DataMutation";
import { type GameIndexesInputDTO } from "domain/types/dto/game/GameIndexesInputDTO";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { asUserId } from "domain/types/ids";
import { type SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { GameRedisValidator } from "domain/validators/GameRedisValidator";
import { GameActionLockService } from "application/services/lock/GameActionLockService";
import { RedisService } from "application/services/redis/RedisService";
import { ValueUtils } from "domain/utils/ValueUtils";
import { GameIndexManager } from "infrastructure/database/managers/game/GameIndexManager";

/** TTL for the action-execution Redis lock. */
export const PIPELINE_LOCK_TTL_SECONDS = 10;

const WARNING_TTL_SECONDS = Math.max(GAME_TTL_IN_SECONDS - GAME_EXPIRATION_WARNING_SECONDS, 0);

/**
 * Lua script that fetches a socket session and the associated game in a single
 * Redis round-trip.
 *
 * KEYS[1] = socket:session:{socketId}
 * ARGV[1] = game key prefix (e.g. "game:")
 *
 * Returns:
 *   nil — session not found, no gameId in session, or game not found
 *   {sessionFieldCount, ...sessionFields, ...gameFields}
 *       — both hashes packed as a flat array with a length prefix so the
 *         caller knows where the session ends and the game begins
 *
 * Note: Game key is constructed dynamically as ARGV[1] .. gameId inside the
 * script. This means the script accesses keys not declared in KEYS[], which
 * works on standalone Redis but is incompatible with Redis Cluster.
 */
const FETCH_SESSION_AND_GAME_SCRIPT = `
  local session = redis.call('HGETALL', KEYS[1])
  if #session == 0 then
    return nil
  end

  -- Extract gameId from flat [field, value, ...] pairs
  local gameId = nil
  for i = 1, #session, 2 do
    if session[i] == 'gameId' then
      gameId = session[i + 1]
      break
    end
  end

  if not gameId or gameId == 'null' or gameId == '' then
    return nil
  end

  local game = redis.call('HGETALL', ARGV[1] .. gameId)
  if #game == 0 then
    return nil
  end

  -- Pack: [sessionFieldCount, ...sessionFields, ...gameFields]
  local result = { tostring(#session) }
  for i = 1, #session do
    result[#result + 1] = session[i]
  end
  for i = 1, #game do
    result[#result + 1] = game[i]
  end
  return result
`;

/**
 * Result of the IN pipeline: lock attempt + speculative game/timer prefetch.
 * Discriminated union on `lockAcquired`.
 */
export type PipelineInResult = PipelineInLockFailed | PipelineInSuccess;

/**
 * Result of the read-only pipeline: game/timer/session prefetch without
 * any lock acquisition. Used by direct-execution actions that don't
 * mutate game state and therefore don't need synchronization.
 */
export interface PipelineReadResult {
  game: Game;
  timer: GameStateTimerDTO | null;
  userData: SocketRedisUserData | null;
}

export interface PipelineInLockFailed {
  lockAcquired: false;
  lockToken: "";
}

export interface PipelineInSuccess {
  lockAcquired: true;
  lockToken: string;
  game: Game;
  timer: GameStateTimerDTO | null;
  userData: SocketRedisUserData | null;
}

/**
 * Classified mutations required by the OUT pipeline.
 * Subset of DataMutationProcessor's internal ClassifiedMutations.
 */
interface OutPipelineInput {
  saveGame: SaveGameMutation | null;
  deleteGame: DeleteGameMutation | null;
  timerSets: SetTimerMutation[];
  timerDeletes: DeleteTimerMutation[];
}

/**
 * Result of fetchSessionAndGame: resolved session + game for a connected socket.
 */
interface SessionAndGame {
  userData: SocketRedisUserData;
  game: Game;
}

/**
 * Encapsulates all Redis pipeline building and execution for game operations.
 *
 * Extracted from {@link GameActionExecutor} (IN pipeline) and
 * {@link DataMutationProcessor} (OUT pipeline) to centralise Redis pipeline
 * logic and allow reuse by {@link UserService}.
 *
 * Three operations:
 * - {@link executePipelineIn} — lock attempt + game/timer/session prefetch (1 RT)
 * - {@link executeOutPipeline} — game save + timer mutations (1 RT)
 * - {@link fetchSessionAndGame} — Lua-script session + game fetch for forced-leave flows (1 RT)
 */
@singleton()
export class GamePipelineService {
  constructor(
    private readonly redisService: RedisService,
    private readonly lockService: GameActionLockService,
    @inject(DI_TOKENS.GameIndexManager)
    private readonly gameIndexManager: GameIndexManager
  ) {
    //
  }

  // ════════════════════════════════════════════════════════════════════════
  //  IN Pipeline
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Build and execute the IN pipeline: lock + speculative game/timer prefetch.
   *
   * Commands:
   *   [0] SET game:action:lock:{gameId} {token} EX 10 NX  → lock attempt
   *   [1] HGETALL game:{gameId}                           → game hash
   *   [2] EXPIRE game:{gameId} 7200                       → TTL refresh
   *   [3] GET timer:{gameId}                              → active timer
   *   [4] HGETALL socket:session:{socketId}               → socket session data
   *
   * Returns a discriminated union: lock failed (no game data) or
   * lock acquired with parsed game, timer, and userData.
   */
  public async executePipelineIn(gameId: string, socketId: string): Promise<PipelineInResult> {
    const token = randomUUID();
    const gKey = gameKey(gameId);
    const sessionKey = `${SOCKET_SESSION_PREFIX}:${socketId}`;

    const pipeline = this.redisService.pipeline();
    // [0] Lock attempt
    pipeline.set(lockKey(gameId), token, "EX", PIPELINE_LOCK_TTL_SECONDS, "NX");
    // [1] Game hash
    pipeline.hgetall(gKey);
    // [2] TTL refresh
    pipeline.expire(gKey, GAME_TTL_IN_SECONDS);
    // [3] Active timer
    pipeline.get(timerKey(gameId));
    // [4] Socket session data
    pipeline.hgetall(sessionKey);

    const results = await pipeline.exec();

    if (!results || results.length < 5) {
      throw new ServerError("IN pipeline returned unexpected number of results");
    }

    // [0] SET NX returns "OK" on success, null on failure
    const lockAcquired = results[0][1] === "OK";

    if (!lockAcquired) {
      return { lockAcquired: false, lockToken: "" };
    }

    // [1] Parse game hash — release lock and throw if game is missing
    const game = GamePipelineService.parseGameHash(results[1][1] as Record<string, string>);

    if (!game) {
      await this.lockService.releaseLock(gameId, token);
      throw new ClientError(ClientResponse.GAME_NOT_FOUND, HttpStatus.NOT_FOUND, { gameId });
    }

    return {
      lockAcquired: true,
      lockToken: token,
      game,
      // [3] Active timer
      timer: GamePipelineService.parseTimer(results[3][1] as string | null),
      // [4] Socket session data
      userData: GamePipelineService.parseUserData(results[4][1] as Record<string, string> | null)
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Read-only Pipeline
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Build and execute a read-only context-fetch pipeline — same data as
   * {@link executePipelineIn} but **without** the lock attempt.
   *
   * Throws {@link ClientError} GAME_NOT_FOUND if the game hash is empty.
   */
  public async executePipelineReadOnly(gameId: string): Promise<PipelineReadResult> {
    const gKey = gameKey(gameId);

    const pipeline = this.redisService.pipeline();
    // [0] Game hash
    pipeline.hgetall(gKey);
    // [1] TTL refresh
    pipeline.expire(gKey, GAME_TTL_IN_SECONDS);

    const results = await pipeline.exec();

    if (!results || results.length < 2) {
      throw new ServerError("Read-only pipeline returned unexpected number of results");
    }

    // [0] Parse game hash
    const game = GamePipelineService.parseGameHash(results[0][1] as Record<string, string>);

    if (!game) {
      throw new ClientError(ClientResponse.GAME_NOT_FOUND, HttpStatus.NOT_FOUND, { gameId });
    }

    return {
      game,
      timer: null,
      userData: null
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  OUT Pipeline
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Build and execute the OUT pipeline from classified mutations.
   *
   * Commands (conditional):
   *   HSET game:{gameId} {...serialized}              (if saveGame)
   *   EXPIRE game:{gameId} 7200                       (if saveGame)
   *   EXPIRE game:package:{gameId} 7200               (if saveGame)
   *   SET game-expiration-warning:{gameId} "1" PX ... (if saveGame)
   *   SET key value PX ttl                            (per timerSet)
   *   DEL key                                         (per timerDelete)
   */
  public async executeOutPipeline(
    classified: OutPipelineInput,
    gameId: string,
    gameIndexData: GameIndexesInputDTO
  ): Promise<void> {
    const pipeline = this.redisService.pipeline();

    // ── Game save ──
    if (classified.saveGame) {
      this.appendGameSave(pipeline, gameId, classified.saveGame.game);
    }

    // ── Game delete ──
    if (classified.deleteGame) {
      this.gameIndexManager.removeGameFromIndexesPipeline(pipeline, gameId, gameIndexData);
      this.appendGameDelete(pipeline, gameId);
    }

    // ── Timer DELETE mutations ──
    for (const m of classified.timerDeletes) {
      pipeline.del(m.key);
    }

    // ── Timer SET mutations ──
    for (const m of classified.timerSets) {
      pipeline.set(m.key, m.value, "PX", m.pxTtl);
    }

    const results = await pipeline.exec();

    if (!results) {
      return;
    }

    for (const [error] of results) {
      if (error) {
        throw error;
      }
    }
  }

  /**
   * Append game-save commands to an existing pipeline.
   * Used by {@link executeOutPipeline}; exposed for callers that build
   * their own pipelines (e.g. drain loop in GameActionExecutor).
   */
  public appendGameSave(pipeline: ChainableCommander, gameId: string, game: Game): void {
    const gKey = gameKey(gameId);
    const pKey = packageKey(gameId);
    const wKey = expirationWarningKey(gameId);

    pipeline.hset(gKey, GameMapper.serializeGameToHash(game));
    pipeline.expire(gKey, GAME_TTL_IN_SECONDS);
    pipeline.expire(pKey, GAME_TTL_IN_SECONDS);

    if (WARNING_TTL_SECONDS > 0) {
      pipeline.set(wKey, "1", "PX", WARNING_TTL_SECONDS * SECOND_MS);
    }
  }

  /**
   * Append game-delete commands to an existing pipeline.
   */
  public appendGameDelete(pipeline: ChainableCommander, gameId: string): void {
    const gKey = gameKey(gameId);
    const pKey = packageKey(gameId);
    const wKey = expirationWarningKey(gameId);
    const tKey = timerKey(gameId);
    const qKey = queueKey(gameId);

    pipeline.del(gKey, pKey, wKey, tKey, qKey);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Session + Game Fetch
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Fetch a socket's session data and the associated game in a single Redis
   * round-trip using a Lua script.
   *
   * Used by forced-leave flows (e.g. UserService.forceLeaveAllGames) where the
   * gameId is not known upfront and must be resolved from the session first.
   *
   * The Lua script atomically:
   *   1. HGETALL socket:session:{socketId}  → session hash (includes gameId)
   *   2. If gameId exists, HGETALL game:{gameId} → game hash
   *
   * Returns null if the session is missing, has no gameId, or the game doesn't exist.
   */
  public async fetchSessionAndGame(socketId: string): Promise<SessionAndGame | null> {
    const sessionKey = `${SOCKET_SESSION_PREFIX}:${socketId}`;

    const result = (await this.redisService.eval(
      FETCH_SESSION_AND_GAME_SCRIPT,
      1,
      sessionKey,
      `${GAME_NAMESPACE}:`
    )) as string[] | null;

    if (!result || result.length === 0) {
      return null;
    }

    const sessionFieldCount = parseInt(result[0], 10);

    // Parse session hash from flat [field, value, ...] pairs
    const rawSession: Record<string, string> = {};
    for (let i = 1; i <= sessionFieldCount; i += 2) {
      rawSession[result[i]] = result[i + 1];
    }

    const userData = GamePipelineService.parseUserData(rawSession);

    if (!userData) {
      return null;
    }

    // If Lua returned only session fields (no game), it means no game was found
    const gameFieldsStart = 1 + sessionFieldCount;

    if (gameFieldsStart >= result.length) {
      return null;
    }

    // Parse game hash from flat [field, value, ...] pairs
    const rawHash: Record<string, string> = {};
    for (let i = gameFieldsStart; i < result.length; i += 2) {
      rawHash[result[i]] = result[i + 1];
    }

    const game = GamePipelineService.parseGameHash(rawHash);

    if (!game) {
      return null;
    }

    return { userData, game };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Static parsing helpers (also used by GameActionExecutor drain path)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Parse a raw game hash into a Game entity.
   * Returns null if the hash is empty, missing, or validation/deserialization fails.
   */
  public static parseGameHash(rawHash: Record<string, string> | null): Game | null {
    if (!rawHash || ValueUtils.isEmpty(rawHash)) {
      return null;
    }

    try {
      const validatedData = GameRedisValidator.validateRedisData(rawHash);
      return GameMapper.deserializeGameHash(validatedData);
    } catch {
      return null;
    }
  }

  /**
   * Parse a raw timer JSON string into a GameStateTimerDTO.
   * Returns null if the value is empty/null or parsing fails.
   */
  public static parseTimer(raw: string | null): GameStateTimerDTO | null {
    if (!raw || ValueUtils.isEmpty(raw)) {
      return null;
    }

    try {
      // TODO: Use Joi schema
      return JSON.parse(raw) as GameStateTimerDTO;
    } catch {
      return null;
    }
  }

  /**
   * Parse a raw socket-session hash into SocketRedisUserData.
   * Returns null if the hash is empty or missing.
   */
  public static parseUserData(
    rawSession: Record<string, string> | null
  ): SocketRedisUserData | null {
    if (!rawSession || ValueUtils.isEmpty(rawSession)) {
      return null;
    }

    return {
      id: asUserId(parseInt(rawSession.id, 10)),
      gameId: rawSession.gameId === "null" || !rawSession.gameId ? null : rawSession.gameId
    };
  }
}
