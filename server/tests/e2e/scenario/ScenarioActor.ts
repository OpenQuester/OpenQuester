import { type Socket } from "socket.io-client";

export interface ScenarioActorOptions {
  readonly label: string;
  readonly socket: Socket;
  readonly namespace?: string;
  readonly userId?: number;
  readonly gameId?: string;
}

export interface EmitManyOptions<TPayload> {
  readonly count: number;
  readonly event: string;
  readonly payloadFactory?: (index: number) => TPayload | undefined;
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
  public readonly gameId: string | undefined;

  public constructor(options: ScenarioActorOptions) {
    this.label = options.label;
    this.socket = options.socket;
    this.namespace = options.namespace ?? "unknown";
    this.userId = options.userId;
    this.gameId = options.gameId;
  }

  public emit<TPayload = unknown>(event: string, payload?: TPayload): void {
    if (payload === undefined) {
      this.socket.emit(event);
      return;
    }

    this.socket.emit(event, payload);
  }

  public emitMany<TPayload = unknown>(options: EmitManyOptions<TPayload>): void {
    for (let index = 0; index < options.count; index += 1) {
      this.emit(options.event, options.payloadFactory?.(index));
    }
  }

  public get socketId(): string | undefined {
    return this.socket.id;
  }

  public get connected(): boolean {
    return this.socket.connected;
  }
}
