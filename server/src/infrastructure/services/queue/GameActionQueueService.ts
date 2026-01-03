import {
  GameAction,
  SerializedGameAction,
} from "domain/types/action/GameAction";
import { RedisService } from "infrastructure/services/redis/RedisService";

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
export class GameActionQueueService {
  private readonly QUEUE_KEY_PREFIX = "game:action:queue";

  constructor(private readonly redisService: RedisService) {
    //
  }

  private getQueueKey(gameId: string): string {
    return `${this.QUEUE_KEY_PREFIX}:${gameId}`;
  }

  /**
   * Push action to end of game's action queue
   */
  public async pushAction(action: GameAction): Promise<void> {
    const queueKey = this.getQueueKey(action.gameId);

    const serialized: SerializedGameAction = {
      ...action,
      timestamp: action.timestamp.toISOString(),
      payload: JSON.stringify(action.payload),
    };

    await this.redisService.rpush(queueKey, JSON.stringify(serialized));
  }

  /**
   * Pop action from front of game's action queue
   */
  public async popAction(gameId: string): Promise<GameAction | null> {
    const queueKey = this.getQueueKey(gameId);
    const serialized = await this.redisService.lpop(queueKey);

    if (!serialized) {
      return null;
    }

    return this.deserializeAction(serialized);
  }

  /**
   * Peek at next action without removing it
   */
  public async peekAction(gameId: string): Promise<GameAction | null> {
    const queueKey = this.getQueueKey(gameId);
    const serialized = await this.redisService.lindex(queueKey, 0);

    if (!serialized) {
      return null;
    }

    return this.deserializeAction(serialized);
  }

  /**
   * Get queue length for a game
   */
  public async getQueueLength(gameId: string): Promise<number> {
    const queueKey = this.getQueueKey(gameId);
    return this.redisService.llen(queueKey);
  }

  /**
   * Check if queue is empty
   */
  public async isEmpty(gameId: string): Promise<boolean> {
    const length = await this.getQueueLength(gameId);
    return length === 0;
  }

  /**
   * Clear all actions in queue for a game
   */
  public async clearQueue(gameId: string): Promise<void> {
    const queueKey = this.getQueueKey(gameId);
    await this.redisService.del(queueKey);
  }

  private deserializeAction(serialized: string): GameAction {
    const parsed: SerializedGameAction = JSON.parse(serialized);
    return {
      ...parsed,
      timestamp: new Date(parsed.timestamp),
      payload: JSON.parse(parsed.payload),
    };
  }
}
