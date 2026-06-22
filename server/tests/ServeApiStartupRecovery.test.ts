import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { GameService } from "application/services/game/GameService";
import { PermissionService } from "application/services/permission/PermissionService";
import { RedisPubSubService } from "application/services/redis/RedisPubSubService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { container } from "bootstrap/bootstrapContainer";
import { Environment } from "shared/config/Environment";
import { ILogger } from "shared/logging/ILogger";
import type { LogLevel, PerformanceLog } from "shared/logging/LoggerTypes";
import type { LogMeta } from "shared/logging/LogMeta";
import type { LogType } from "shared/logging/LogType";
import { setTestEnvDefaults } from "tests/utils/utils";
import { ServeApi } from "../src/ServeApi";

class TestLogger extends ILogger {
  public readonly warnings: string[] = [];

  info(_msg: string, _meta: LogMeta): void {
    // no-op
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

interface StartupJobContext {
  _context: {
    env: Pick<Environment, "ADMIN_EMAILS" | "STARTUP_RECOVERY_ENABLED">;
    logger: ILogger;
  };
  _assertStartupCanContinue(stage: string): void;
}

interface StartupJobRunner {
  _runStartupPreparation(this: StartupJobContext): Promise<void>;
}

const runStartupJobs = (
  env: Pick<Environment, "ADMIN_EMAILS" | "STARTUP_RECOVERY_ENABLED">,
  logger: ILogger
): Promise<void> => {
  const runner = ServeApi.prototype as unknown as StartupJobRunner;
  return runner._runStartupPreparation.call({
    _context: { env, logger },
    _assertStartupCanContinue: (_stage: string): void => undefined
  });
};

const registerStartupJobMocks = () => {
  const gameService = {
    cleanupAllGames: jest.fn(async (): Promise<void> => undefined),
    cleanOrphanedGames: jest.fn(async (): Promise<void> => undefined)
  };
  const socketUserDataService = {
    cleanupAllSession: jest.fn(async (): Promise<void> => undefined)
  };
  const pubSub = {
    initKeyExpirationHandling: jest.fn(async (): Promise<void> => undefined)
  };
  const permissionService = {
    grantAllPermissionsByEmails: jest.fn(async (_emails: string[]): Promise<void> => undefined)
  };
  const cronScheduler = {
    initialize: jest.fn(async (): Promise<void> => undefined)
  };

  container.registerInstance(GameService, gameService as unknown as GameService);
  container.registerInstance(
    SocketUserDataService,
    socketUserDataService as unknown as SocketUserDataService
  );
  container.registerInstance(RedisPubSubService, pubSub as unknown as RedisPubSubService);
  container.registerInstance(
    PermissionService,
    permissionService as unknown as PermissionService
  );
  container.registerInstance(CronSchedulerService, cronScheduler as unknown as CronSchedulerService);

  return {
    gameService,
    socketUserDataService,
    pubSub,
    permissionService,
    cronScheduler
  };
};

describe("ServeApi startup recovery", () => {
  const logger = new TestLogger();

  afterEach(() => {
    container.reset();
    delete process.env.STARTUP_RECOVERY_ENABLED;
    logger.warnings.length = 0;
  });

  it("keeps exclusive cold-start recovery disabled when the environment variable is absent", async () => {
    setTestEnvDefaults();
    delete process.env.STARTUP_RECOVERY_ENABLED;

    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    expect(env.STARTUP_RECOVERY_ENABLED).toBe(false);
  });

  it("keeps exclusive cold-start recovery disabled when explicitly set to false", async () => {
    setTestEnvDefaults();
    process.env.STARTUP_RECOVERY_ENABLED = "false";

    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    expect(env.STARTUP_RECOVERY_ENABLED).toBe(false);
  });

  it("enables exclusive cold-start recovery only when explicitly set to true", async () => {
    setTestEnvDefaults();
    process.env.STARTUP_RECOVERY_ENABLED = "true";

    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    expect(env.STARTUP_RECOVERY_ENABLED).toBe(true);
  });

  it("skips destructive game and session cleanup when exclusive cold-start recovery is disabled", async () => {
    const mocks = registerStartupJobMocks();
    const adminEmails = ["admin@example.com"];

    await runStartupJobs({ ADMIN_EMAILS: adminEmails, STARTUP_RECOVERY_ENABLED: false }, logger);

    expect(mocks.gameService.cleanupAllGames).not.toHaveBeenCalled();
    expect(mocks.socketUserDataService.cleanupAllSession).not.toHaveBeenCalled();
    expect(mocks.gameService.cleanOrphanedGames).toHaveBeenCalledTimes(1);
    expect(mocks.permissionService.grantAllPermissionsByEmails).toHaveBeenCalledWith(adminEmails);
    expect(mocks.pubSub.initKeyExpirationHandling).not.toHaveBeenCalled();
    expect(mocks.cronScheduler.initialize).not.toHaveBeenCalled();
  });

  it("runs destructive cleanup and warning for explicit exclusive cold-start recovery", async () => {
    const mocks = registerStartupJobMocks();
    const adminEmails = ["admin@example.com"];

    await runStartupJobs({ ADMIN_EMAILS: adminEmails, STARTUP_RECOVERY_ENABLED: true }, logger);

    expect(mocks.gameService.cleanupAllGames).toHaveBeenCalledTimes(1);
    expect(mocks.socketUserDataService.cleanupAllSession).toHaveBeenCalledTimes(1);
    expect(mocks.gameService.cleanOrphanedGames).toHaveBeenCalledTimes(1);
    expect(mocks.permissionService.grantAllPermissionsByEmails).toHaveBeenCalledWith(adminEmails);
    expect(logger.warnings.join("\n")).toContain("exclusive cold-start recovery");
    expect(logger.warnings.join("\n")).toContain("all games and socket sessions");
  });
});
