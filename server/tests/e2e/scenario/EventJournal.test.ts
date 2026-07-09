import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { type Socket } from "socket.io-client";

import {
  EventJournal,
  EventJournalDisposedError,
  type JournalActor
} from "tests/e2e/scenario/EventJournal";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { ScenarioActor } from "tests/e2e/scenario/ScenarioActor";
import { type ScenarioGameDriver } from "tests/e2e/scenario/ScenarioGameDriver";
import { type AcceptedActionProbe } from "tests/socket/game/utils/SocketGameTestEventUtils";

class FakeSocket extends EventEmitter {
  public id: string | undefined;
  private readonly anyHandlers = new Set<(event: string, ...args: unknown[]) => void>();

  public constructor(id: string) {
    super();
    this.id = id;
  }

  public onAny(handler: (event: string, ...args: unknown[]) => void): void {
    this.anyHandlers.add(handler);
  }

  public offAny(handler: (event: string, ...args: unknown[]) => void): void {
    this.anyHandlers.delete(handler);
  }

  public emitInbound(event: string, ...args: unknown[]): void {
    for (const handler of this.anyHandlers) {
      handler(event, ...args);
    }
  }

  public firstInboundHandler(): ((event: string, ...args: unknown[]) => void) | undefined {
    return this.anyHandlers.values().next().value;
  }
}

afterEach(() => {
  jest.useRealTimers();
});

