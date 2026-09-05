import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import type Redis from "ioredis";

import { RedisConfig } from "shared/config/RedisConfig";
import type { ILogger } from "shared/logging/ILogger";

interface FakeRedisOptions {
  readonly status?: string;
  readonly quitFailure?: Error;
  readonly pendingCommand?: Promise<unknown>;
  readonly emitCloseOnQuit?: boolean;
  readonly emitCloseOnDisconnect?: boolean;
}

class FakeRedisClient extends EventEmitter {
  public status: string;
  public readonly quit: jest.Mock<() => Promise<string>>;
  public readonly disconnect: jest.Mock<(reconnect?: boolean) => void>;
  public readonly commandQueue?: {
    readonly length: number;
    peekAt(index: number): { command: { promise: Promise<unknown> } } | undefined;
  };

  public constructor(options: FakeRedisOptions = {}) {
    super();
    this.status = options.status ?? "ready";
    this.quit = jest.fn(async () => {
      if (options.quitFailure) {
        throw options.quitFailure;
      }
      if (options.emitCloseOnQuit !== false) {
        this.status = "end";
        this.emit("end");
      }
      return "OK";
    });
    this.disconnect = jest.fn(() => {
      if (options.emitCloseOnDisconnect !== false) {
        this.status = "end";
        this.emit("close");
      }
    });

    if (options.pendingCommand) {
      this.commandQueue = {
        length: 1,
        peekAt: (index) =>
          index === 0 ? { command: { promise: options.pendingCommand! } } : undefined
      };
    }
  }
}

interface RedisConfigInternals {
  _client: Redis | undefined;
  _subClient: Redis | undefined;
  _clients: Set<Redis>;
  _logger: ILogger;
}

const redisConfig = RedisConfig as unknown as RedisConfigInternals;

describe("RedisConfig strict disconnect", () => {
  beforeEach(() => {
    redisConfig._client = undefined;
    redisConfig._subClient = undefined;
    redisConfig._clients = new Set();
    redisConfig._logger = {
      warn: jest.fn()
    } as unknown as ILogger;
  });

  afterEach(() => {
    jest.useRealTimers();
    redisConfig._client = undefined;
    redisConfig._subClient = undefined;
    redisConfig._clients.clear();
  });

  it("disposes every registered client and aggregates non-benign close failures", async () => {
    const failedClient = new FakeRedisClient({
      quitFailure: new Error("quit failed")
    });
    const healthyClient = new FakeRedisClient();
    registerClients(failedClient, healthyClient);

    const error = await captureFailure(() => RedisConfig.disconnect({ strict: true }));

    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toContain("quit failed");
    expect(failedClient.quit).toHaveBeenCalledTimes(1);
    expect(failedClient.disconnect).toHaveBeenCalledTimes(1);
    expect(healthyClient.quit).toHaveBeenCalledTimes(1);
    expect(redisConfig._clients.size).toBe(0);
    expect(redisConfig._client).toBeUndefined();
    expect(redisConfig._subClient).toBeUndefined();
  });

  it("rejects a pending-command deadline and still closes the client", async () => {
    jest.useFakeTimers();
    const client = new FakeRedisClient({
      status: "connecting",
      pendingCommand: new Promise(() => undefined)
    });
    registerClients(client);

    const failure = captureFailure(() => RedisConfig.disconnect({ strict: true }));
    await jest.advanceTimersByTimeAsync(500);
    const error = await failure;

    expect(error.message).toContain("pending Redis command");
    expect(client.disconnect).toHaveBeenCalledWith(false);
  });

  it("rejects when a client does not close before the deadline", async () => {
    jest.useFakeTimers();
    const client = new FakeRedisClient({
      status: "connecting",
      emitCloseOnDisconnect: false
    });
    registerClients(client);

    const failure = captureFailure(() => RedisConfig.disconnect({ strict: true }));
    await jest.advanceTimersByTimeAsync(500);
    const error = await failure;

    expect(error.message).toContain("waiting for Redis client close");
    expect(client.disconnect).toHaveBeenCalledWith(false);
    expect(client.listenerCount("end")).toBe(0);
    expect(client.listenerCount("close")).toBe(0);
  });

  it("keeps an already-closed connection error benign in strict mode", async () => {
    const client = new FakeRedisClient({
      quitFailure: new Error("Connection is closed.")
    });
    registerClients(client);

    await expect(RedisConfig.disconnect({ strict: true })).resolves.toBeUndefined();

    expect(client.quit).toHaveBeenCalledTimes(1);
    expect(client.listenerCount("end")).toBe(0);
    expect(client.listenerCount("close")).toBe(0);
  });

  it("preserves lenient production handling when strict mode is not requested", async () => {
    jest.useFakeTimers();
    const client = new FakeRedisClient({
      quitFailure: new Error("quit failed")
    });
    registerClients(client);

    await expect(RedisConfig.disconnect()).resolves.toBeUndefined();

    expect(client.disconnect).not.toHaveBeenCalled();
    expect(redisConfig._logger.warn).toHaveBeenCalledWith(
      "Redis connection closed",
      expect.objectContaining({ error: "quit failed" })
    );
    await jest.advanceTimersByTimeAsync(500);
  });
});

function registerClients(...clients: FakeRedisClient[]): void {
  const redisClients = clients.map((client) => client as unknown as Redis);
  redisConfig._clients = new Set(redisClients);
  redisConfig._client = redisClients[0];
  redisConfig._subClient = redisClients[1];
}

async function captureFailure(action: () => Promise<void>): Promise<Error> {
  try {
    await action();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  throw new Error("Expected action to fail");
}
