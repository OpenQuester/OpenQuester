import { type Express } from "express";
import { type Socket as ServerSocket } from "socket.io";
import { type DataSource } from "typeorm";

import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { type Database } from "infrastructure/database/Database";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp, createTestAppRuntime } from "tests/TestApp";
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

interface ConnectedSocketDiagnostic {
  namespace: string;
  socketId: string;
  userId: number | undefined;
  gameId: string | null | undefined;
}

export class ServerTestHarness {
  private _stopPromise: Promise<void> | undefined;

  private constructor(
    private readonly testEnvironment: TestEnvironment,
    private readonly testApp: TestAppBootstrap,
    private readonly envSnapshot: EnvSnapshot,
    private readonly _initPromise: Promise<void> | undefined = undefined
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
    let started = false;

    try {
      await testEnvironment.setup();
      const testApp = await bootstrapTestApp(testEnvironment.getDatabase(), {
        ...options,
        logger
      });
      started = true;
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
      throw combineErrors("ServerTestHarness startup failed", startupErrors);
    } finally {
      if (!started) {
        restoreEnv(envSnapshot);
      }
    }
  }

  public static async startInitializing(
    options: ServerTestHarnessOptions = {}
  ): Promise<ServerTestHarness> {
    const envSnapshot = captureEnv();
    const logger = await PinoLogger.init({ pretty: true });
    const testEnvironment = new TestEnvironment(logger);
    const startupErrors: Error[] = [];
    let testApp: TestAppBootstrap | undefined;
    let started = false;

    try {
      await testEnvironment.setup();
      testApp = await createTestAppRuntime(testEnvironment.getDatabase(), {
        ...options,
        logger
      });
      const initPromise = testApp.api.init();
      await waitForHttpListening(testApp, TEST_HARNESS_HTTP_LISTEN_TIMEOUT_MS);
      started = true;
      return new ServerTestHarness(testEnvironment, testApp, envSnapshot, initPromise);
    } catch (error) {
      startupErrors.push(toLifecycleError("Server test harness startup", error));
      if (testApp) {
        const currentTestApp = testApp;
        await collectFailure(startupErrors, "Test app cleanup after startup failure", async () => {
          await currentTestApp.cleanup();
        });
      }
      await collectFailure(
        startupErrors,
        "Test environment teardown after startup failure",
        async () => {
          await testEnvironment.teardown();
        }
      );
      throw combineErrors("ServerTestHarness startup failed", startupErrors);
    } finally {
      if (!started) {
        restoreEnv(envSnapshot);
      }
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

  public get api(): TestAppBootstrap["api"] {
    return this.testApp.api;
  }

  public get initPromise(): Promise<void> {
    if (!this._initPromise) {
      throw new Error("ServerTestHarness was started after initialization completed");
    }

    return this._initPromise;
  }

  public waitForSocketDisconnect(
    namespaceName: string,
    socketId: string,
    client: string,
    timeoutMs: number
  ): Promise<void> {
    const namespace = this.testApp.io.of(namespaceName);
    const socket = namespace.sockets.get(socketId);

    if (!socket) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timeout);
        socket.off("disconnect", onDisconnect);
      };

      const onDisconnect = (): void => {
        cleanup();
        resolve();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for server Socket.IO disconnect ` +
              `(client="${client}", namespace="${namespaceName}", socketId="${socketId}", ` +
              `connected=${isServerSocketConnected(socket)}, serverUrl="${this.serverUrl}")`
          )
        );
      }, timeoutMs);

      socket.once("disconnect", onDisconnect);
    });
  }

  public stop(): Promise<void> {
    if (!this._stopPromise) {
      this._stopPromise = this.stopInternal();
    }

    return this._stopPromise;
  }

  private async stopInternal(): Promise<void> {
    const cleanupErrors: Error[] = [];
    const connectedSockets = this.collectConnectedSockets();

    if (connectedSockets.length > 0) {
      cleanupErrors.push(createLeakedSocketError(connectedSockets));
    }

    try {
      await collectFailure(cleanupErrors, "Test app cleanup", async () => {
        await this.testApp.cleanup();
      });
      await collectFailure(cleanupErrors, "Test environment teardown", async () => {
        await this.testEnvironment.teardown();
      });
    } finally {
      restoreEnv(this.envSnapshot);
    }

    throwIfFailed("ServerTestHarness cleanup failed", cleanupErrors);
  }

  private collectConnectedSockets(): ConnectedSocketDiagnostic[] {
    return ["/", SOCKET_GAME_NAMESPACE].flatMap((namespaceName) => {
      const namespace = this.testApp.io.of(namespaceName);
      return [...namespace.sockets.values()].map((socket) => ({
        namespace: namespace.name,
        socketId: socket.id,
        userId: socket.userId,
        gameId: socket.gameId
      }));
    });
  }
}

const TEST_HARNESS_HTTP_LISTEN_TIMEOUT_MS = 2000;

async function waitForHttpListening(
  testApp: TestAppBootstrap,
  timeoutMs: number
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(`Timed out after ${timeoutMs}ms waiting for test HTTP server to listen`)
      );
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      testApp.httpServer.off("listening", onListening);
      testApp.httpServer.off("error", onError);
    };

    const onListening = (): void => {
      cleanup();
      resolve();
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    if (testApp.httpServer.listening) {
      cleanup();
      resolve();
      return;
    }

    testApp.httpServer.once("listening", onListening);
    testApp.httpServer.once("error", onError);
  });
}

function isServerSocketConnected(socket: ServerSocket): boolean {
  return socket.connected;
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

  return new AggregateError(
    errors,
    `${message}: ${errors.map((error) => error.message).join("; ")}`
  );
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

function createLeakedSocketError(sockets: ConnectedSocketDiagnostic[]): Error {
  const details = sockets
    .map(
      (socket) =>
        `namespace="${socket.namespace}", socketId="${socket.socketId}", ` +
        `actor="${socket.userId ?? "unknown"}", gameId="${socket.gameId ?? "unknown"}"`
    )
    .join("; ");

  return new Error(
    "Connected Socket.IO clients remained before ServerTestHarness.stop(); " +
      "tests must close their Socket.IO clients before stopping the harness. " +
      `Sockets: ${details}`
  );
}
