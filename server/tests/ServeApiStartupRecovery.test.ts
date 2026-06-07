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
  info(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  debug(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  trace(_msg: string, _meta: LogMeta): void {
    // no-op
  }
  warn(_msg: string, _meta: LogMeta): void {
    // no-op
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
}

interface StartupJobRunner {
  _processPrepareJobs(this: StartupJobContext): Promise<void>;
}

const runStartupJobs = (
  env: Pick<Environment, "ADMIN_EMAILS" | "STARTUP_RECOVERY_ENABLED">,
  logger: ILogger
): Promise<void> => {
  const runner = ServeApi.prototype as unknown as StartupJobRunner;
  return runner._processPrepareJobs.call({ _context: { env, logger } });
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
  });

  it("skips destructive game and session cleanup when startup recovery is disabled", async () => {
    const mocks = registerStartupJobMocks();
    const adminEmails = ["admin@example.com"];

    await runStartupJobs({ ADMIN_EMAILS: adminEmails, STARTUP_RECOVERY_ENABLED: false }, logger);

    expect(mocks.gameService.cleanupAllGames).not.toHaveBeenCalled();
    expect(mocks.socketUserDataService.cleanupAllSession).not.toHaveBeenCalled();
    expect(mocks.gameService.cleanOrphanedGames).toHaveBeenCalledTimes(1);
    expect(mocks.permissionService.grantAllPermissionsByEmails).toHaveBeenCalledWith(adminEmails);
    expect(mocks.pubSub.initKeyExpirationHandling).toHaveBeenCalledTimes(1);
    expect(mocks.cronScheduler.initialize).toHaveBeenCalledTimes(1);
  });

  it("runs startup recovery by default for single-instance deployments", async () => {
    setTestEnvDefaults();
    delete process.env.STARTUP_RECOVERY_ENABLED;

    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    expect(env.STARTUP_RECOVERY_ENABLED).toBe(true);
  });

  it("reads explicit startup recovery disablement from environment", async () => {
    setTestEnvDefaults();
    process.env.STARTUP_RECOVERY_ENABLED = "false";

    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);

    expect(env.STARTUP_RECOVERY_ENABLED).toBe(false);
  });
});
