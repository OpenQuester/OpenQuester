import { EventEmitter } from "events";
import { container } from "tsyringe";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameActionLockService } from "application/services/lock/GameActionLockService";
import { GameActionQueueService } from "application/services/queue/GameActionQueueService";
import { GameActionType } from "domain/enums/GameActionType";
import { type GameAction } from "domain/types/action/GameAction";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import type { GameScenario } from "tests/e2e/scenario/GameScenario";

import { type GameClientSocket } from "./SocketIOGameTestUtils";

const RECENT_ACCEPTED_ACTION_LIMIT = 10;

export interface AcceptedActionRecord {
  readonly sequence: number;
  readonly gameId: string;
  readonly actionId: string;
  readonly actionType: GameActionType;
  readonly playerId: number;
  readonly socketId: string;
  readonly acceptedAt: Date;
}

export interface AcceptedActionFilter {
  readonly gameId: string;
  readonly actionType?: GameActionType;
  readonly playerId?: number;
  readonly socketId?: string;
}

export interface AcceptedActionProbe {
  waitForCount(expectedCount: number, timeoutMs?: number): Promise<void>;
  records(): readonly AcceptedActionRecord[];
  dispose(): void;
}

interface SocketGameTestEventUtilsDependencies {
  readonly lockService?: GameActionLockService;
  readonly queueService?: GameActionQueueService;
  readonly actionExecutor?: GameActionExecutor;
}

type ActionLifecycleEventKind = "accepted-enqueue" | "lock-released" | "drain-progress";

interface ActionLifecycleEvent {
  readonly gameId: string;
  readonly kind: ActionLifecycleEventKind;
  readonly acceptedAction?: AcceptedActionRecord;
}

type ActionLifecyclePredicate = (event?: ActionLifecycleEvent) => Promise<boolean>;

interface ActionDrainSnapshot {
  readonly generationBeforeReads: number;
  readonly generationAfterReads: number;
  readonly inFlightEnqueues: number;
  readonly isLocked: boolean;
  readonly queueLength: number;
  readonly peekAction: GameAction | null;
}

interface PendingAcceptedActionWait {
  readonly id: number;
  readonly expectedCount: number;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
  readonly timeout: NodeJS.Timeout;
}

interface PendingTestWait {
  readonly cancel: () => void;
  readonly promise: Promise<unknown>;
}

/**
 * Watches test-only accepted queue records for one game/filter. It deliberately
 * retains history after a count wait resolves so callers can make exact
 * post-drain assertions.
 */
class AcceptedActionProbeImpl implements AcceptedActionProbe {
  private readonly acceptedRecords: AcceptedActionRecord[] = [];
  private readonly waits = new Map<number, PendingAcceptedActionWait>();
  private nextWaitId = 1;
  private disposed = false;
  private readonly handler = (event: ActionLifecycleEvent): void => {
    const acceptedAction = event.acceptedAction;
    if (event.kind !== "accepted-enqueue" || !acceptedAction || !this.matches(acceptedAction)) {
      return;
    }

    this.acceptedRecords.push(copyAcceptedActionRecord(acceptedAction));
    this.resolveSatisfiedWaits();
  };

  public constructor(private readonly filter: AcceptedActionFilter) {
    SocketGameTestEventUtils.addActionLifecycleListener(filter.gameId, this.handler);
  }

