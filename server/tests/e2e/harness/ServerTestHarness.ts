import { type Express } from "express";
import { type DataSource } from "typeorm";

import { type Database } from "infrastructure/database/Database";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

interface ServerTestHarnessOptions {
  apiPort?: number;
}

type TestAppBootstrap = Awaited<ReturnType<typeof bootstrapTestApp>>;

interface EnvSnapshot {
  apiPort: string | undefined;
  dbName: string | undefined;
  redisDbNumber: string | undefined;
}

export class ServerTestHarness {
  private _stopped = false;

  private constructor(
    private readonly testEnvironment: TestEnvironment,
    private readonly testApp: TestAppBootstrap,
    private readonly envSnapshot: EnvSnapshot
  ) {
    //
  }

  public static async start(
    options: ServerTestHarnessOptions = {}
  ): Promise<ServerTestHarness> {
    const envSnapshot = captureEnv();
    const logger = await PinoLogger.init({ pretty: true });
    const testEnvironment = new TestEnvironment(logger);
    const startupErrors: Error[] = [];

    try {
      await testEnvironment.setup();
      const testApp = await bootstrapTestApp(testEnvironment.getDatabase(), options);
      return new ServerTestHarness(testEnvironment, testApp, envSnapshot);
    } catch (error) {
      startupErrors.push(toLifecycleError("Server test harness startup", error));
      await collectFailure(
        startupErrors,
        "Test environment teardown after startup failure",
        async () => {
          await testEnvironment.teardown();
        }
      );
      restoreEnv(envSnapshot);
      throw combineErrors("ServerTestHarness startup failed", startupErrors);
    }
  }

  public get app(): Express {
    return this.testApp.app;
  }

  public get database(): Database {
    return this.testApp.database;
  }

  public get dataSource(): DataSource {
    return this.testApp.dataSource;
  }

  public get serverUrl(): string {
    return this.testApp.serverUrl;
  }

  public async stop(): Promise<void> {
    if (this._stopped) {
      return;
    }

    this._stopped = true;
    const cleanupErrors: Error[] = [];

    await collectFailure(cleanupErrors, "Test app cleanup", async () => {
      await this.testApp.cleanup();
    });
    await collectFailure(cleanupErrors, "Test environment teardown", async () => {
      await this.testEnvironment.teardown();
    });

    restoreEnv(this.envSnapshot);
    throwIfFailed("ServerTestHarness cleanup failed", cleanupErrors);
  }
}

async function collectFailure(
  errors: Error[],
  label: string,
  action: () => Promise<void>
): Promise<void> {
  try {
    await action();
  } catch (error) {
    errors.push(toLifecycleError(label, error));
  }
}

function toLifecycleError(label: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`${label} failed: ${error.message}`, { cause: error });
  }

  return new Error(`${label} failed: ${String(error)}`);
}

function combineErrors(message: string, errors: Error[]): Error {
  if (errors.length === 1) {
    return errors[0];
  }

  return new AggregateError(errors, message);
}

function throwIfFailed(message: string, errors: Error[]): void {
  if (errors.length === 0) {
    return;
  }

  throw combineErrors(message, errors);
}

function captureEnv(): EnvSnapshot {
  return {
    apiPort: process.env.API_PORT,
    dbName: process.env.DB_NAME,
    redisDbNumber: process.env.REDIS_DB_NUMBER
  };
}

function restoreEnv(snapshot: EnvSnapshot): void {
  restoreEnvValue("API_PORT", snapshot.apiPort);
  restoreEnvValue("DB_NAME", snapshot.dbName);
  restoreEnvValue("REDIS_DB_NUMBER", snapshot.redisDbNumber);
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
