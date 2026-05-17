import { AsyncLocalStorage } from "async_hooks";

import { ValueUtils } from "domain/utils/ValueUtils";
import { LogTag } from "shared/logging/LogTag";

/**
 * Request-scoped context for correlation across logs.
 */
export interface RequestContext {
  correlationId: string;
  userId?: number;
  gameId?: string;
  socketId?: string;
  tags: Set<LogTag>;
  startTime: number;
}

/**
 * Request-scoped logging context using AsyncLocalStorage.
 */
export class LogContextService {
  private static storage = new AsyncLocalStorage<RequestContext>();

  public static run<T>(context: RequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  public static async runAsync<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(context, fn);
  }

  public static getContext(): RequestContext | null {
    return this.storage.getStore() ?? null;
  }

  public static addTag(tag: LogTag): void {
    const ctx = this.getContext();
    if (ctx) ctx.tags.add(tag);
  }

  public static setGameId(gameId: string): void {
    const ctx = this.getContext();
    if (ctx) ctx.gameId = gameId;
  }

  public static createContext(opts?: Partial<RequestContext>): RequestContext {
    return {
      correlationId: opts?.correlationId ?? ValueUtils.generateUUID(),
      tags: opts?.tags ?? new Set(),
      startTime: opts?.startTime ?? Date.now(),
      userId: opts?.userId,
      gameId: opts?.gameId,
      socketId: opts?.socketId
    };
  }
}