  public waitForCount(
    expectedCount: number,
    timeoutMs: number = TEST_TIMEOUTS.ACTION_QUEUE_WAIT_MS
  ): Promise<void> {
    this.assertNotDisposed();

    if (!Number.isInteger(expectedCount) || expectedCount < 1) {
      throw new Error(
        `Expected accepted action count must be a positive integer, received ${expectedCount}`
      );
    }

    if (this.acceptedRecords.length >= expectedCount) {
      return Promise.resolve();
    }

    const waitId = this.nextWaitId;
    this.nextWaitId += 1;

    let resolveWait: () => void = () => undefined;
    let rejectWait: (error: Error) => void = () => undefined;
    const promise = new Promise<void>((resolve, reject) => {
      resolveWait = resolve;
      rejectWait = reject;
    });
    void promise.catch(() => undefined);
    const timeout = setTimeout(() => {
      const activeWait = this.waits.get(waitId);
      if (!activeWait) {
        return;
      }

      this.waits.delete(waitId);
      activeWait.reject(new Error(this.formatTimeout(expectedCount, timeoutMs)));
    }, timeoutMs);
    const pendingWait: PendingAcceptedActionWait = {
      id: waitId,
      expectedCount,
      resolve: resolveWait,
      reject: rejectWait,
      timeout
    };

    this.waits.set(waitId, pendingWait);
    this.resolveSatisfiedWaits();

    return promise;
  }

  public records(): readonly AcceptedActionRecord[] {
    return this.acceptedRecords.map(copyAcceptedActionRecord);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    SocketGameTestEventUtils.removeActionLifecycleListener(this.filter.gameId, this.handler);

    const pendingWaits = [...this.waits.values()];
    this.waits.clear();
    for (const wait of pendingWaits) {
      clearTimeout(wait.timeout);
      wait.reject(new Error(this.formatDisposedWait(wait.expectedCount)));
    }
  }

  private matches(record: AcceptedActionRecord): boolean {
    return (
      record.gameId === this.filter.gameId &&
      (this.filter.actionType === undefined || record.actionType === this.filter.actionType) &&
      (this.filter.playerId === undefined || record.playerId === this.filter.playerId) &&
      (this.filter.socketId === undefined || record.socketId === this.filter.socketId)
    );
  }

  private resolveSatisfiedWaits(): void {
    for (const wait of [...this.waits.values()]) {
      if (this.acceptedRecords.length < wait.expectedCount) {
        continue;
      }

      clearTimeout(wait.timeout);
      this.waits.delete(wait.id);
      wait.resolve();
    }
  }

  private formatTimeout(expectedCount: number, timeoutMs: number): string {
    return (
      `Timed out after ${timeoutMs}ms waiting for ${expectedCount} accepted/enqueued actions ` +
      `${JSON.stringify(this.filter)}; received ${this.acceptedRecords.length}; recentAccepted=` +
      `${JSON.stringify(this.acceptedRecords.slice(-RECENT_ACCEPTED_ACTION_LIMIT).map(toDebugRecord))}`
    );
  }

  private formatDisposedWait(expectedCount: number): string {
    return (
      `Accepted action probe disposed while waiting for ${expectedCount} accepted/enqueued actions ` +
      `${JSON.stringify(this.filter)}; received ${this.acceptedRecords.length}`
    );
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error(`Accepted action probe is disposed: ${JSON.stringify(this.filter)}`);
    }
  }
}

export class SocketGameTestEventUtils {
  private static readonly actionEvents = new EventEmitter();
  private static readonly instrumentedExecutors = new WeakSet<GameActionExecutor>();
  private static readonly instrumentedQueues = new WeakSet<GameActionQueueService>();
  private static readonly instrumentedLocks = new WeakSet<GameActionLockService>();
  private static readonly instrumentedDrainLocks = new WeakSet<GameActionLockService>();
  private static readonly inFlightEnqueues = new Map<string, number>();
  private static readonly enqueueGenerations = new Map<string, number>();
  private static nextAcceptedActionSequence = 1;

  private readonly lockService: GameActionLockService;
  private readonly queueService: GameActionQueueService;
  private readonly actionExecutor: GameActionExecutor;
  private readonly pendingTestWaits = new Set<PendingTestWait>();
  private scenario: GameScenario | undefined;

  public useScenario(scenario: GameScenario | undefined): void {
    this.scenario = scenario;
  }

  public constructor(dependencies: SocketGameTestEventUtilsDependencies = {}) {
    this.lockService = dependencies.lockService ?? container.resolve(GameActionLockService);
    this.queueService = dependencies.queueService ?? container.resolve(GameActionQueueService);
    this.actionExecutor = dependencies.actionExecutor ?? container.resolve(GameActionExecutor);
    this.installActionLifecycleObservers();
  }

