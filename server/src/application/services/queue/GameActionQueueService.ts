import { singleton } from "tsyringe";

import { QUEUE_ACTION_AND_TRY_LOCK_SCRIPT } from "domain/lua/actionLuaScripts";
import { lockKey } from "domain/constants/redisKeys";
import { GameAction, SerializedGameAction } from "domain/types/action/GameAction";
import { RedisService } from "application/services/redis/RedisService";
import { ValueUtils } from "domain/utils/ValueUtils";

interface QueueActionProcessorStartResult {
  shouldProcessQueue: boolean;
  lockToken: string;
}

/**
 * Redis-backed FIFO queue for game actions
 *
 * Purpose: Store actions that arrive while game is locked, ensuring they execute in order
 *
 * Architecture:
 * - Each game has a separate queue (Redis list)
 * - Actions serialized with payload as JSON for persistence
 * - FIFO: new actions pushed to tail (rpush), processed from head (lpop)
 *
 * Integration:
 * - GameActionExecutor pushes actions when lock unavailable
 * - After releasing lock, GameActionExecutor drains queue recursively
 * - Queue cleared when game deleted/finished
 */
@singleton()
export class GameActionQueueService {
  private readonly QUEUE_KEY_PREFIX = "game:action:queue";
  private readonly DEFAULT_LOCK_TTL = 20;

  constructor(private readonly redisService: RedisService) {
    //
  }

  /**
   * Push action to end of game's action queue
   */
  public async pushAction(action: GameAction): Promise<void> {
    const queueKey = this._getQueueKey(action.gameId);
    await this.redisService.rpush(queueKey, this.serializeAction(action));
  }

  /**
   * Queue an action first, then try to become this game's queue processor.
   *
   * The action is always persisted before lock acquisition is attempted, so a
   * late enqueue cannot be missed by a processor that is about to release the
   * lock. If the lock is acquired, the caller must drain the queue.
   */
  public async queueActionAndTryStartProcessor(
    action: GameAction
  ): Promise<QueueActionProcessorStartResult> {
    const queueKey = this._getQueueKey(action.gameId);
    const token = ValueUtils.generateUUID();
    const result = (await this.redisService.eval(
      QUEUE_ACTION_AND_TRY_LOCK_SCRIPT,
      2,
      queueKey,
      lockKey(action.gameId),
      this.serializeAction(action),
      token,
      this.DEFAULT_LOCK_TTL
    )) as [number, string];

    const acquired = Number(result[0]) === 1;

    return {
      shouldProcessQueue: acquired,
      lockToken: acquired ? token : ""
    };
  }

  /**
   * Peek at next action without removing it
   */
  public async peekAction(gameId: string): Promise<GameAction | null> {
    const queueKey = this._getQueueKey(gameId);
    const serialized = await this.redisService.lindex(queueKey, 0);

    if (!serialized) {
      return null;
    }

    return this._deserializeAction(serialized);
  }

  /**
   * Get queue length for a game
   */
  public async getQueueLength(gameId: string): Promise<number> {
    const queueKey = this._getQueueKey(gameId);
    return this.redisService.llen(queueKey);
  }

  public serializeAction(action: GameAction): string {
    const serialized: SerializedGameAction = {
      ...action,
      timestamp: action.timestamp.toISOString(),
      payload: JSON.stringify(action.payload)
    };

    return JSON.stringify(serialized);
  }

  private _deserializeAction(serialized: string): GameAction {
    const parsed: SerializedGameAction = JSON.parse(serialized);
    return {
      ...parsed,
      timestamp: new Date(parsed.timestamp),
      payload: JSON.parse(parsed.payload)
    };
  }

  private _getQueueKey(gameId: string): string {
    return `${this.QUEUE_KEY_PREFIX}:${gameId}`;
  }
}
