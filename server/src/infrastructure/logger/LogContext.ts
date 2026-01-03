import { AsyncLocalStorage } from "async_hooks";

import { LogTag } from "infrastructure/logger/LogTag";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Request-scoped context for correlation across logs.
 * Propagated automatically through async operations via AsyncLocalStorage.
 *
 * Each field is optional except correlationId (always generated).
 * Context is immutable after creation - use setter methods to update fields.
 */
export interface RequestContext {
  /** Unique ID for tracing this request/event across all logs */
  correlationId: string;
  /** User making the request (if authenticated) */
  userId?: number;
  /** Game id (if applicable) */
  gameId?: string;
  /** Socket ID (for socket events) */
  socketId?: string;
  /** Categorization tags for filtering */
  tags: Set<LogTag>;
  /** Request start time */
  startTime: number;
}

/**
 * Request-scoped logging context using AsyncLocalStorage.
 *
 * ## How AsyncLocalStorage Works
 *
 * Node.js is single-threaded but handles requests concurrently via the event loop.
 * When multiple users send requests simultaneously, their code interleaves:
 *
 * ```
 * User A starts → User B starts → User A awaits DB → User B awaits DB → User A continues → ...
 * ```
 *
 * AsyncLocalStorage solves the "which request am I in?" problem by creating an
 * **isolated context per async execution chain**. When you call `storage.run(context, fn)`:
 *
 * 1. Node.js associates `context` with `fn` and ALL async operations it triggers
 * 2. Any code inside `fn` (or its awaited Promises, callbacks, etc.) can access
 *    that context via `storage.getStore()`
 * 3. Other concurrent requests have their OWN separate context - they don't mix
 *
 * Think of it like "thread-local storage" but for async chains instead of threads.
 *
 * ## Why It's Safe for Concurrent Requests
 *
 * ```typescript
 * // Request A enters middleware, creates contextA
 * LogContextService.run(contextA, async () => {
 *   // Even if Request B starts NOW and creates contextB...
 *   await database.query(); // ...this line still sees contextA
 *   logger.info("done");    // ...this log still gets correlationIdA
 * });
 * ```
 *
 * The event loop may pause Request A and run Request B's code, but when Request A
 * resumes, it still has access to its original context (contextA).
 *
 * ## Multi-Instance Deployment
 *
 * Each server instance runs its own Node.js process with independent AsyncLocalStorage.
 * A single socket/HTTP request is always handled by ONE instance from start to finish
 * (no mid-request load balancing), so context isolation is guaranteed.
 *
 * ## Usage
 *
 * - HTTP: `correlationMiddleware` wraps entire request lifecycle
 * - Socket: `BaseSocketEventHandler.handle()` wraps event processing
 * - All logs within the scope auto-include correlationId, userId, gameId, tags
 */
export class LogContextService {
  private static storage = new AsyncLocalStorage<RequestContext>();

  /**
   * Run a function within a request context.
   * All logs within this scope will include context metadata.
   */
  static run<T>(context: RequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * Run an async function within a request context.
   */
  static async runAsync<T>(
    context: RequestContext,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.storage.run(context, fn);
  }

  /**
   * Get current request context (undefined if not within a context scope).
   */
  static getContext(): RequestContext | null {
    return this.storage.getStore() ?? null;
  }

  /**
   * Get correlation ID from current context.
   * Useful for including in error responses or custom log messages.
   */
  static getCorrelationId(): string | null {
    return this.getContext()?.correlationId ?? null;
  }

  /**
   * Add a tag to current context.
   */
  static addTag(tag: LogTag): void {
    const ctx = this.getContext();
    if (ctx) ctx.tags.add(tag);
  }

  /**
   * Set game ID in current context.
   */
  static setGameId(gameId: string): void {
    const ctx = this.getContext();
    if (ctx) ctx.gameId = gameId;
  }

  /**
   * Set user ID in current context.
   * Can be called after authentication to enrich logs with user info.
   */
  static setUserId(userId: number): void {
    const ctx = this.getContext();
    if (ctx) ctx.userId = userId;
  }

  /**
   * Create a new context with a fresh correlation ID.
   */
  static createContext(opts?: Partial<RequestContext>): RequestContext {
    return {
      correlationId: opts?.correlationId ?? ValueUtils.generateUUID(),
      tags: opts?.tags ?? new Set(),
      startTime: opts?.startTime ?? Date.now(),
      userId: opts?.userId,
      gameId: opts?.gameId,
      socketId: opts?.socketId,
    };
  }
}
