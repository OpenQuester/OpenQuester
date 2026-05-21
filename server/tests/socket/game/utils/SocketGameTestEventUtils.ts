import { EventEmitter } from "events";
import { container } from "tsyringe";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameActionLockService } from "application/services/lock/GameActionLockService";
import { GameActionQueueService } from "application/services/queue/GameActionQueueService";
import { GameActionType } from "domain/enums/GameActionType";
import { type GameAction } from "domain/types/action/GameAction";
import { GameClientSocket } from "./SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

type ActionLifecycleEventKind =
  | "action-submitted"
  | "queue-mutated"
  | "lock-released"
  | "drain-progress";

interface ActionLifecycleEvent {
  gameId: string;
  kind: ActionLifecycleEventKind;
  actionId?: string;
  actionType?: GameActionType;
}

type ActionLifecyclePredicate = (event?: ActionLifecycleEvent) => Promise<boolean>;

export class SocketGameTestEventUtils {
  private static readonly actionEvents = new EventEmitter();
  private static readonly instrumentedExecutors = new WeakSet<GameActionExecutor>();
  private static readonly instrumentedQueues = new WeakSet<GameActionQueueService>();
  private static readonly instrumentedLocks = new WeakSet<GameActionLockService>();
  private static readonly instrumentedDrainLocks = new WeakSet<GameActionLockService>();

  private lockService = container.resolve(GameActionLockService);
  private queueService = container.resolve(GameActionQueueService);
  private actionExecutor = container.resolve(GameActionExecutor);

  public constructor() {
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
        socket.removeListener(event, handler); // Ensure listener is removed
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

  /**
   * Waits for a specified time to ensure that a specific event is NOT received.
   * If the event is received, the promise rejects immediately.
   * If the timeout completes without the event, the promise resolves successfully.
   */
  public async waitForNoEvent(
    socket: GameClientSocket,
    event: string,
    timeout: number = TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
  ): Promise<void> {
    const effectiveTimeout = Math.min(timeout, TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS);
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const handler = (data: any) => {
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
        resolve(); // Success - no event was received
      };

      timeoutId = setTimeout(onTimeout, effectiveTimeout);
      socket.once(event, handler);
    });
  }

  /**
   * Wait for all queued actions and locks to complete for a game.
   * The wait is event-driven: queue/lock/executor lifecycle events trigger rechecks.
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

  public async waitForSubmittedActions(
    gameId: string,
    expectedCount: number,
    actionType?: GameActionType,
    timeout: number = TEST_TIMEOUTS.ACTION_QUEUE_WAIT_MS
  ): Promise<void> {
    const effectiveTimeout = timeout;
    let submittedCount = 0;

    await this.waitForActionLifecycleCondition(
      gameId,
      async (event?: ActionLifecycleEvent) => {
        if (
          event?.kind === "action-submitted" &&
          (actionType === undefined || event.actionType === actionType)
        ) {
          submittedCount++;
        }

        return submittedCount >= expectedCount;
      },
      effectiveTimeout,
      async () =>
        `Timed out waiting for ${expectedCount} submitted ${actionType ?? "game"} actions; received ${submittedCount}`
    );
  }

  private installActionLifecycleObservers(): void {
    SocketGameTestEventUtils.actionEvents.setMaxListeners(0);
    this.instrumentExecutorSubmitAction();
    this.instrumentQueuePushAction();
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
      this.emitActionLifecycle({
        gameId: action.gameId,
        kind: "action-submitted",
        actionId: action.id,
        actionType: action.type
      });

      try {
        return await originalSubmitAction(action);
      } finally {
        this.emitActionLifecycle({
          gameId: action.gameId,
          kind: "drain-progress",
          actionId: action.id,
          actionType: action.type
        });
      }
    };
  }

  private instrumentQueuePushAction(): void {
    const queueService = this.queueService;

    if (SocketGameTestEventUtils.instrumentedQueues.has(queueService)) {
      return;
    }

    SocketGameTestEventUtils.instrumentedQueues.add(queueService);
    const originalPushAction = queueService.pushAction.bind(queueService);

    queueService.pushAction = async (action: GameAction) => {
      await originalPushAction(action);
      this.emitActionLifecycle({
        gameId: action.gameId,
        kind: "queue-mutated",
        actionId: action.id,
        actionType: action.type
      });
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
        this.emitActionLifecycle({ gameId, kind: "lock-released" });
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
      const result = await originalDrainAndReacquire(...args);
      const gameId = this.getGameIdFromRedisKey(args[0]);
      this.emitActionLifecycle({ gameId, kind: "drain-progress" });
      return result;
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

        SocketGameTestEventUtils.actionEvents.removeListener(gameId, handler);
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
            cleanup(handler);
            reject(new Error(message));
          })
          .catch((error) => {
            cleanup(handler);
            reject(error);
          });
      };

      timeoutId = setTimeout(onTimeout, timeout);
      SocketGameTestEventUtils.actionEvents.on(gameId, handler);
      void check();
    });
  }

  private async isActionDrainComplete(gameId: string): Promise<boolean> {
    const isLocked = await this.lockService.isLocked(gameId);
    const queueLength = await this.queueService.getQueueLength(gameId);

    return !isLocked && queueLength === 0;
  }

  private async buildActionDrainTimeoutMessage(gameId: string): Promise<string> {
    const isLocked = await this.lockService.isLocked(gameId);
    const queueLength = await this.queueService.getQueueLength(gameId);
    const peekAction = await this.queueService.peekAction(gameId);

    return `Timed out waiting for game actions to complete: ${JSON.stringify({
      gameId,
      isLocked,
      queueLength,
      peekAction
    })}`;
  }

  private emitActionLifecycle(event: ActionLifecycleEvent): void {
    SocketGameTestEventUtils.actionEvents.emit(event.gameId, event);
  }

  private getGameIdFromRedisKey(redisKey: string): string {
    return redisKey.slice(redisKey.lastIndexOf(":") + 1);
  }
}
