import { type Socket } from "socket.io-client";

import { type EventJournal } from "tests/e2e/scenario/EventJournal";

export interface ScenarioActorOptions {
  readonly label: string;
  readonly socket: Socket;
  readonly namespace?: string;
  readonly userId?: number;
  readonly gameId?: string;
  readonly journal: EventJournal;
}

/**
 * Thin client actor wrapper used by scenario tests.
 *
 * It intentionally does not wait for server responses by itself. Scenario tests
 * can emit several commands first, then assert the resulting journal/actions in
 * one place. This supports edge cases such as bursts of duplicate client events.
 */
export class ScenarioActor {
  public readonly label: string;
  public readonly socket: Socket;
  public readonly namespace: string;
  public readonly userId: number | undefined;
  private readonly journal: EventJournal;
  private readonly initialGameId: string | undefined;

  public constructor(options: ScenarioActorOptions) {
    this.label = options.label;
    this.socket = options.socket;
    this.namespace =
      options.namespace ?? (options.socket as unknown as { nsp?: string }).nsp ?? "unknown";
    this.userId = options.userId;
    this.initialGameId = options.gameId;
    this.journal = options.journal;
  }

  public emit<TPayload = unknown>(event: string, payload?: TPayload): void {
    this.assertConnected(`emit Socket.IO event "${event}"`);

    const args = payload === undefined ? [] : [payload];
    if (!this.journal.observesOutgoing(this)) {
      this.journal.recordOutgoing(this, event, args);
    }

    if (payload === undefined) {
      this.socket.emit(event);
      return;
    }

    this.socket.emit(event, payload);
  }

  /** Records the client-side transport close before the socket id disappears. */
  public disconnect(): void {
    this.assertConnected("disconnect");
    this.journal.recordOutgoing(this, "disconnect", []);
    this.socket.disconnect();
  }

  public emitMany<TPayload = unknown>(options: {
    readonly count: number;
    readonly event: string;
    readonly payloadFactory?: (index: number) => TPayload | undefined;
  }): void {
    for (let index = 0; index < options.count; index += 1) {
      this.emit(options.event, options.payloadFactory?.(index));
    }
  }

  public get socketId(): string | undefined {
    return this.socket.id;
  }

  public get gameId(): string | undefined {
    const socket = this.socket as Socket & { gameId?: string };
    return "gameId" in socket ? socket.gameId : this.initialGameId;
  }

  private assertConnected(action: string): void {
    this.journal.assertActorConnected(this, action);
  }
}
