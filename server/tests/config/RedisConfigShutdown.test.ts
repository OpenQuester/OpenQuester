import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";

const shutdownGuardMs = 1500;

class MockRedis extends EventEmitter {
  public status = "ready";
  public disconnectCalls = 0;
  public quitCalls = 0;

  public duplicate(): MockRedis {
    const RedisConstructor = this.constructor as new () => MockRedis;
    return new RedisConstructor();
  }

  public config(): Promise<string> {
    return Promise.resolve("OK");
  }

  public quit(): Promise<string> {
    this.quitCalls += 1;
    return new Promise(() => {
      // Simulate an ioredis quit call that never settles during process shutdown.
    });
  }

  public disconnect(_reconnect = false): void {
    this.disconnectCalls += 1;
    this.status = "end";
    this.emit("close");
    this.emit("end");
  }
}

const loadRedisConfig = async (): Promise<{
  RedisConfig: typeof import("shared/config/RedisConfig").RedisConfig;
  instances: MockRedis[];
}> => {
  jest.resetModules();
  const instances: MockRedis[] = [];

  class TrackedRedis extends MockRedis {
    public constructor() {
      super();
      instances.push(this);
    }
  }

  jest.doMock("ioredis", () => ({
    __esModule: true,
    default: TrackedRedis
  }));

  const { RedisConfig } = await import("shared/config/RedisConfig");
  return { RedisConfig, instances };
};

const wait = async (ms: number): Promise<"timed-out"> =>
  new Promise((resolve) => {
    setTimeout(() => resolve("timed-out"), ms);
  });

describe("RedisConfig shutdown", () => {
  afterEach(() => {
    jest.dontMock("ioredis");
    jest.resetModules();
  });

  it("does not hang when a ready Redis client never resolves quit", async () => {
    const { RedisConfig, instances } = await loadRedisConfig();

    RedisConfig.getClient();
    RedisConfig.getSubClient();

    const result = await Promise.race([
      RedisConfig.disconnect().then(() => "closed" as const),
      wait(shutdownGuardMs)
    ]);

    expect(result).toBe("closed");
    expect(instances).toHaveLength(2);
    expect(instances.every((client) => client.quitCalls === 1)).toBe(true);
    expect(instances.every((client) => client.disconnectCalls === 1)).toBe(true);
  });
});
