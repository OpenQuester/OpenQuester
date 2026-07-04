import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { SingleInstanceRestartRecoveryService } from "application/services/recovery/SingleInstanceRestartRecoveryService";
import { type GameService } from "application/services/game/GameService";
import { type SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { type SingleInstanceRestartRecoveryResult } from "domain/types/recovery/SingleInstanceRestartRecoveryResult";
import { Environment } from "shared/config/Environment";
import { ILogger } from "shared/logging/ILogger";
import type { LogLevel, PerformanceLog } from "shared/logging/LoggerTypes";
import type { LogMeta } from "shared/logging/LogMeta";
import type { LogType } from "shared/logging/LogType";
import { setTestEnvDefaults } from "tests/utils/utils";

class TestLogger extends ILogger {
  public readonly infos: string[] = [];
  public readonly warnings: string[] = [];

  info(msg: string, _meta: LogMeta): void {
    this.infos.push(msg);
  }
  debug(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  trace(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  warn(msg: string, _meta: LogMeta): void {
    this.warnings.push(msg);
  }
  error(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  audit(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  performance(_msg: string, _meta: LogMeta): PerformanceLog {
    return { finish: () => undefined };
  }
  migration(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  log(_type: LogType, _msg: string, _meta: LogMeta): void {
    // no-op
  }
  checkAccess(_logLevel: LogLevel, _requiredLogLevel: LogLevel): boolean {
    return true;
  }
}

const originalEnv = { ...process.env };

const restoreProcessEnv = (): void => {
  process.env = { ...originalEnv };
};

const setMinimalProductionLikeEnv = (): void => {
  process.env.ENV = "dev";
  process.env.DB_PASS = "postgres";
  process.env.DB_LOGGER = "false";
  process.env.LOG_LEVEL = "error";
  process.env.INFLUX_URL = "";
  delete process.env.STARTUP_RECOVERY_ENABLED;
};

const createService = (
  startupRecoveryEnabled: boolean,
  logger: TestLogger
): {
  service: SingleInstanceRestartRecoveryService;
  gameService: Pick<GameService, "recoverAllGamesAfterSingleInstanceRestart">;
  socketUserDataService: Pick<
    SocketUserDataService,
    "clearAllSocketSessionsAfterSingleInstanceRestart"
  >;
} => {
  const env = { STARTUP_RECOVERY_ENABLED: startupRecoveryEnabled } as Pick<
    Environment,
    "STARTUP_RECOVERY_ENABLED"
  >;
  const gameService = {
    recoverAllGamesAfterSingleInstanceRestart: jest.fn(async () =>
      Promise.resolve({
        status: "completed" as const,
        recoveredGames: 2,
        recoveredTimers: 1
      })
    )
  };
  const socketUserDataService = {
    clearAllSocketSessionsAfterSingleInstanceRestart: jest.fn(async () =>
      Promise.resolve({
        status: "completed" as const,
        removedSocketSessions: 3,
        removedUserSocketLookups: 2
      })
    )
  };

  return {
    service: new SingleInstanceRestartRecoveryService(
      env as Environment,
      gameService as unknown as GameService,
      socketUserDataService as unknown as SocketUserDataService,
      logger
    ),
    gameService,
    socketUserDataService
  };
};

describe("single-instance restart recovery startup configuration", () => {
  const logger = new TestLogger();

  afterEach(() => {
    restoreProcessEnv();
    logger.infos.length = 0;
    logger.warnings.length = 0;
  });

  it("keeps production single-instance restart recovery enabled by default", () => {
    setMinimalProductionLikeEnv();

    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    expect(env.STARTUP_RECOVERY_ENABLED).toBe(true);
  });

  it("keeps test runtime startup recovery disabled by explicit default", () => {
    setTestEnvDefaults();

    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    expect(env.STARTUP_RECOVERY_ENABLED).toBe(false);
  });

  it("allows recovery tests to opt into single-instance restart recovery explicitly", () => {
    setTestEnvDefaults({ startupRecoveryEnabled: true });

    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    expect(env.STARTUP_RECOVERY_ENABLED).toBe(true);
  });
});

describe("SingleInstanceRestartRecoveryService", () => {
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger();
  });

  it("skips destructive game and session cleanup when disabled", async () => {
    const { service, gameService, socketUserDataService } = createService(false, logger);

    const result = await service.recoverIfEnabled();

    expect(result).toEqual({
      status: "disabled"
    } satisfies SingleInstanceRestartRecoveryResult);
    expect(gameService.recoverAllGamesAfterSingleInstanceRestart).not.toHaveBeenCalled();
    expect(
      socketUserDataService.clearAllSocketSessionsAfterSingleInstanceRestart
    ).not.toHaveBeenCalled();
    expect(logger.infos.join("\n")).toContain("single-instance restart recovery disabled");
    expect(logger.warnings).toHaveLength(0);
  });

  it("runs game and socket cleanup once when enabled for single-instance restart recovery", async () => {
    const { service, gameService, socketUserDataService } = createService(true, logger);

    const result = await service.recoverIfEnabled();

    expect(gameService.recoverAllGamesAfterSingleInstanceRestart).toHaveBeenCalledTimes(1);
    expect(
      socketUserDataService.clearAllSocketSessionsAfterSingleInstanceRestart
    ).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "completed",
      gameRecovery: {
        status: "completed",
        recoveredGames: 2,
        recoveredTimers: 1
      },
      socketSessionCleanup: {
        status: "completed",
        removedSocketSessions: 3,
        removedUserSocketLookups: 2
      }
    } satisfies SingleInstanceRestartRecoveryResult);
    expect(logger.warnings.join("\n")).toContain("single-instance restart recovery");
    expect(logger.warnings.join("\n")).toContain("all games, timers, and socket sessions");
    expect(logger.warnings.join("\n")).toContain("invalid for multiple live server instances");
  });

  it("wraps game recovery failures", async () => {
    const { service, gameService, socketUserDataService } = createService(true, logger);
    const failure = new Error("game recovery failed");
    jest
      .spyOn(gameService, "recoverAllGamesAfterSingleInstanceRestart")
      .mockRejectedValue(failure);

    await expect(service.recoverIfEnabled()).rejects.toThrow(
      "single-instance restart game recovery failed"
    );
    expect(
      socketUserDataService.clearAllSocketSessionsAfterSingleInstanceRestart
    ).not.toHaveBeenCalled();
    expect(logger.infos.join("\n")).not.toContain("completed");
  });

  it("wraps socket-session cleanup failures", async () => {
    const { service, socketUserDataService } = createService(true, logger);
    const failure = new Error("socket cleanup failed");
    jest
      .spyOn(socketUserDataService, "clearAllSocketSessionsAfterSingleInstanceRestart")
      .mockRejectedValue(failure);

    await expect(service.recoverIfEnabled()).rejects.toThrow(
      "single-instance restart socket-session cleanup failed"
    );
    expect(logger.infos.join("\n")).not.toContain("completed");
  });
});
