import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { type Socket } from "socket.io-client";

import { createControlledPromise } from "tests/e2e/harness/TestPromiseUtils";
import {
  EventJournalAbortedError,
  EventJournalDisposedError
} from "tests/e2e/scenario/EventJournal";
import { GameScenario } from "tests/e2e/scenario/GameScenario";

class FakeSocket extends EventEmitter {
  public id: string | undefined = "socket-1";
  public connected = true;
  public nsp = "/game";
  public gameId: string | undefined;
  private readonly inbound = new Set<(event: string, ...args: unknown[]) => void>();
  private readonly outbound = new Set<(event: string, ...args: unknown[]) => void>();

  public onAny(handler: (event: string, ...args: unknown[]) => void): void {
    this.inbound.add(handler);
  }

  public offAny(handler: (event: string, ...args: unknown[]) => void): void {
    this.inbound.delete(handler);
  }

  public onAnyOutgoing(handler: (event: string, ...args: unknown[]) => void): void {
    this.outbound.add(handler);
  }

  public offAnyOutgoing(handler: (event: string, ...args: unknown[]) => void): void {
    this.outbound.delete(handler);
  }

  public emit(event: string, ...args: unknown[]): boolean {
    for (const handler of this.outbound) handler(event, ...args);
    return true;
  }

  public receive(event: string, payload: unknown): void {
    if (event === "connect" || event === "disconnect" || event === "connect_error") {
      super.emit(event, payload);
      return;
    }
    for (const handler of this.inbound) handler(event, payload);
  }

  public disconnect(): this {
    this.connected = false;
    this.id = undefined;
    this.receive("disconnect", "io client disconnect");
    return this;
  }

  public asSocket(): Socket {
    return this as unknown as Socket;
  }

  public journalListenerCount(): number {
    return (
      this.inbound.size +
      this.outbound.size +
      this.listenerCount("connect") +
      this.listenerCount("disconnect") +
      this.listenerCount("connect_error")
    );
  }
}

afterEach(() => {
  jest.useRealTimers();
});

