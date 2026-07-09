import { EventEmitter } from "events";
import { container } from "tsyringe";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameActionLockService } from "application/services/lock/GameActionLockService";
import { GameActionQueueService } from "application/services/queue/GameActionQueueService";
import { GameActionType } from "domain/enums/GameActionType";
import { type GameAction } from "domain/types/action/GameAction";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

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

export interface SocketGameTestEventUtilsDependencies {
  readonly lockService?: GameActionLockService;
  readonly queueService?: GameActionQueueService;
  readonly actionExecutor?: GameActionExecutor;
}

type ActionLifecycleEventKind =
  | "accepted-enqueue"
  | "lock-released"
  | "drain-progress";

interface ActionLifecycleEvent {
  readonly gameId: string;
  readonly kind: ActionLifecycleEventKind;
  readonly acceptedAction?: AcceptedActionRecord;
}

type ActionLifecyclePredicate = (event?: ActionLifecycleEvent) => Promise<boolean>;

interface PendingAcceptedActionWait {
  readonly id: number;
  readonly expectedCount: number;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
  readonly timeout: NodeJS.Timeout;
  readonly promise: Promise<void>;
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
      throw new Error(`Expected accepted action count must be a positive integer, received ${expectedCount}`);
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
      timeout,
      promise
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

    void Promise.allSettled(pendingWaits.map((wait) => wait.promise));
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

  public constructor(dependencies: SocketGameTestEventUtilsDependencies = {}) {
    this.lockService = dependencies.lockService ?? container.resolve(GameActionLockService);
    this.queueService = dependencies.queueService ?? container.resolve(GameActionQueueService);
    this.actionExecutor = dependencies.actionExecutor ?? container.resolve(GameActionExecutor);
    this.installActionLifecycleObservers();
  }

  public async waitForEvent<T = any>(
    socket: GameClientSocket,
    event: string,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
  ): Promise<T> {
    const effectiveTimeout = Math.min(timeout, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const handler = (data: T) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeListener(event, handler);
        resolve(data);
      };

      const onTimeout = () => {
        timeoutId = null;
        socket.removeListener(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      };

      timeoutId = setTimeout(onTimeout, effectiveTimeout);
      socket.once(event, handler);
    });
  }

  public async waitForNoEvent(
    socket: GameClientSocket,
    event: string,
    timeout: number = TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
  ): Promise<void> {
    const effectiveTimeout = Math.min(timeout, TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS);
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const handler = (data: unknown) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeListener(event, handler);
        reject(new Error(`Unexpected event received: ${event}. Data: ${JSON.stringify(data)}`));
      };

      const onTimeout = () => {
        timeoutId = null;
        socket.removeListener(event, handler);
        resolve();
      };

      timeoutId = setTimeout(onTimeout, effectiveTimeout);
      socket.once(event, handler);
    });
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

    await this.waitForActionLifecycleCondition(
      gameId,
      () => this.isActionDrainComplete(gameId),
      effectiveTimeout,
      () => this.buildActionDrainTimeoutMessage(gameId)
    );
  }

  public async waitForQueueLengthAtLeast(
    gameId: string,
    expectedLength: number,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
  ): Promise<void> {
    const effectiveTimeout = Math.min(timeout, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);

    await this.waitForActionLifecycleCondition(
      gameId,
      async () => (await this.queueService.getQueueLength(gameId)) >= expectedLength,
      effectiveTimeout,
      async () => {
        const queueLength = await this.queueService.getQueueLength(gameId);
        return `Timed out waiting for queue length ${expectedLength}; current length is ${queueLength}`;
      }
    );
  }

  /**
   * Compatibility facade for existing tests. "Submitted" now means the action
   * successfully completed the atomic Redis enqueue, not that executor entry
   * was reached.
   */
  public async waitForSubmittedActions(
    gameId: string,
    expectedCount: number,
    actionType?: GameActionType,
    timeout: number = TEST_TIMEOUTS.ACTION_QUEUE_WAIT_MS
  ): Promise<void> {
    const probe = this.createAcceptedActionProbe({ gameId, actionType });

    try {
      await probe.waitForCount(expectedCount, timeout);
    } finally {
      probe.dispose();
    }
  }

  private installActionLifecycleObservers(): void {
    SocketGameTestEventUtils.actionEvents.setMaxListeners(0);
    this.instrumentExecutorSubmitAction();
    this.instrumentQueueActionAndTryStartProcessor();
    this.instrumentLockRelease();
    this.instrumentDrainAndReacquire();
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
    buildTimeoutMessage: () => Promise<string>
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
          if (await predicate(event)) {
            cleanup(handler);
            resolve();
          }
        } catch (error) {
          cleanup(handler);
          reject(error);
        }
      };

      const onTimeout = (): void => {
        void buildTimeoutMessage()
          .then((message) => {
            if (settled) {
              return;
            }

            cleanup(handler);
            reject(new Error(message));
          })
          .catch((error) => {
            if (settled) {
              return;
            }

            cleanup(handler);
            reject(error);
          });
      };

      timeoutId = setTimeout(onTimeout, timeout);
      SocketGameTestEventUtils.addActionLifecycleListener(gameId, handler);
      void check();
    });
  }

  private async isActionDrainComplete(gameId: string): Promise<boolean> {
    const generationBeforeReads = SocketGameTestEventUtils.getEnqueueGeneration(gameId);
    const [isLocked, queueLength] = await Promise.all([
      this.lockService.isLocked(gameId),
      this.queueService.getQueueLength(gameId)
    ]);
    const generationAfterReads = SocketGameTestEventUtils.getEnqueueGeneration(gameId);

    return (
      generationBeforeReads === generationAfterReads &&
      SocketGameTestEventUtils.getInFlightEnqueueCount(gameId) === 0 &&
      queueLength === 0 &&
      !isLocked
    );
  }

  private async buildActionDrainTimeoutMessage(gameId: string): Promise<string> {
    const [isLocked, queueLength, peekAction] = await Promise.all([
      this.lockService.isLocked(gameId),
      this.queueService.getQueueLength(gameId),
      this.queueService.peekAction(gameId)
    ]);

    return `Timed out waiting for game actions to complete: ${JSON.stringify({
      gameId,
      inFlightEnqueues: SocketGameTestEventUtils.getInFlightEnqueueCount(gameId),
      isLocked,
      queueLength,
      peekAction
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
