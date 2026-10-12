import { describe, expect, it } from "@jest/globals";
import { EventEmitter } from "events";
import { type Socket } from "socket.io-client";

import { EventJournal } from "tests/e2e/scenario/EventJournal";
import { ScenarioActor } from "tests/e2e/scenario/ScenarioActor";

class FakeSocket extends EventEmitter {
  public connected = true;
  public id: string | undefined = "player-socket";
  public disconnectCalls = 0;
  private readonly anyHandlers = new Set<(event: string, ...args: unknown[]) => void>();

  public onAny(handler: (event: string, ...args: unknown[]) => void): void {
    this.anyHandlers.add(handler);
  }

  public offAny(handler: (event: string, ...args: unknown[]) => void): void {
    this.anyHandlers.delete(handler);
  }

  public disconnect(): this {
    this.disconnectCalls += 1;
    this.connected = false;
    this.id = undefined;
    return this;
  }
}

describe("ScenarioActor", () => {
  it("records a transport disconnect before the socket identity disappears", async () => {
    const journal = new EventJournal();
    const socket = new FakeSocket();
    const actor = new ScenarioActor({
      label: "player-1",
      socket: socket as unknown as Socket,
      namespace: "/game",
      userId: 2,
      gameId: "game-1",
      journal
    });
    journal.attach(actor);

    actor.disconnect();

    expect(socket.disconnectCalls).toBe(1);
    expect(journal.snapshot()).toEqual([
      expect.objectContaining({
        direction: "outbound",
        event: "disconnect",
        actorLabel: "player-1",
        socketId: "player-socket",
        userId: 2,
        gameId: "game-1",
        args: []
      })
    ]);
    expect(() => actor.disconnect()).toThrow("Cannot disconnect from disconnected scenario actor");
    expect(journal.snapshot()).toHaveLength(1);
    await journal.dispose();
  });
});