describe("GameScenario transport API", () => {
  it("records actor commands and shared-helper raw commands exactly once", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const actor = scenario.actor(socket.asSocket(), "showman");

    actor.emit("pick", { id: 4 });
    socket.emit("ready");

    expect(scenario.assert.records({ direction: "outbound" }).map(({ event }) => event)).toEqual([
      "pick",
      "ready"
    ]);
    expect(scenario.actor(socket.asSocket())).toBe(actor);
    await scenario.finish();
    expect(socket.journalListenerCount()).toBe(0);
  });

  it("can attach before connect and follows the socket across game memberships", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    socket.connected = false;
    socket.id = undefined;
    const actor = scenario.actor(socket.asSocket(), "player");
    socket.connected = true;
    socket.id = "connected-socket";
    socket.gameId = "game-1";
    scenario.actor(socket.asSocket()).emit("first");
    socket.gameId = "game-2";
    actor.emit("second");
    socket.gameId = undefined;
    actor.emit("outside-game");

    expect(scenario.assert.records().map(({ gameId }) => gameId)).toEqual([
      "game-1",
      "game-2",
      undefined
    ]);
    await scenario.finish();
  });

  it("gives a reconnected socket a new generation without duplicating observation", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const previous = scenario.actor(socket.asSocket(), "player");
    previous.emit("first");
    previous.disconnect();
    socket.id = "socket-2";
    socket.connected = true;
    const reconnected = scenario.actor(socket.asSocket());
    reconnected.emit("second");
    socket.receive("reply", { ok: true });

    expect(reconnected.label).toBe("player#2");
    expect(() => previous.emit("stale")).toThrow("not attached to this journal");
    expect(scenario.assert.records({ event: "reply" })).toEqual([
      expect.objectContaining({ actorLabel: "player#2", socketId: "socket-2" })
    ]);
    await scenario.finish();
    expect(socket.journalListenerCount()).toBe(0);
  });

  it("never satisfies a new wait with an earlier same-name event", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    scenario.actor(socket.asSocket());
    socket.receive("status", { step: 1 });
    const wait = scenario.waitForEvent<{ step: number }>(socket.asSocket(), "status", 100);
    socket.receive("status", { step: 2 });

    await expect(wait).resolves.toEqual({ step: 2 });
    await scenario.finish();
  });

  it("rejects positive and negative assertions on an already disconnected actor", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const actor = scenario.actor(socket.asSocket(), "player");
    socket.receive("status", { ready: true });
    socket.disconnect();

    expect(() => scenario.assert.noInbound({ actor, event: "forbidden", durationMs: 10 })).toThrow(
      "disconnected scenario actor"
    );
    expect(() => scenario.assert.inbound({ actor, event: "status", timeoutMs: 10 })).toThrow(
      "disconnected scenario actor"
    );
    expect(scenario.assert.records({ actor, event: "status" })).toHaveLength(1);
    await scenario.finish();
    expect(socket.journalListenerCount()).toBe(0);
  });

  it.each(["disconnect", "connect_error"])(
    "rejects a group no-event assertion when a recipient reports %s",
    async (event) => {
      const scenario = new GameScenario();
      const first = new FakeSocket();
      const second = new FakeSocket();
      second.id = "socket-2";
      const actors = [scenario.actor(first.asSocket()), scenario.actor(second.asSocket())];
      const quiet = scenario.assert.noInboundMany({ actors, event: "forbidden", durationMs: 100 });
      second.receive(event, "transport failure");

      await expect(quiet).rejects.toThrow("client-2");
      await expect(scenario.finish()).rejects.toThrow("disconnected");
      expect(first.journalListenerCount() + second.journalListenerCount()).toBe(0);
    }
  );

  it("rejects empty, duplicate, and foreign recipients before arming group waits", async () => {
    const scenario = new GameScenario();
    const other = new GameScenario();
    const socket = new FakeSocket();
    const actor = scenario.actor(socket.asSocket());
    const foreign = other.actor(new FakeSocket().asSocket());
    const options = { event: "forbidden", durationMs: 10 };

    expect(() => scenario.assert.noInboundMany({ ...options, actors: [] })).toThrow(
      "unique actors"
    );
    expect(() => scenario.assert.noInboundMany({ ...options, actors: [actor, actor] })).toThrow(
      "unique actors"
    );
    expect(() => scenario.assert.noInbound({ ...options, actor: foreign })).toThrow("not attached");
    // Different labels ensure the ownership check, not duplicate-label validation, rejects this group.
    const foreignNamed = other.actor(new FakeSocket().asSocket(), "foreign");
    expect(() =>
      scenario.assert.noInboundMany({ ...options, actors: [actor, foreignNamed] })
    ).toThrow("not attached");
    expect(() => scenario.assert.broadcast({ actors: [], event: "status", timeoutMs: 10 })).toThrow(
      "unique actors"
    );
    await scenario.finish();
    await other.finish();
    expect(socket.journalListenerCount()).toBe(0);
  });

  it("does not silently drop a disconnected recipient from a no-event group", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const actor = scenario.actor(socket.asSocket());
    socket.disconnect();
    expect(() =>
      scenario.assert.noInboundMany({ actors: [actor], event: "error", durationMs: 10 })
    ).toThrow("disconnected");
    await scenario.finish();
  });

  it("keeps the requested negative window beyond the default 100ms", async () => {
    jest.useFakeTimers();
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const quiet = scenario.waitForNoEvent(socket.asSocket(), "forbidden", 200);
    await jest.advanceTimersByTimeAsync(150);
    socket.receive("forbidden", { tooEarly: true });
    await expect(quiet).rejects.toThrow("during 200ms");
    await expect(scenario.finish()).rejects.toThrow("forbidden");
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid no-event duration %s", async (durationMs) => {
    const scenario = new GameScenario();
    const actor = scenario.actor(new FakeSocket().asSocket());
    expect(() => scenario.assert.noInbound({ actor, event: "error", durationMs })).toThrow(
      "positive finite number"
    );
    await scenario.finish();
  });

  it("records an expected disconnect before rejecting the actor's other waits", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const disconnect = scenario.waitForEvent(socket.asSocket(), "disconnect");
    const quiet = scenario.waitForNoEvent(socket.asSocket(), "error");
    socket.disconnect();
    await expect(disconnect).resolves.toBe("io client disconnect");
    await expect(quiet).rejects.toThrow("disconnected");
    await scenario.abort();
    expect(socket.journalListenerCount()).toBe(0);
  });

  it("binds the first connection before any actor use and rejects stale generations", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    socket.id = undefined;
    socket.connected = false;
    const oldActor = scenario.actor(socket.asSocket(), "player");
    socket.id = "first";
    socket.connected = true;
    socket.receive("connect", undefined);
    socket.receive("status", "old");
    socket.disconnect();
    socket.id = "second";
    socket.connected = true;
    socket.receive("connect", undefined);

    expect(() =>
      scenario.assert.noInbound({ actor: oldActor, event: "error", durationMs: 10 })
    ).toThrow("disconnected scenario actor");
    const currentActor = scenario.actor(socket.asSocket());
    expect(currentActor.label).toBe("player#2");
    const status = scenario.assert.inbound({
      actor: currentActor,
      event: "status",
      timeoutMs: 100
    });
    socket.receive("status", "new");
    expect((await status).args).toEqual(["new"]);
    await scenario.finish();
    expect(socket.journalListenerCount()).toBe(0);
  });

  it("predicates live waits by the intended payload", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const wait = scenario.waitForEventMatching<{ playerId: number }>(
      socket.asSocket(),
      "ready",
      (data) => data.playerId === 7,
      100
    );
    socket.receive("ready", { playerId: 3 });
    socket.receive("ready", { playerId: 7 });

    await expect(wait).resolves.toEqual({ playerId: 7 });
    await scenario.finish();
  });

  it("records reserved disconnect events and rejects unrelated waits immediately", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const disconnect = scenario.waitForEvent(socket.asSocket(), "disconnect", 100);
    const missing = scenario.waitForEvent(socket.asSocket(), "missing", 100);
    socket.disconnect();

    await expect(disconnect).resolves.toBe("io client disconnect");
    await expect(missing).rejects.toThrow("disconnected (disconnect");
    await scenario.abort();
    expect(socket.journalListenerCount()).toBe(0);
  });

  it("does not treat explicit optional-wait cancellation as a scenario failure", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const controller = new AbortController();
    const positive = scenario.waitForEvent(socket.asSocket(), "optional", 100, controller.signal);
    const negative = scenario.waitForNoEvent(
      socket.asSocket(),
      "forbidden",
      100,
      controller.signal
    );
    controller.abort();

    await expect(positive).rejects.toBeInstanceOf(EventJournalAbortedError);
    await expect(negative).rejects.toBeInstanceOf(EventJournalAbortedError);
    await scenario.finish();
  });

  it("does not suppress an actual assertion failure when its signal is later aborted", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const controller = new AbortController();
    const wait = scenario.waitForNoEvent(socket.asSocket(), "forbidden", 100, controller.signal);
    socket.receive("forbidden", {});
    controller.abort();

    await expect(wait).rejects.toThrow('Unexpected event "forbidden"');
    await expect(scenario.finish()).rejects.toThrow('Unexpected event "forbidden"');
  });

  it("arms the journal before executing synchronous commands", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const response = scenario.emitAndWaitForEvent(socket.asSocket(), "reply", () => {
      scenario.actor(socket.asSocket()).emit("command");
      socket.receive("reply", { ok: true });
    });

    expect(scenario.assert.records({ event: "command" })).toHaveLength(1);

    await expect(response).resolves.toEqual({ ok: true });
    await scenario.finish();
  });

  it("preserves an operation failure and cancels its terminal timer", async () => {
    jest.useFakeTimers();
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const primary = new Error("earlier step failed");

    await expect(
      scenario.runAndWaitForEvent(
        socket.asSocket(),
        "terminal",
        async () => {
          throw primary;
        },
        100
      )
    ).rejects.toBe(primary);
    await scenario.abort();
    expect(jest.getTimerCount()).toBe(0);
    expect(socket.journalListenerCount()).toBe(0);
  });

  it("prefers the operation failure even after its terminal event has timed out", async () => {
    jest.useFakeTimers();
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const operation = createControlledPromise<void>();
    const primary = new Error("missing question data");
    const result = scenario
      .runAndWaitForEvent(socket.asSocket(), "terminal", () => operation.promise, 25)
      .then(
        () => undefined,
        (error: unknown) => error
      );

    await jest.advanceTimersByTimeAsync(26);
    operation.reject(primary);

    expect(await result).toBe(primary);
    await scenario.abort();
    expect(jest.getTimerCount()).toBe(0);
    expect(socket.journalListenerCount()).toBe(0);
  });

  it("still fails the terminal deadline when the operation later succeeds and emits", async () => {
    jest.useFakeTimers();
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const operation = createControlledPromise<void>();
    const result = scenario
      .runAndWaitForEvent(socket.asSocket(), "terminal", () => operation.promise, 25)
      .then(
        () => undefined,
        (error: unknown) => error
      );

    await jest.advanceTimersByTimeAsync(26);
    socket.receive("terminal", { tooLate: true });
    operation.resolve();

    expect(await result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Timed out after 25ms waiting for event "terminal"')
      })
    );
    await scenario.abort();
    expect(jest.getTimerCount()).toBe(0);
    expect(socket.journalListenerCount()).toBe(0);
  });

  it.each(["pending", "received", "timed-out"])(
    "aborts an opaque unfinished operation with terminal %s without waiting for its diagnostic deadline",
    async (terminalState) => {
      jest.useFakeTimers();
      const scenario = new GameScenario();
      const socket = new FakeSocket();
      const operation = createControlledPromise<void>();
      const result = scenario
        .runAndWaitForEvent(socket.asSocket(), "terminal", () => operation.promise, 25)
        .then(
          () => undefined,
          (error: unknown) => error
        );

      if (terminalState === "received") socket.receive("terminal", { ok: true });
      if (terminalState === "timed-out") await jest.advanceTimersByTimeAsync(26);

      await scenario.abort();

      expect(await result).toBeInstanceOf(EventJournalDisposedError);
      expect(jest.getTimerCount()).toBe(0);
      expect(socket.journalListenerCount()).toBe(0);
      operation.resolve();
    }
  );

  it("tracks forgotten payload waits until scenario completion", async () => {
    jest.useFakeTimers();
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    void scenario.waitForEvent(socket.asSocket(), "missing", 25);
    const completion = expect(scenario.finish()).rejects.toThrow('waiting for event "missing"');
    await jest.advanceTimersByTimeAsync(25);
    await completion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("collects mixed events in wire order and counts late duplicates until stop", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const collector = scenario.collectSocketEvents<number>(socket.asSocket(), ["a", "b"], 2, 100);
    socket.receive("b", 2);
    socket.receive("a", 1);
    await expect(collector.promise).resolves.toEqual([
      { event: "b", data: 2 },
      { event: "a", data: 1 }
    ]);
    socket.receive("a", 3);
    expect(collector.count()).toBe(3);
    expect(() => collector.stop()).toThrow("Expected exactly 2 events (a, b)");
    socket.receive("a", 4);
    expect(collector.count()).toBe(3);
    await expect(scenario.finish()).rejects.toThrow("Expected exactly 2 events (a, b)");
  });

  it("fails completion for a late duplicate even when collector stop was forgotten", async () => {
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const collector = scenario.collectEvents(socket.asSocket(), "reply", 1, 100);
    socket.receive("reply", 1);
    await collector.promise;
    socket.receive("reply", 2);

    await expect(scenario.finish()).rejects.toThrow("Expected exactly 1 events (reply)");
  });

  it("rejects unfinished collector cancellation and releases its timer", async () => {
    jest.useFakeTimers();
    const scenario = new GameScenario();
    const socket = new FakeSocket();
    const collector = scenario.collectEvents(socket.asSocket(), "a", 2, 100);
    collector.stop();
    await expect(collector.promise).rejects.toThrow("Stopped waiting for 2 events");
    await scenario.abort();
    expect(jest.getTimerCount()).toBe(0);
  });
});
