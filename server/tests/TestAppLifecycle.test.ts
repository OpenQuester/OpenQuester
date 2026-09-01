import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import * as http from "http";
import { type Redis } from "ioredis";
import { Server as IOServer } from "socket.io";
import { container } from "tsyringe";
import { type DataSource } from "typeorm";

import { Database } from "infrastructure/database/Database";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { Environment } from "shared/config/Environment";
import { RedisConfig } from "shared/config/RedisConfig";
import { createTestAppRuntime } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { flattenErrorMessages, getRejectedError } from "tests/e2e/harness/TestPromiseUtils";

let mockCreatedHttpServer: http.Server | undefined;

jest.mock("http", () => {
  const actualHttp = jest.requireActual<typeof import("http")>("http");

  return {
    ...actualHttp,
    createServer: jest.fn((requestListener?: http.RequestListener) => {
      mockCreatedHttpServer = actualHttp.createServer(requestListener);
      return mockCreatedHttpServer;
    })
  };
});

interface RedisDouble extends EventEmitter {
  psubscribe: jest.Mock<() => Promise<number>>;
  subscribe: jest.Mock<() => Promise<number>>;
  punsubscribe: jest.Mock<() => Promise<number>>;
  unsubscribe: jest.Mock<() => Promise<number>>;
  publish: jest.Mock<() => Promise<number>>;
}

