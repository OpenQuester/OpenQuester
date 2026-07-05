import { describe, expect, it } from "@jest/globals";
import { EventEmitter } from "events";
import { type Socket } from "socket.io-client";

import { EventJournal } from "tests/e2e/scenario/EventJournal";
import { ScenarioActor } from "tests/e2e/scenario/ScenarioActor";

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
}

const createActor = (journal: EventJournal, label: string): ScenarioActor => {
  const socket = new FakeSocket(`${label}-socket`);
  const actor = new ScenarioActor({
    label,
    socket: socket as unknown as Socket,
    namespace: "/game",
    userId: label === "p1" ? 101 : 102,
    gameId: "game-1",
    journal
  });
  journal.attach(actor);
  return actor;
};

const fakeSocketOf = (actor: ScenarioActor): FakeSocket => actor.socket as unknown as FakeSocket;

describe("EventJournal", () => {
  it("records inbound events emitted before assertions are awaited", async () => {
    const journal = new EventJournal();
    const actor = createActor(journal, "p1");
    const mark = journal.mark();

    fakeSocketOf(actor).emitInbound("media-download-status", {
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
  });

  it("records outbound command bursts without awaiting every command", () => {
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

  it("rejects no-event assertions when a matching event is already recorded", async () => {
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
  });
});
