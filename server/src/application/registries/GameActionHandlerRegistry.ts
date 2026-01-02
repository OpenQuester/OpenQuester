import { GameActionType } from "domain/enums/GameActionType";
import { GameActionHandler } from "domain/types/action/GameActionHandler";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Registry for game action handlers.
 *
 * Maps GameActionType to handler instances. Used by GameActionExecutor
 * to find the correct handler for queued actions.
 *
 * This enables distributed execution: any server instance can pick up
 * a queued action from Redis and execute it using the registered handler.
 */
export class GameActionHandlerRegistry {
  private readonly handlers = new Map<GameActionType, GameActionHandler>();

  constructor(private readonly logger: ILogger) {}

  /**
   * Register a handler for a specific action type.
   * @throws Error if handler already registered for this type
   */
  public register<TPayload, TResult>(
    actionType: GameActionType,
    handler: GameActionHandler<TPayload, TResult>
  ): void {
    if (this.handlers.has(actionType)) {
      this.logger.warn(
        `Action handler for ${actionType} already registered. Overriding.`,
        { prefix: LogPrefix.ACTION_REGISTRY }
      );
    }

    this.handlers.set(actionType, handler as GameActionHandler);
    this.logger.info(`Registered action handler for ${actionType}`, {
      prefix: LogPrefix.ACTION_REGISTRY,
    });
  }

  /**
   * Get handler for action type.
   * @returns Handler or undefined if not registered
   */
  public get<TPayload = unknown, TResult = unknown>(
    actionType: GameActionType
  ): GameActionHandler<TPayload, TResult> | undefined {
    return this.handlers.get(actionType) as
      | GameActionHandler<TPayload, TResult>
      | undefined;
  }

  /**
   * Check if handler is registered for action type.
   */
  public has(actionType: GameActionType): boolean {
    return this.handlers.has(actionType);
  }

  /**
   * Get all registered action types.
   */
  public getRegisteredTypes(): GameActionType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get statistics about registered handlers.
   */
  public getStats(): { total: number; types: GameActionType[] } {
    return {
      total: this.handlers.size,
      types: this.getRegisteredTypes(),
    };
  }
}
