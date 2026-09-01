import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";

import { type GameActionExecutor } from "application/executors/GameActionExecutor";
import { type GameActionLockService } from "application/services/lock/GameActionLockService";
import { type GameActionQueueService } from "application/services/queue/GameActionQueueService";
import { GameActionType } from "domain/enums/GameActionType";
import { type GameAction } from "domain/types/action/GameAction";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { SocketGameTestEventUtils } from "tests/socket/game/utils/SocketGameTestEventUtils";
import { type GameClientSocket } from "tests/socket/game/utils/SocketIOGameTestUtils";

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

class FakeGameClientSocket extends EventEmitter {
  public connected = true;
  public id: string | undefined = "socket-1";
  public gameId: string | undefined = GAME_ID;
  public role: PlayerRole | undefined = PlayerRole.PLAYER;
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
  it("arms before emitting and clears only owned listeners and timers after success", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const socket = new FakeGameClientSocket();
    const unrelated = jest.fn();
    socket.on("target", unrelated);

    const result = await fixture.utils.emitAndWaitForEvent<{ ok: boolean }>(
      socket as unknown as GameClientSocket,
      "target",
      () => {
        expect(socket.listenerCount("target")).toBe(2);
        socket.emit("target", { ok: true });
      },
      25
    );

    expect(result).toEqual({ ok: true });
    expect(unrelated).toHaveBeenCalledTimes(1);
    expect(socket.listenerCount("target")).toBe(1);
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("settles once and removes owned listeners before a late event after timeout", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const socket = new FakeGameClientSocket();
    const unrelated = jest.fn();
    socket.on("target", unrelated);
    const wait = fixture.utils.waitForEvent(socket as unknown as GameClientSocket, "target", 25);
    const outcome = wait.then(
      () => "resolved" as const,
      (error: unknown) => error
    );

    await jest.advanceTimersByTimeAsync(25);
    const timeoutError = await outcome;
    expect(timeoutError).toBeInstanceOf(Error);
    expect((timeoutError as Error).message).toContain("Timed out after 25ms");
    expect((timeoutError as Error).message).toContain('gameId="game-1"');
    expect((timeoutError as Error).message).toContain('socketId="socket-1"');
    expect(socket.listenerCount("target")).toBe(1);
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);

    socket.emit("target", { late: true });
    expect(unrelated).toHaveBeenCalledWith({ late: true });
    expect(await outcome).toBe(timeoutError);
  });

  it("keeps a predicate wait armed across non-matching events", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const socket = new FakeGameClientSocket();
    const wait = fixture.utils.waitForEventMatching<{ playerId: number }>(
      socket as unknown as GameClientSocket,
      "ready",
      (data) => data.playerId === 2,
      25
    );
    let resolved = false;
    void wait.then(() => {
      resolved = true;
    });

    socket.emit("ready", { playerId: 1 });
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(socket.listenerCount("ready")).toBe(1);

    socket.emit("ready", { playerId: 2 });
    await expect(wait).resolves.toEqual({ playerId: 2 });
    expect(socket.listenerCount("ready")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rejects on disconnect with preserved socket context and no wait leaks", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const socket = new FakeGameClientSocket();
    const wait = fixture.utils.waitForEvent(socket as unknown as GameClientSocket, "target", 25);

    socket.connected = false;
    socket.id = undefined;
    socket.emit("disconnect", "transport close");

    await expect(wait).rejects.toThrow(
      /disconnected.*socketId="socket-1".*reason="transport close"/
    );
    expect(socket.listenerCount("target")).toBe(0);
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rejects on connect_error and clears the event and disconnect listeners", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const socket = new FakeGameClientSocket();
    const wait = fixture.utils.waitForEvent(socket as unknown as GameClientSocket, "target", 25);

    socket.emit("connect_error", new Error("connection refused"));

    await expect(wait).rejects.toThrow(/connect_error.*socketId="socket-1"/);
    expect(socket.listenerCount("target")).toBe(0);
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("cancels its armed wait when the emit callback throws", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const socket = new FakeGameClientSocket();

    await expect(
      fixture.utils.emitAndWaitForEvent(
        socket as unknown as GameClientSocket,
        "target",
        () => {
          throw new Error("emit failed");
        },
        25
      )
    ).rejects.toThrow("emit failed");

    expect(socket.listenerCount("target")).toBe(0);
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("cancels its armed wait when a coordinated async operation rejects", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const socket = new FakeGameClientSocket();

    await expect(
      fixture.utils.runAndWaitForEvent(
        socket as unknown as GameClientSocket,
        "target",
        async () => {
          await Promise.resolve();
          throw new Error("operation failed");
        },
        25
      )
    ).rejects.toThrow("operation failed");

    expect(socket.listenerCount("target")).toBe(0);
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("cancels every outstanding event assertion without leaking listeners or timers", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const socket = new FakeGameClientSocket();
    const eventWait = fixture.utils.waitForEvent(
      socket as unknown as GameClientSocket,
      "target",
      25
    );
    const noEventWait = fixture.utils.waitForNoEvent(
      socket as unknown as GameClientSocket,
      "quiet",
      25
    );

    await expect(fixture.utils.cancelPendingEventWaits()).resolves.toBe(2);
    await expect(fixture.utils.cancelPendingEventWaits()).resolves.toBe(0);
    await expect(eventWait).rejects.toThrow('event wait aborted for "target"');
    await expect(noEventWait).rejects.toThrow('no-event wait aborted for "quiet"');
    expect(socket.listenerCount("target")).toBe(0);
    expect(socket.listenerCount("quiet")).toBe(0);
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("cleans a no-event wait before accepting later traffic", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const socket = new FakeGameClientSocket();
    const unrelated = jest.fn();
    socket.on("quiet", unrelated);
    const wait = fixture.utils.waitForNoEvent(socket as unknown as GameClientSocket, "quiet", 25);

    await jest.advanceTimersByTimeAsync(25);
    await expect(wait).resolves.toBeUndefined();
    expect(socket.listenerCount("quiet")).toBe(1);
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);

    socket.emit("quiet", "late");
    expect(unrelated).toHaveBeenCalledWith("late");
  });

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

    await expect(
      fixture.queue.queueActionAndTryStartProcessor(createAction("rejected"))
    ).rejects.toThrow("atomic enqueue failed");
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
    jest.spyOn(fixture.queue, "getQueueLength").mockImplementationOnce(async () => {
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

  it("rejects at the deadline and removes its listener when a condition read hangs", async () => {
    jest.useFakeTimers();
    const fixture = createFixture();
    const queueRead = createDeferred<number>();
    jest.spyOn(fixture.queue, "getQueueLength").mockImplementation(() => queueRead.promise);
    const eventEmitter = getActionEventEmitter();
    const listenerCount = eventEmitter.listenerCount(GAME_ID);

    const wait = fixture.utils.waitForQueueLengthAtLeast(GAME_ID, 1, 25);
    const outcome = wait.then(
      () => "resolved" as const,
      (error: unknown) => error
    );
    await Promise.resolve();
    expect(eventEmitter.listenerCount(GAME_ID)).toBe(listenerCount + 1);

    await jest.advanceTimersByTimeAsync(25);
    const timeoutError = await outcome;
    expect(timeoutError).toBeInstanceOf(Error);
    expect((timeoutError as Error).message).toContain("current length is unavailable");
    expect(eventEmitter.listenerCount(GAME_ID)).toBe(listenerCount);

    await fixture.lock.releaseLock(GAME_ID, "late-event");
    queueRead.resolve(1);
    await Promise.resolve();
    expect(await outcome).toBe(timeoutError);
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

    const canceledWait = fixture.utils.waitForSubmittedActions(
      GAME_ID,
      1,
      GameActionType.MEDIA_DOWNLOADED,
      25
    );
    expect(eventEmitter.listenerCount(GAME_ID)).toBe(listenerCount + 1);
    await expect(fixture.utils.cancelPendingEventWaits()).resolves.toBe(1);
    await expect(canceledWait).rejects.toThrow("Accepted action probe disposed");
    expect(eventEmitter.listenerCount(GAME_ID)).toBe(listenerCount);
    expect(jest.getTimerCount()).toBe(0);
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

function createAction(id: string, playerId = 1, socketId = "socket-1"): GameAction {
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
