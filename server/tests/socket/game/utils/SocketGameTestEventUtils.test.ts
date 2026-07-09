import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";

import { type GameActionExecutor } from "application/executors/GameActionExecutor";
import { type GameActionLockService } from "application/services/lock/GameActionLockService";
import { type GameActionQueueService } from "application/services/queue/GameActionQueueService";
import { GameActionType } from "domain/enums/GameActionType";
import { type GameAction } from "domain/types/action/GameAction";
import { SocketGameTestEventUtils } from "tests/socket/game/utils/SocketGameTestEventUtils";

const GAME_ID = "game-1";

class ControlledQueueService {
  public queueLength = 0;
  public nextAction: GameAction | null = null;
  public enqueueImplementation: (action: GameAction) => Promise<unknown> = async () => ({
    shouldProcessQueue: false,
    lockToken: ""
  });

  public queueActionAndTryStartProcessor = async (action: GameAction): Promise<unknown> =>
    this.enqueueImplementation(action);

  public getQueueLength = async (_gameId: string): Promise<number> => this.queueLength;

  public peekAction = async (_gameId: string): Promise<GameAction | null> => this.nextAction;
}

class ControlledLockService {
  public locked = false;

  public isLocked = async (_gameId: string): Promise<boolean> => this.locked;

  public releaseLock = async (_gameId: string, _token: string): Promise<boolean> => true;

  public drainAndReacquire = async (..._args: unknown[]): Promise<unknown> => ({ status: 1 });
}

class ControlledExecutor {
  public submitAction = async (_action: GameAction): Promise<unknown> => ({ success: true });
}

interface Fixture {
  readonly utils: SocketGameTestEventUtils;
  readonly queue: ControlledQueueService;
  readonly lock: ControlledLockService;
}

afterEach(() => {
  jest.useRealTimers();
});