describe("EventJournal", () => {
  it("satisfies an expectation from an already-recorded inbound event", async () => {
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const mark = journal.mark();

    fakeSocketOf(actor).emitInbound("media-download-status", { playerId: 101 });

    const record = await journal.expectEvent({
      actor,
      direction: "inbound",
      event: "media-download-status",
      timeoutMs: 100,
      afterSequence: mark,
      predicate: (eventRecord) => (eventRecord.args[0] as { playerId?: number }).playerId === 101
    });

    expect(record.actorLabel).toBe("p1");
    expect(record.socketId).toBe("p1-socket");
  });

  it("resolves a live waiter only when the expected actor and payload arrive", async () => {
    const journal = new EventJournal();
    const firstActor = createActor(journal, "p1");
    const secondActor = createActor(journal, "p2");
    const wait = journal.expectEvent({
      actor: firstActor,
      direction: "inbound",
      event: "status",
      timeoutMs: 100,
      predicate: (record) => (record.args[0] as { ready?: boolean }).ready === true
    });

    fakeSocketOf(secondActor).emitInbound("status", { ready: true });
    fakeSocketOf(firstActor).emitInbound("status", { ready: false });
    fakeSocketOf(firstActor).emitInbound("status", { ready: true });

    const record = await wait;
    expect(record.actorLabel).toBe("p1");
    expect(record.args[0]).toEqual({ ready: true });
  });

  it("records outbound command bursts in exact order", () => {
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const mark = journal.mark();

    actor.emitMany({
      count: 15,
      event: "media-downloaded",
      payloadFactory: (index) => ({ index })
    });

    const records = journal.snapshot().filter(
      (record) =>
        record.direction === "outbound" &&
        record.event === "media-downloaded" &&
        record.sequence > mark
    );

    expect(records).toHaveLength(15);
    expect(records.map((record) => (record.args[0] as { index: number }).index)).toEqual(
      Array.from({ length: 15 }, (_, index) => index)
    );
  });

  it("keeps nested event payloads isolated from snapshot mutation", () => {
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");

    fakeSocketOf(actor).emitInbound("status", { player: { ready: false } });

    const snapshot = journal.snapshot();
    (snapshot[0].args[0] as { player: { ready: boolean } }).player.ready = true;

    expect(
      (journal.snapshot()[0].args[0] as { player: { ready: boolean } }).player.ready
    ).toBe(false);
  });

  it("rejects negative assertions for recorded and live matching events", async () => {
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const mark = journal.mark();
    fakeSocketOf(actor).emitInbound("blocked-event", { value: true });

    await expect(
      journal.expectNoEvent({
        actor,
        direction: "inbound",
        event: "blocked-event",
        durationMs: 100,
        afterSequence: mark
      })
    ).rejects.toThrow('Unexpected event "blocked-event"');

    const liveNegative = journal.expectNoEvent({
      actor,
      direction: "inbound",
      event: "late-event",
      durationMs: 100
    });
    fakeSocketOf(actor).emitInbound("late-event", { value: true });

    await expect(liveNegative).rejects.toThrow('Unexpected event "late-event"');
  });

  it("resolves a bounded negative assertion after a clean observation window", async () => {
    jest.useFakeTimers();
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const noEvent = journal.expectNoEvent({
      actor,
      direction: "inbound",
      event: "absent",
      durationMs: 25,
      description: "clean window"
    });

    await jest.advanceTimersByTimeAsync(25);
    await expect(noEvent).resolves.toBeUndefined();
  });

  it("keeps concurrent positive and negative waits independent", async () => {
    jest.useFakeTimers();
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const positive = journal.expectEvent({
      actor,
      direction: "inbound",
      event: "expected",
      timeoutMs: 50
    });
    const negative = journal.expectNoEvent({
      actor,
      direction: "inbound",
      event: "forbidden",
      durationMs: 25
    });

    fakeSocketOf(actor).emitInbound("expected", { ok: true });
    await jest.advanceTimersByTimeAsync(25);

    await expect(Promise.all([positive, negative])).resolves.toEqual([
      expect.objectContaining({ event: "expected" }),
      undefined
    ]);
  });

  it("rejects a predicate error with expectation context", async () => {
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const wait = journal.expectEvent({
      actor,
      direction: "inbound",
      event: "status",
      timeoutMs: 100,
      description: "predicate diagnostic",
      predicate: () => {
        throw new Error("predicate exploded");
      }
    });

    fakeSocketOf(actor).emitInbound("status", { value: true });

    await expect(wait).rejects.toThrow(
      'Event predicate failed for "status" {"description":"predicate diagnostic"'
    );
    await expect(wait).rejects.toThrow("predicate exploded");
  });

  it("reports complete timeout diagnostics with fake timers", async () => {
    jest.useFakeTimers();
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const mark = journal.mark();
    const wait = journal.expectEvent({
      actor,
      direction: "inbound",
      event: "missing",
      timeoutMs: 25,
      afterSequence: mark,
      description: "timeout context"
    });
    const timeoutError = wait.then(
      () => undefined,
      (error: unknown) => (error instanceof Error ? error : new Error(String(error)))
    );

    await jest.advanceTimersByTimeAsync(25);

    const error = await timeoutError;
    expect(error?.message).toContain("Timed out after 25ms waiting for event \"missing\"");
    expect(error?.message).toContain("timeout context");
    expect(error?.message).toContain("afterSequence");
  });

  it("disposes pending positive and negative waits without leaving unhandled rejections", async () => {
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const unhandledRejection = jest.fn();
    process.once("unhandledRejection", unhandledRejection);
    const positive = journal.expectEvent({
      actor,
      direction: "inbound",
      event: "pending-positive",
      timeoutMs: 100
    });
    const negative = journal.expectNoEvent({
      actor,
      direction: "inbound",
      event: "pending-negative",
      durationMs: 100
    });

    await journal.dispose();
    await Promise.resolve();

    await expect(positive).rejects.toBeInstanceOf(EventJournalDisposedError);
    await expect(negative).rejects.toBeInstanceOf(EventJournalDisposedError);
    expect(unhandledRejection).not.toHaveBeenCalled();
    process.removeListener("unhandledRejection", unhandledRejection);
  });

  it("handles an abandoned broadcast expectation during scenario disposal", async () => {
    const scenario = new GameScenario();
    const actor = scenario.addActor({
      ...toJournalActor("p1")
    });
    const unhandledRejection = jest.fn();
    process.once("unhandledRejection", unhandledRejection);

    try {
      void scenario.assert.broadcast({
        actors: [actor],
        event: "pending-broadcast",
        timeoutMs: 100
      });

      await scenario.dispose();
      await Promise.resolve();

      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.removeListener("unhandledRejection", unhandledRejection);
    }
  });

  it("fails journal operations immediately after disposal and stale inbound handlers cannot record", async () => {
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const staleInboundHandler = fakeSocketOf(actor).firstInboundHandler();

    await journal.dispose();

    expect(() => journal.mark()).toThrow(EventJournalDisposedError);
    expect(() => journal.recordOutgoing(actor, "outbound", [])).toThrow(EventJournalDisposedError);
    expect(() =>
      journal.expectEvent({ event: "after-dispose", timeoutMs: 1 })
    ).toThrow(EventJournalDisposedError);
    expect(() =>
      journal.expectNoEvent({ event: "after-dispose", durationMs: 1 })
    ).toThrow(EventJournalDisposedError);
    expect(() => journal.attach(toJournalActor("p2"))).toThrow(EventJournalDisposedError);
    expect(() => staleInboundHandler?.("late", {})).toThrow(EventJournalDisposedError);
  });

  it("rejects duplicate actor labels and detaching stops later inbound recording", async () => {
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");

    expect(() => journal.attach(toJournalActor("p1"))).toThrow("already attached");
    journal.detach(actor.label);
    fakeSocketOf(actor).emitInbound("detached", { value: true });
    expect(journal.snapshot()).toHaveLength(0);

    const scenario = new GameScenario();
    scenario.addActor({ label: "duplicate", socket: new FakeSocket("duplicate-1") as unknown as Socket });
    expect(() =>
      scenario.addActor({ label: "duplicate", socket: new FakeSocket("duplicate-2") as unknown as Socket })
    ).toThrow("already registered");
    await scenario.dispose();
  });

  it("disposes every accepted-action probe before the journal", async () => {
    const probe: AcceptedActionProbe = {
      waitForCount: async () => undefined,
      records: () => [],
      dispose: jest.fn()
    };
    const driver = {
      createAcceptedActionProbe: () => probe
    } as unknown as ScenarioGameDriver;
    const scenario = new GameScenario(driver);

    scenario.createAcceptedActionProbe({ gameId: "game-1" });
    await scenario.dispose();

    expect(probe.dispose).toHaveBeenCalledTimes(1);
    expect(() => scenario.createAcceptedActionProbe({ gameId: "game-1" })).toThrow(
      "Game scenario is disposed"
    );
  });
});

function createActor(journal: EventJournal, label: string): ScenarioActor {
  const actor = new ScenarioActor({
    ...toJournalActor(label),
    journal
  });
  journal.attach(actor);
  return actor;
}

function toJournalActor(label: string): JournalActor {
  return {
    label,
    socket: new FakeSocket(`${label}-socket`) as unknown as Socket,
    namespace: "/game",
    userId: label === "p1" ? 101 : 102,
    gameId: "game-1"
  };
}

function fakeSocketOf(actor: ScenarioActor): FakeSocket {
  return actor.socket as unknown as FakeSocket;
}
