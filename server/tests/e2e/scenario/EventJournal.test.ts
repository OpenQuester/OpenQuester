import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";

import { EventJournal } from "tests/e2e/scenario/EventJournal";
import { ScenarioActor } from "tests/e2e/scenario/ScenarioActor";

class FakeSocket extends EventEmitter {
  public id: string | undefined;
  public connected = true;
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

  public emit(event: string, ...args: unknown[]): boolean {
    const emitted = super.emit(event, ...args);
    for (const handler of this.anyHandlers) {
      handler(event, ...args);
    }

    return emitted;
  }
}

const createActor = (label: string): ScenarioActor =>
  new ScenarioActor({
    label,
    socket: new FakeSocket(`${label}-socket`) as never,
    namespace: "/game",
    userId: label === "p1" ? 101 : 102,
    gameId: "game-1"
  });

describe("EventJournal", () => {
  let journal: EventJournal;

  beforeEach(() => {
    jest.useFakeTimers();
    journal = new EventJournal();
  });

  afterEach(() => {
    journal.detachAll();
    jest.useRealTimers();
  });

  it("records events emitted before assertions are awaited", async () => {
    const actor = createActor("p1");
    journal.attach(actor);
    const mark = journal.mark();

    actor.emit("media-download-status", { playerId: 101, allPlayersReady: false });

    const record = await journal.expectEvent({
      actor,
      event: "media-download-status",
      timeoutMs: 100,
      afterSequence: mark,
      predicate: (eventRecord) =>
        (eventRecord.args[0] as { playerId?: number }).playerId === 101
    });

    expect(record.actorLabel).toBe("p1");
    expect(record.socketId).toBe("p1-socket");
    expect(record.userId).toBe(101);
  });

  it("supports burst emits without awaiting every emitted command", async () => {
    const actor = createActor("p1");
    journal.attach(actor);
    const mark = journal.mark();

    actor.emitMany({
      count: 15,
      event: "media-downloaded",
      payloadFactory: (index) => ({ index })
    });

    const eventsAfterMark = journal
      .snapshot()
      .filter((record) => record.event === "media-downloaded" && record.sequence > mark);

    expect(eventsAfterMark).toHaveLength(15);
    expect(eventsAfterMark.map((record) => (record.args[0] as { index: number }).index)).toEqual(
      Array.from({ length: 15 }, (_, index) => index)
    );
  });

  it("fails no-event expectations when a matching event was already recorded", async () => {
    const actor = createActor("p1");
    journal.attach(actor);
    const mark = journal.mark();

    actor.emit("unexpected", { value: true });

    await expect(
      journal.expectNoEvent({
        actor,
        event: "unexpected",
        durationMs: 100,
        afterSequence: mark
      })
    ).rejects.toThrow('Unexpected event "unexpected"');
  });

  it("times out with expectation context when an event is missing", async () => {
    const actor = createActor("p1");
    journal.attach(actor);

    const wait = journal.expectEvent({
      actor,
      event: "missing",
      timeoutMs: 100,
      description: "missing event test"
    });

    jest.advanceTimersByTime(100);

    await expect(wait).rejects.toThrow('Timed out after 100ms waiting for event "missing"');
  });
});