describe("createTestAppRuntime lifecycle", () => {
  let envSnapshot: NodeJS.ProcessEnv;
  let logger: PinoLogger;
  let loggerClose: jest.Mock<() => Promise<void>>;
  let loggerError: jest.Mock<() => void>;
  let redis: RedisDouble;
  let redisSub: RedisDouble;
  let redisDisconnect: jest.SpiedFunction<typeof RedisConfig.disconnect>;
  let containerClear: jest.SpiedFunction<typeof container.clearInstances>;
  let ioClose: jest.SpiedFunction<typeof IOServer.prototype.close>;
  let environmentLoad: jest.Mock<() => void>;
  let environmentSessionLoad: jest.Mock<() => Promise<void>>;

  beforeEach(() => {
    envSnapshot = { ...process.env };
    mockCreatedHttpServer = undefined;
    jest.mocked(http.createServer).mockClear();
    loggerClose = jest.fn<() => Promise<void>>().mockResolvedValue();
    loggerError = jest.fn<() => void>();
    logger = {
      info: jest.fn(),
      error: loggerError,
      trace: jest.fn(),
      performance: jest.fn(() => ({ finish: jest.fn() })),
      close: loggerClose
    } as unknown as PinoLogger;
    redis = createRedisDouble();
    redisSub = createRedisDouble();
    environmentLoad = jest.fn<() => void>();
    environmentSessionLoad = jest.fn<() => Promise<void>>().mockResolvedValue();

    jest.spyOn(PinoLogger, "init").mockResolvedValue(logger);
    jest.spyOn(Database, "getInstance").mockReturnValue({} as Database);
    jest.spyOn(RedisConfig, "getClient").mockReturnValue(redis as unknown as Redis);
    jest.spyOn(RedisConfig, "getSubClient").mockReturnValue(redisSub as unknown as Redis);
    jest.spyOn(RedisConfig, "initConfig").mockResolvedValue();
    jest.spyOn(RedisConfig, "waitForConnection").mockResolvedValue();
    redisDisconnect = jest.spyOn(RedisConfig, "disconnect").mockResolvedValue();
    jest.spyOn(Environment, "getInstance").mockReturnValue({
      API_PORT: 0,
      load: environmentLoad,
      loadSessionConfig: environmentSessionLoad
    } as unknown as Environment);
    containerClear = jest.spyOn(container, "clearInstances").mockImplementation(() => undefined);
    ioClose = jest.spyOn(IOServer.prototype, "close");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnv(envSnapshot);
  });

  it("cleans resources acquired before Redis initialization rejects", async () => {
    const startupFailure = new Error("Redis startup failed");
    jest.spyOn(RedisConfig, "initConfig").mockRejectedValue(startupFailure);

    await expect(createTestAppRuntime({} as DataSource)).rejects.toBe(startupFailure);

    expect(mockCreatedHttpServer).toBeUndefined();
    expect(ioClose).not.toHaveBeenCalled();
    expect(redisDisconnect).toHaveBeenCalledTimes(1);
    expect(containerClear).toHaveBeenCalledTimes(1);
    expect(loggerClose).toHaveBeenCalledTimes(1);
  });

  it("closes partial transport resources when context loading rejects", async () => {
    const startupFailure = new Error("Environment load failed");
    environmentLoad.mockImplementation(() => {
      throw startupFailure;
    });

    await expect(createTestAppRuntime({} as DataSource)).rejects.toBe(startupFailure);

    expect(ioClose).toHaveBeenCalledTimes(1);
    expect(redisDisconnect).toHaveBeenCalledTimes(1);
    expect(containerClear).toHaveBeenCalledTimes(1);
    expect(loggerClose).toHaveBeenCalledTimes(1);
    expect(mockCreatedHttpServer?.listening).toBe(false);
    expect(mockCreatedHttpServer?.address()).toBeNull();
    expect(mockCreatedHttpServer?.eventNames()).toEqual([]);
    expect(redis.listenerCount("error")).toBe(0);
    expect(redisSub.listenerCount("error")).toBe(0);
    expect(redisSub.listenerCount("pmessageBuffer")).toBe(0);
    expect(redisSub.listenerCount("messageBuffer")).toBe(0);
  });

  it("recognizes partial Socket.IO close by error code without matching Node's message", async () => {
    const startupFailure = new Error("Environment load failed");
    environmentLoad.mockImplementation(() => {
      throw startupFailure;
    });
    ioClose.mockImplementationOnce(async (callback?: (error?: Error) => void) => {
      callback?.(
        Object.assign(new Error("Server already stopped with a runtime-specific message"), {
          code: "ERR_SERVER_NOT_RUNNING"
        })
      );
    });

    await expect(createTestAppRuntime({} as DataSource)).rejects.toBe(startupFailure);

    expect(ioClose).toHaveBeenCalledTimes(1);
    expect(redisDisconnect).toHaveBeenCalledWith({ strict: true });
    expect(loggerClose).toHaveBeenCalledTimes(1);
  });

  it("preserves startup and every cleanup failure while continuing disposal", async () => {
    const startupFailure = new Error("Environment load failed");
    environmentLoad.mockImplementation(() => {
      throw startupFailure;
    });
    redisDisconnect.mockRejectedValue(new Error("Redis cleanup failed"));
    loggerClose.mockRejectedValue(new Error("Logger cleanup failed"));
    loggerError.mockImplementationOnce(() => {
      throw new Error("Cleanup diagnostic failed");
    });

    const error = await getRejectedError(createTestAppRuntime({} as DataSource));

    expect(error).toBeInstanceOf(AggregateError);
    expect(flattenErrorMessages(error)).toEqual(
      expect.arrayContaining([
        "Startup failed: Environment load failed",
        "Redis disconnect failed: Redis cleanup failed",
        "Redis disconnect cleanup failure logging failed: Cleanup diagnostic failed",
        "Logger close failed: Logger cleanup failed"
      ])
    );
    expect(ioClose).toHaveBeenCalledTimes(1);
    expect(redisDisconnect).toHaveBeenCalledTimes(1);
    expect(redisDisconnect).toHaveBeenCalledWith({ strict: true });
    expect(containerClear).toHaveBeenCalledTimes(1);
    expect(loggerClose).toHaveBeenCalledTimes(1);
    expect(mockCreatedHttpServer?.eventNames()).toEqual([]);
  });

  it("makes successful runtime cleanup idempotent", async () => {
    const runtime = await createTestAppRuntime({} as DataSource);

    await Promise.all([runtime.cleanup(), runtime.cleanup()]);

    expect(ioClose).toHaveBeenCalledTimes(1);
    expect(redisDisconnect).toHaveBeenCalledTimes(1);
    expect(containerClear).toHaveBeenCalledTimes(1);
    expect(loggerClose).toHaveBeenCalledTimes(1);
    expect(mockCreatedHttpServer?.eventNames()).toEqual([]);
  });

  it("force-closes transport resources when ServeApi shutdown rejects", async () => {
    const runtime = await createTestAppRuntime({} as DataSource);
    const shutdownFailure = new Error("immediate shutdown failure");
    jest.spyOn(runtime.api, "shutdown").mockRejectedValue(shutdownFailure);

    const error = await getRejectedError(runtime.cleanup());

    expect(flattenErrorMessages(error)).toEqual(
      expect.arrayContaining([
        "ServeApi shutdown failed: immediate shutdown failure",
        "immediate shutdown failure"
      ])
    );
    expect(ioClose).toHaveBeenCalledTimes(1);
    expect(redisDisconnect).toHaveBeenCalledTimes(1);
    expect(containerClear).toHaveBeenCalledTimes(1);
    expect(loggerClose).toHaveBeenCalledTimes(1);
    expect(mockCreatedHttpServer?.eventNames()).toEqual([]);
  });

  it("bounds full harness startup and its rollback when initialization never settles", async () => {
    environmentSessionLoad.mockReturnValue(new Promise<void>(() => undefined));
    jest.spyOn(TestEnvironment.prototype, "setup").mockResolvedValue();
    jest.spyOn(TestEnvironment.prototype, "getDatabase").mockReturnValue({} as DataSource);
    const teardown = jest.spyOn(TestEnvironment.prototype, "teardown").mockResolvedValue();
    const startedAt = Date.now();

    const error = await getRejectedError(
      ServerTestHarness.start({
        apiPort: 0,
        apiStartupTimeoutMs: 25,
        apiShutdownTimeoutMs: 25
      })
    );

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(flattenErrorMessages(error)).toEqual(
      expect.arrayContaining([
        "Startup failed: Timed out after 25ms waiting for test app API startup",
        "ServeApi shutdown failed: Timed out after 25ms waiting for test app ServeApi shutdown"
      ])
    );
    expect(ioClose).toHaveBeenCalledTimes(1);
    expect(redisDisconnect).toHaveBeenCalledTimes(1);
    expect(containerClear).toHaveBeenCalledTimes(1);
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(mockCreatedHttpServer?.eventNames()).toEqual([]);
  });

  it("keeps the harness HTTP-listen timeout bounded during stalled startup rollback", async () => {
    environmentSessionLoad.mockReturnValue(new Promise<void>(() => undefined));
    jest.spyOn(TestEnvironment.prototype, "setup").mockResolvedValue();
    jest.spyOn(TestEnvironment.prototype, "getDatabase").mockReturnValue({} as DataSource);
    const teardown = jest.spyOn(TestEnvironment.prototype, "teardown").mockResolvedValue();
    const startedAt = Date.now();

    const error = await getRejectedError(
      ServerTestHarness.startInitializing({
        apiPort: 0,
        httpListenTimeoutMs: 25,
        apiShutdownTimeoutMs: 25
      })
    );

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(flattenErrorMessages(error)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Timed out after 25ms waiting for test HTTP server to listen"),
        expect.stringContaining(
          "ServeApi shutdown failed: Timed out after 25ms waiting for test app ServeApi shutdown"
        )
      ])
    );
    expect(ioClose).toHaveBeenCalledTimes(1);
    expect(redisDisconnect).toHaveBeenCalledTimes(1);
    expect(containerClear).toHaveBeenCalledTimes(1);
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(mockCreatedHttpServer?.eventNames()).toEqual([]);
  });
});

function createRedisDouble(): RedisDouble {
  return Object.assign(new EventEmitter(), {
    psubscribe: jest.fn<() => Promise<number>>().mockResolvedValue(1),
    subscribe: jest.fn<() => Promise<number>>().mockResolvedValue(1),
    punsubscribe: jest.fn<() => Promise<number>>().mockResolvedValue(1),
    unsubscribe: jest.fn<() => Promise<number>>().mockResolvedValue(1),
    publish: jest.fn<() => Promise<number>>().mockResolvedValue(1)
  });
}

function restoreEnv(snapshot: NodeJS.ProcessEnv): void {
  const snapshotKeys = new Set(Object.keys(snapshot));
  for (const key of Object.keys(process.env)) {
    if (!snapshotKeys.has(key)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