  public waitForEvent<T = any>(
    socket: GameClientSocket,
    event: string,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    signal?: AbortSignal
  ): Promise<T> {
    return this.waitForEventMatching(socket, event, () => true, timeout, signal);
  }

  public waitForEventMatching<T = any>(
    socket: GameClientSocket,
    event: string,
    predicate: (data: T) => boolean,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    signal?: AbortSignal
  ): Promise<T> {
    if (this.scenario) {
      return this.scenario.waitForEventMatching(socket, event, predicate, timeout, signal);
    }
    const effectiveTimeout = Math.min(timeout, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
    const socketId = socket.id;

    if (socket.connected === false) {
      throw new Error(
        `Cannot wait for Socket.IO event "${event}" because the client is disconnected ` +
          formatSocketContext(socket, socketId)
      );
    }

    let cancelWait = (): void => undefined;
    const promise = new Promise<T>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let settled = false;

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeListener(event, onEvent);
        if (event !== "connect_error") {
          socket.removeListener("connect_error", onConnectError);
        }
        if (event !== "disconnect") {
          socket.removeListener("disconnect", onDisconnect);
        }
        signal?.removeEventListener("abort", onAbort);
      };

      const settle = (action: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        action();
      };

      const onEvent = (data: T): void => {
        let matches: boolean;
        try {
          matches = predicate(data);
        } catch (error) {
          settle(() =>
            reject(
              new Error(
                `Socket.IO event predicate failed for "${event}" ${formatSocketContext(socket, socketId)}`,
                { cause: toError(error) }
              )
            )
          );
          return;
        }

        if (matches) {
          settle(() => resolve(data));
        }
      };

      const onConnectError = (error: Error): void => {
        settle(() =>
          reject(
            new Error(
              `Socket.IO connect_error while waiting for event "${event}" ` +
                formatSocketContext(socket, socketId),
              { cause: error }
            )
          )
        );
      };

      const onDisconnect = (reason: string): void => {
        settle(() =>
          reject(
            new Error(
              `Socket.IO client disconnected while waiting for event "${event}" ` +
                formatSocketContext(socket, socketId, `reason="${reason}"`)
            )
          )
        );
      };

      const onAbort = (): void => {
        settle(() =>
          reject(
            new Error(
              `Socket.IO event wait aborted for "${event}" ${formatSocketContext(socket, socketId)}`
            )
          )
        );
      };
      cancelWait = onAbort;

      const onTimeout = (): void => {
        settle(() =>
          reject(
            new Error(
              `Timed out after ${effectiveTimeout}ms waiting for Socket.IO event "${event}" ` +
                formatSocketContext(socket, socketId)
            )
          )
        );
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }

      socket.on(event, onEvent);
      if (event !== "connect_error") {
        socket.once("connect_error", onConnectError);
      }
      if (event !== "disconnect") {
        socket.once("disconnect", onDisconnect);
      }
      signal?.addEventListener("abort", onAbort, { once: true });
      timeoutId = setTimeout(onTimeout, effectiveTimeout);
    });

    return this.trackSocketWait(promise, () => cancelWait());
  }

  public async emitAndWaitForEvent<T = any>(
    socket: GameClientSocket,
    event: string,
    emit: () => void,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    predicate: (data: T) => boolean = () => true
  ): Promise<T> {
    return this.runAndWaitForEvent(
      socket,
      event,
      () => {
        try {
          emit();
        } catch (error) {
          const cause = toError(error);
          throw new Error(
            `Socket.IO emit failed while waiting for event "${event}" ` +
              `${formatSocketContext(socket, socket.id)}: ${cause.message}`,
            { cause }
          );
        }
      },
      timeout,
      predicate
    );
  }

  /**
   * Arms an event wait around a bounded async operation and cancels the wait if
   * that operation fails before the expected event arrives.
   */
  public async runAndWaitForEvent<T = any>(
    socket: GameClientSocket,
    event: string,
    operation: () => void | Promise<void>,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    predicate: (data: T) => boolean = () => true
  ): Promise<T> {
    if (this.scenario) {
      return this.scenario.runAndWaitForEvent(socket, event, operation, timeout, predicate);
    }
    const controller = new AbortController();
    const eventPromise = this.waitForEventMatching(
      socket,
      event,
      predicate,
      timeout,
      controller.signal
    );
    void eventPromise.catch(() => undefined);

    try {
      await operation();
      return await eventPromise;
    } finally {
      controller.abort();
      await Promise.allSettled([eventPromise]);
    }
  }

  public waitForNoEvent(
    socket: GameClientSocket,
    event: string,
    timeout: number = TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
    signal?: AbortSignal
  ): Promise<void> {
    if (this.scenario) {
      return this.scenario.waitForNoEvent(socket, event, timeout, signal);
    }
    const effectiveTimeout = Math.min(timeout, TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS);
    const socketId = socket.id;

    if (socket.connected === false) {
      throw new Error(
        `Cannot assert absence of Socket.IO event "${event}" because the client is disconnected ` +
          formatSocketContext(socket, socketId)
      );
    }

    let cancelWait = (): void => undefined;
    const promise = new Promise<void>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let settled = false;

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeListener(event, onEvent);
        if (event !== "connect_error") {
          socket.removeListener("connect_error", onConnectError);
        }
        if (event !== "disconnect") {
          socket.removeListener("disconnect", onDisconnect);
        }
        signal?.removeEventListener("abort", onAbort);
      };

      const settle = (action: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        action();
      };

      const onEvent = (data: unknown): void => {
        settle(() =>
          reject(
            new Error(
              `Unexpected Socket.IO event "${event}" with data ${formatDebugValue(data)} ` +
                formatSocketContext(socket, socketId)
            )
          )
        );
      };

      const onConnectError = (error: Error): void => {
        settle(() =>
          reject(
            new Error(
              `Socket.IO connect_error while asserting absence of event "${event}" ` +
                formatSocketContext(socket, socketId),
              { cause: error }
            )
          )
        );
      };

      const onDisconnect = (reason: string): void => {
        settle(() =>
          reject(
            new Error(
              `Socket.IO client disconnected while asserting absence of event "${event}" ` +
                formatSocketContext(socket, socketId, `reason="${reason}"`)
            )
          )
        );
      };

      const onAbort = (): void => {
        settle(() =>
          reject(
            new Error(
              `Socket.IO no-event wait aborted for "${event}" ${formatSocketContext(socket, socketId)}`
            )
          )
        );
      };
      cancelWait = onAbort;

      const onTimeout = (): void => {
        settle(resolve);
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }

      socket.once(event, onEvent);
      if (event !== "connect_error") {
        socket.once("connect_error", onConnectError);
      }
      if (event !== "disconnect") {
        socket.once("disconnect", onDisconnect);
      }
      signal?.addEventListener("abort", onAbort, { once: true });
      timeoutId = setTimeout(onTimeout, effectiveTimeout);
    });

    return this.trackSocketWait(promise, () => cancelWait());
  }

  public async cancelPendingEventWaits(): Promise<number> {
    const pendingWaits = [...this.pendingTestWaits];

    for (const wait of pendingWaits) {
      wait.cancel();
    }
    await Promise.allSettled(pendingWaits.map((wait) => wait.promise));

    return pendingWaits.length;
  }

  public createAcceptedActionProbe(filter: AcceptedActionFilter): AcceptedActionProbe {
    return new AcceptedActionProbeImpl(filter);
  }

  /**
   * Waits for a game to have no accepted enqueues in flight, an empty queue,
   * and no action lock. This must only be called after the expected accepted
   * actions have been observed.
   */
  public async waitForActionsComplete(
    gameId: string,
    timeout: number = TEST_TIMEOUTS.ACTION_QUEUE_WAIT_MS
  ): Promise<void> {
    const effectiveTimeout = Math.min(timeout, TEST_TIMEOUTS.ACTION_QUEUE_WAIT_MS);
    let lastSnapshot: ActionDrainSnapshot | undefined;

    await this.waitForActionLifecycleCondition(
      gameId,
      async () => {
        lastSnapshot = await this.readActionDrainSnapshot(gameId);
        return this.isActionDrainComplete(lastSnapshot);
      },
      effectiveTimeout,
      () => this.buildActionDrainTimeoutMessage(gameId, lastSnapshot)
    );
  }

  public async waitForQueueLengthAtLeast(
    gameId: string,
    expectedLength: number,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
  ): Promise<void> {
    const effectiveTimeout = Math.min(timeout, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
    let lastQueueLength: number | undefined;

    await this.waitForActionLifecycleCondition(
      gameId,
      async () => {
        lastQueueLength = await this.queueService.getQueueLength(gameId);
        return lastQueueLength >= expectedLength;
      },
      effectiveTimeout,
      () =>
        `Timed out waiting for queue length ${expectedLength}; current length is ${
          lastQueueLength ?? "unavailable"
        }`
    );
  }

  /**
   * Compatibility facade for existing tests. "Submitted" now means the action
   * successfully completed the atomic Redis enqueue, not that executor entry
   * was reached.
   */
  public waitForSubmittedActions(
    gameId: string,
    expectedCount: number,
    actionType?: GameActionType,
    timeout: number = TEST_TIMEOUTS.ACTION_QUEUE_WAIT_MS
  ): Promise<void> {
    const scenario = this.scenario;
    const probe = scenario
      ? scenario.createAcceptedActionProbe({ gameId, actionType })
      : this.createAcceptedActionProbe({ gameId, actionType });
    const wait = (async () => {
      try {
        await probe.waitForCount(expectedCount, timeout);
      } finally {
        probe.dispose();
      }
    })();
    void wait.catch(() => undefined);
    const trackedWait = this.trackPendingWait(wait, () => probe.dispose());
    return scenario
      ? scenario.trackExpectation(
          trackedWait,
          `${expectedCount} accepted/enqueued actions for game "${gameId}"`
        )
      : trackedWait;
  }

  private installActionLifecycleObservers(): void {
    SocketGameTestEventUtils.actionEvents.setMaxListeners(0);
    this.instrumentExecutorSubmitAction();
    this.instrumentQueueActionAndTryStartProcessor();
    this.instrumentLockRelease();
    this.instrumentDrainAndReacquire();
  }

  private trackSocketWait<T>(promise: Promise<T>, cancel: () => void): Promise<T> {
    return this.trackPendingWait(promise, cancel);
  }

  private trackPendingWait<T>(promise: Promise<T>, cancel: () => void): Promise<T> {
    const pendingWait: PendingTestWait = { cancel, promise };
    this.pendingTestWaits.add(pendingWait);

    void promise.then(
      () => this.pendingTestWaits.delete(pendingWait),
      () => this.pendingTestWaits.delete(pendingWait)
    );

    return promise;
  }

  private instrumentExecutorSubmitAction(): void {
    const executor = this.actionExecutor;

    if (SocketGameTestEventUtils.instrumentedExecutors.has(executor)) {
      return;
    }

    SocketGameTestEventUtils.instrumentedExecutors.add(executor);
    const originalSubmitAction = executor.submitAction.bind(executor);

    executor.submitAction = async (action: GameAction) => {
      try {
        return await originalSubmitAction(action);
      } finally {
        SocketGameTestEventUtils.emitActionLifecycle({
          gameId: action.gameId,
          kind: "drain-progress"
        });
      }
    };
  }

  private instrumentQueueActionAndTryStartProcessor(): void {
    const queueService = this.queueService;

    if (SocketGameTestEventUtils.instrumentedQueues.has(queueService)) {
      return;
    }

    SocketGameTestEventUtils.instrumentedQueues.add(queueService);
    const originalQueueActionAndTryStartProcessor =
      queueService.queueActionAndTryStartProcessor.bind(queueService);

    queueService.queueActionAndTryStartProcessor = async (action: GameAction) => {
      SocketGameTestEventUtils.incrementInFlightEnqueue(action.gameId);

      try {
        const result = await originalQueueActionAndTryStartProcessor(action);
        SocketGameTestEventUtils.emitActionLifecycle({
          gameId: action.gameId,
          kind: "accepted-enqueue",
          acceptedAction: {
            sequence: SocketGameTestEventUtils.nextAcceptedActionSequence,
            gameId: action.gameId,
            actionId: action.id,
            actionType: action.type,
            playerId: action.playerId,
            socketId: action.socketId,
            acceptedAt: new Date()
          }
        });
        SocketGameTestEventUtils.nextAcceptedActionSequence += 1;
        return result;
      } finally {
        SocketGameTestEventUtils.decrementInFlightEnqueue(action.gameId);
      }
    };
  }

  private instrumentLockRelease(): void {
    const lockService = this.lockService;

    if (SocketGameTestEventUtils.instrumentedLocks.has(lockService)) {
      return;
    }

    SocketGameTestEventUtils.instrumentedLocks.add(lockService);
    const originalReleaseLock = lockService.releaseLock.bind(lockService);

    lockService.releaseLock = async (gameId: string, token: string) => {
      try {
        return await originalReleaseLock(gameId, token);
      } finally {
        SocketGameTestEventUtils.emitActionLifecycle({ gameId, kind: "lock-released" });
      }
    };
  }

  private instrumentDrainAndReacquire(): void {
    const lockService = this.lockService;

    if (SocketGameTestEventUtils.instrumentedDrainLocks.has(lockService)) {
      return;
    }

    SocketGameTestEventUtils.instrumentedDrainLocks.add(lockService);
    const originalDrainAndReacquire = lockService.drainAndReacquire.bind(lockService);

    lockService.drainAndReacquire = async (...args) => {
      const gameId = this.getGameIdFromRedisKey(args[0]);

      try {
        return await originalDrainAndReacquire(...args);
      } finally {
        SocketGameTestEventUtils.emitActionLifecycle({ gameId, kind: "drain-progress" });
      }
    };
  }

  private async waitForActionLifecycleCondition(
    gameId: string,
    predicate: ActionLifecyclePredicate,
    timeout: number,
    buildTimeoutMessage: () => string
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let settled = false;

      const cleanup = (handler: (event: ActionLifecycleEvent) => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        SocketGameTestEventUtils.removeActionLifecycleListener(gameId, handler);
      };

      const handler = (event: ActionLifecycleEvent): void => {
        void check(event);
      };

      const check = async (event?: ActionLifecycleEvent): Promise<void> => {
        if (settled) {
          return;
        }

        try {
          const matches = await predicate(event);
          if (settled) {
            return;
          }

          if (matches) {
            cleanup(handler);
            resolve();
          }
        } catch (error) {
          if (settled) {
            return;
          }

          cleanup(handler);
          reject(error);
        }
      };

      const onTimeout = (): void => {
        if (settled) {
          return;
        }

        cleanup(handler);
        try {
          reject(new Error(buildTimeoutMessage()));
        } catch (error) {
          reject(error);
        }
      };

      timeoutId = setTimeout(onTimeout, timeout);
      SocketGameTestEventUtils.addActionLifecycleListener(gameId, handler);
      void check();
    });
  }

  private async readActionDrainSnapshot(gameId: string): Promise<ActionDrainSnapshot> {
    const generationBeforeReads = SocketGameTestEventUtils.getEnqueueGeneration(gameId);
    const [isLocked, queueLength, peekAction] = await Promise.all([
      this.lockService.isLocked(gameId),
      this.queueService.getQueueLength(gameId),
      this.queueService.peekAction(gameId)
    ]);
    const generationAfterReads = SocketGameTestEventUtils.getEnqueueGeneration(gameId);

    return {
      generationBeforeReads,
      generationAfterReads,
      inFlightEnqueues: SocketGameTestEventUtils.getInFlightEnqueueCount(gameId),
      isLocked,
      queueLength,
      peekAction
    };
  }

  private isActionDrainComplete(snapshot: ActionDrainSnapshot): boolean {
    return (
      snapshot.generationBeforeReads === snapshot.generationAfterReads &&
      snapshot.inFlightEnqueues === 0 &&
      snapshot.queueLength === 0 &&
      !snapshot.isLocked
    );
  }

  private buildActionDrainTimeoutMessage(
    gameId: string,
    snapshot: ActionDrainSnapshot | undefined
  ): string {
    return `Timed out waiting for game actions to complete: ${JSON.stringify({
      gameId,
      ...(snapshot ?? {
        inFlightEnqueues: SocketGameTestEventUtils.getInFlightEnqueueCount(gameId),
        diagnostics: "unavailable"
      })
    })}`;
  }

  private getGameIdFromRedisKey(redisKey: string): string {
    return redisKey.slice(redisKey.lastIndexOf(":") + 1);
  }

  private static incrementInFlightEnqueue(gameId: string): void {
    const nextCount = this.getInFlightEnqueueCount(gameId) + 1;
    this.inFlightEnqueues.set(gameId, nextCount);
    this.advanceEnqueueGeneration(gameId);
    this.emitActionLifecycle({ gameId, kind: "drain-progress" });
  }

  private static decrementInFlightEnqueue(gameId: string): void {
    const nextCount = this.getInFlightEnqueueCount(gameId) - 1;

    if (nextCount <= 0) {
      this.inFlightEnqueues.delete(gameId);
    } else {
      this.inFlightEnqueues.set(gameId, nextCount);
    }

    this.advanceEnqueueGeneration(gameId);
    this.emitActionLifecycle({ gameId, kind: "drain-progress" });
  }

  private static getInFlightEnqueueCount(gameId: string): number {
    return this.inFlightEnqueues.get(gameId) ?? 0;
  }

  private static advanceEnqueueGeneration(gameId: string): void {
    this.enqueueGenerations.set(gameId, this.getEnqueueGeneration(gameId) + 1);
  }

  private static getEnqueueGeneration(gameId: string): number {
    return this.enqueueGenerations.get(gameId) ?? 0;
  }

  public static addActionLifecycleListener(
    gameId: string,
    handler: (event: ActionLifecycleEvent) => void
  ): void {
    this.actionEvents.on(gameId, handler);
  }

  public static removeActionLifecycleListener(
    gameId: string,
    handler: (event: ActionLifecycleEvent) => void
  ): void {
    this.actionEvents.removeListener(gameId, handler);
  }

  private static emitActionLifecycle(event: ActionLifecycleEvent): void {
    this.actionEvents.emit(event.gameId, event);
  }
}

function copyAcceptedActionRecord(record: AcceptedActionRecord): AcceptedActionRecord {
  return {
    ...record,
    acceptedAt: new Date(record.acceptedAt)
  };
}

function toDebugRecord(record: AcceptedActionRecord): Record<string, unknown> {
  return {
    sequence: record.sequence,
    gameId: record.gameId,
    actionId: record.actionId,
    actionType: record.actionType,
    playerId: record.playerId,
    socketId: record.socketId,
    acceptedAt: record.acceptedAt.toISOString()
  };
}

function formatSocketContext(
  socket: GameClientSocket,
  socketId: string | undefined,
  extra?: string
): string {
  const extraPart = extra ? `${extra}, ` : "";
  return (
    `(gameId="${socket.gameId ?? "unknown"}", socketId="${socketId ?? "unknown"}", ` +
    `role="${socket.role ?? "unknown"}", ${extraPart}connected=${socket.connected})`
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function formatDebugValue(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