describe("SocketGameTestEventUtils", () => {
  it("does not resolve an accepted-action probe while atomic enqueue is pending", async () => {
    const fixture = createFixture();
    const deferred = createDeferred<unknown>();
    fixture.queue.enqueueImplementation = () => deferred.promise;
    const probe = fixture.utils.createAcceptedActionProbe({ gameId: GAME_ID });
    const wait = probe.waitForCount(1);
    let resolved = false;
    void wait.then(() => {
      resolved = true;
    });

    const enqueue = fixture.queue.queueActionAndTryStartProcessor(createAction("pending"));
    await Promise.resolve();

    expect(resolved).toBe(false);
    deferred.resolve({ shouldProcessQueue: false, lockToken: "" });
    await enqueue;
    await wait;

    expect(probe.records()).toHaveLength(1);
    probe.dispose();
  });

  it("signals lifecycle waiters when in-flight enqueue count changes", async () => {
    const fixture = createFixture();
    const deferred = createDeferred<unknown>();
    fixture.queue.enqueueImplementation = () => deferred.promise;
    const events: Array<{ kind?: string }> = [];
    const eventEmitter = getActionEventEmitter();
    const handler = (event: { kind?: string }): void => {
      events.push(event);
    };
    eventEmitter.on(GAME_ID, handler);

    const enqueue = fixture.queue.queueActionAndTryStartProcessor(createAction("lifecycle"));
    await Promise.resolve();
    expect(events.filter((event) => event.kind === "drain-progress")).toHaveLength(1);

    deferred.resolve({ shouldProcessQueue: false, lockToken: "" });
    await enqueue;
    expect(events.filter((event) => event.kind === "drain-progress")).toHaveLength(2);
    eventEmitter.removeListener(GAME_ID, handler);
  });

  it("records one complete accepted action only after a successful enqueue", async () => {
    const fixture = createFixture();
    const probe = fixture.utils.createAcceptedActionProbe({ gameId: GAME_ID });
    const action = createAction("accepted", 42, "socket-42");
    const wait = probe.waitForCount(1);

    await fixture.queue.queueActionAndTryStartProcessor(action);
    await wait;

    expect(probe.records()).toEqual([
      expect.objectContaining({
        gameId: GAME_ID,
        actionId: "accepted",
        actionType: GameActionType.MEDIA_DOWNLOADED,
        playerId: 42,
        socketId: "socket-42",
        acceptedAt: expect.any(Date)
      })
    ]);
    probe.dispose();
  });

  it("does not record rejected enqueues", async () => {
    const fixture = createFixture();
    fixture.queue.enqueueImplementation = async () => {
      throw new Error("atomic enqueue failed");
    };
    const probe = fixture.utils.createAcceptedActionProbe({ gameId: GAME_ID });
    const wait = probe.waitForCount(1);

    await expect(fixture.queue.queueActionAndTryStartProcessor(createAction("rejected"))).rejects.toThrow(
      "atomic enqueue failed"
    );
    expect(probe.records()).toHaveLength(0);

    probe.dispose();
    await expect(wait).rejects.toThrow("Accepted action probe disposed");
  });

  it("filters accepted actions by player and socket", async () => {
    const fixture = createFixture();
    const probe = fixture.utils.createAcceptedActionProbe({
      gameId: GAME_ID,
      actionType: GameActionType.MEDIA_DOWNLOADED,
      playerId: 2,
      socketId: "socket-2"
    });
    const wait = probe.waitForCount(1);

    await fixture.queue.queueActionAndTryStartProcessor(createAction("wrong", 1, "socket-1"));
    expect(probe.records()).toHaveLength(0);
    await fixture.queue.queueActionAndTryStartProcessor(createAction("right", 2, "socket-2"));
    await wait;

    expect(probe.records().map((record) => record.actionId)).toEqual(["right"]);
    probe.dispose();
  });

  it("retains exact accepted history after waitForCount resolves", async () => {
    const fixture = createFixture();
    const probe = fixture.utils.createAcceptedActionProbe({ gameId: GAME_ID });
    const wait = probe.waitForCount(15);

    await Promise.all(
      Array.from({ length: 15 }, (_, index) =>
        fixture.queue.queueActionAndTryStartProcessor(createAction(`burst-${index}`))
      )
    );
    await wait;

    const records = probe.records();
    expect(records).toHaveLength(15);
    expect(new Set(records.map((record) => record.actionId)).size).toBe(15);
    expect(records).not.toBe(probe.records());
    probe.dispose();
  });

  it("removes accepted-action listeners idempotently on probe disposal", async () => {
    const fixture = createFixture();
    const eventEmitter = getActionEventEmitter();
    const listenerCount = eventEmitter.listenerCount(GAME_ID);
    const probe = fixture.utils.createAcceptedActionProbe({ gameId: GAME_ID });
    const wait = probe.waitForCount(1);

    expect(eventEmitter.listenerCount(GAME_ID)).toBe(listenerCount + 1);
    probe.dispose();
    probe.dispose();
    await expect(wait).rejects.toThrow("Accepted action probe disposed");
    expect(eventEmitter.listenerCount(GAME_ID)).toBe(listenerCount);

    await fixture.queue.queueActionAndTryStartProcessor(createAction("after-dispose"));
    expect(probe.records()).toHaveLength(0);
  });

  it("keeps drain incomplete while an enqueue is in flight despite an empty unlocked queue", async () => {
    const fixture = createFixture();
    const deferred = createDeferred<unknown>();
    fixture.queue.enqueueImplementation = () => deferred.promise;

    const enqueue = fixture.queue.queueActionAndTryStartProcessor(createAction("in-flight"));
    const drain = fixture.utils.waitForActionsComplete(GAME_ID);
    let drained = false;
    void drain.then(() => {
      drained = true;
    });
    await Promise.resolve();

    expect(drained).toBe(false);
    deferred.resolve({ shouldProcessQueue: false, lockToken: "" });
    await enqueue;
    await drain;
  });

  it("rejects a drain snapshot torn by a completed enqueue", async () => {
    const fixture = createFixture();
    const staleQueueRead = createDeferred<number>();
    const queueReadStarted = createDeferred<void>();
    jest
      .spyOn(fixture.queue, "getQueueLength")
      .mockImplementationOnce(async () => {
        queueReadStarted.resolve();
        return staleQueueRead.promise;
      });

    const drain = fixture.utils.waitForActionsComplete(GAME_ID);
    let drained = false;
    void drain.then(() => {
      drained = true;
    });

    await queueReadStarted.promise;

    fixture.queue.enqueueImplementation = async () => {
      fixture.queue.queueLength = 1;
      fixture.lock.locked = true;
      return { shouldProcessQueue: false, lockToken: "" };
    };
    await fixture.queue.queueActionAndTryStartProcessor(createAction("torn-snapshot"));

    staleQueueRead.resolve(0);
    await Promise.resolve();
    expect(drained).toBe(false);

    fixture.queue.queueLength = 0;
    fixture.lock.locked = false;
    await fixture.lock.releaseLock(GAME_ID, "token");
    await drain;
  });

  it("completes drain only after in-flight, queue, and lock state all clear", async () => {
    const fixture = createFixture();
    const deferred = createDeferred<unknown>();
    fixture.queue.enqueueImplementation = () => deferred.promise;
    fixture.queue.queueLength = 1;
    fixture.queue.nextAction = createAction("queued");
    fixture.lock.locked = true;

    const enqueue = fixture.queue.queueActionAndTryStartProcessor(createAction("in-flight"));
    const drain = fixture.utils.waitForActionsComplete(GAME_ID);
    let drained = false;
    void drain.then(() => {
      drained = true;
    });

    deferred.resolve({ shouldProcessQueue: false, lockToken: "" });
    await enqueue;
    await Promise.resolve();
    expect(drained).toBe(false);

    fixture.queue.queueLength = 0;
    fixture.queue.nextAction = null;
    fixture.lock.locked = false;
    await fixture.lock.releaseLock(GAME_ID, "token");
    await drain;
  });

  it("includes in-flight, queue, lock, and peek state in drain timeouts", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const deferred = createDeferred<unknown>();
    fixture.queue.enqueueImplementation = () => deferred.promise;
    fixture.queue.queueLength = 2;
    fixture.queue.nextAction = createAction("peek");
    fixture.lock.locked = true;

    const enqueue = fixture.queue.queueActionAndTryStartProcessor(createAction("in-flight"));
    const drain = fixture.utils.waitForActionsComplete(GAME_ID, 25);
    const drainError = drain.then(
      () => undefined,
      (error: unknown) => (error instanceof Error ? error : new Error(String(error)))
    );

    await jest.advanceTimersByTimeAsync(25);
    const error = await drainError;
    expect(error?.message).toContain("inFlightEnqueues");
    expect(error?.message).toContain("queueLength");
    expect(error?.message).toContain("isLocked");
    expect(error?.message).toContain("peek");

    deferred.resolve({ shouldProcessQueue: false, lockToken: "" });
    await enqueue;
  });

  it("keeps legacy submitted waits scoped to accepted enqueues and cleans their listeners", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const eventEmitter = getActionEventEmitter();
    const listenerCount = eventEmitter.listenerCount(GAME_ID);
    const deferred = createDeferred<unknown>();
    fixture.queue.enqueueImplementation = () => deferred.promise;
    const successWait = fixture.utils.waitForSubmittedActions(
      GAME_ID,
      1,
      GameActionType.MEDIA_DOWNLOADED
    );

    const enqueue = fixture.queue.queueActionAndTryStartProcessor(createAction("legacy-success"));
    await Promise.resolve();
    expect(eventEmitter.listenerCount(GAME_ID)).toBe(listenerCount + 1);
    deferred.resolve({ shouldProcessQueue: false, lockToken: "" });
    await enqueue;
    await successWait;
    expect(eventEmitter.listenerCount(GAME_ID)).toBe(listenerCount);

    const timeoutWait = fixture.utils.waitForSubmittedActions(
      GAME_ID,
      1,
      GameActionType.MEDIA_DOWNLOADED,
      25
    );
    const timeoutError = timeoutWait.then(
      () => undefined,
      (error: unknown) => (error instanceof Error ? error : new Error(String(error)))
    );
    await jest.advanceTimersByTimeAsync(25);
    expect((await timeoutError)?.message).toContain("accepted/enqueued");
    expect(eventEmitter.listenerCount(GAME_ID)).toBe(listenerCount);
  });
});

function createFixture(): Fixture {
  const queue = new ControlledQueueService();
  const lock = new ControlledLockService();
  const executor = new ControlledExecutor();
  const utils = new SocketGameTestEventUtils({
    queueService: queue as unknown as GameActionQueueService,
    lockService: lock as unknown as GameActionLockService,
    actionExecutor: executor as unknown as GameActionExecutor
  });

  return { utils, queue, lock };
}

function createAction(
  id: string,
  playerId = 1,
  socketId = "socket-1"
): GameAction {
  return {
    id,
    type: GameActionType.MEDIA_DOWNLOADED,
    gameId: GAME_ID,
    playerId,
    socketId,
    timestamp: new Date(),
    payload: {}
  };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: Error) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function getActionEventEmitter(): EventEmitter {
  return (SocketGameTestEventUtils as unknown as { actionEvents: EventEmitter }).actionEvents;
}
