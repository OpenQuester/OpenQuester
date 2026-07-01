import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { type Socket } from "socket.io-client";

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

  public emitInbound(event: string, ...args: unknown[]): void {
    for (const handler of this.anyHandlers) {
      handler(event, ...args);
    }
  }
}

let journal: EventJournal;

const asClientSocket = (socket: FakeSocket): Socket => socket as unknown as Socket;
const asFakeSocket = (actor: ScenarioActor): FakeSocket => actor.socket as unknown as FakeSocket;

const createActor = (label: string): ScenarioActor => {
  const socket = new FakeSocket(`${label}-socket`);
  const actor = new ScenarioActor({
    label,
    socket: asClientSocket(socket),
    namespace: "/game",
    userId: label === "p1" ? 101 : 102,
    gameId: "game-1",
    journal
  });
  journal.attach(actor);
  return actor;
};

describe("EventJournal", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    journal = new EventJournal();
  });

  afterEach(() => {
    journal.detachAll();
    jest.useRealTimers();
  });

  it("records inbound events emitted before assertions are awaited", async () => {
    const actor = createActor("p1");
    const mark = journal.mark();

    asFakeSocket(actor).emitInbound("media-download-status", {
      playerId: 101,
      allPlayersReady: false
    });

    const record = await journal.expectEvent({
      actor,
      direction: "inbound",
      event: "media-download-status",
      timeoutMs: 100,
      afterSequence: mark,
      predicate: (eventRecord) =>
        (eventRecord.args[0] as { playerId?: number }).playerId === 101
    });

    expect(record.actorLabel).toBe("p1");
    expect(record.direction).toBe("inbound");
    expect(record.socketId).toBe("p1-socket");
    expect(record.userId).toBe(101);
  });

  it("records burst outbound emits without awaiting every emitted command", () => {
    const actor = createActor("p1");
    const mark = journal.mark();

    actor.emitMany({
      count: 15,
      event: "media-downloaded",
      payloadFactory: (index) => ({ index })
    });

    const eventsAfterMark = journal
      .snapshot()
      .filter(
        (record) =>
          record.direction === "outbound" &&
          record.event === "media-downloaded" &&
          record.sequence > mark
      );

    expect(eventsAfterMark).toHaveLength(15);
    expect(eventsAfterMark.map((record) => (record.args[0] as { index: number }).index)).toEqual(
      Array.from({ length: 15 }, (_, index) => index)
    );
  });

  it("fails no-event expectations when a matching event was already recorded", async () => {
    const actor = createActor("p1");
    const mark = journal.mark();

    asFakeSocket(actor).emitInbound("unexpected", { value: true });

    await expect(
      journal.expectNoEvent({
        actor,
        direction: "inbound",
        event: "unexpected",
        durationMs: 100,
        afterSequence: mark
      })
    ).rejects.toThrow('Unexpected event "unexpected"');
  });

  it("times out with expectation context when an event is missing", async () => {
    const actor = createActor("p1");

    const wait = journal.expectEvent({
      actor,
      direction: "inbound",
      event: "missing",
      timeoutMs: 100,
      description: "missing event test"
    });

    jest.advanceTimersByTime(100);

    await expect(wait).rejects.toThrow('Timed out after 100ms waiting for event "missing"');
  });
});
