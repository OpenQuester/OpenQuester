import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Server as IOServer } from "socket.io";
import { type Socket as ClientSocket } from "socket.io-client";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { GameService } from "application/services/game/GameService";
import { MetricsService } from "application/services/metrics/MetricsService";
import { PackageService } from "application/services/package/PackageService";
import { PermissionService } from "application/services/permission/PermissionService";
import { RedisPubSubService } from "application/services/redis/RedisPubSubService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { SOCKET_GAME_NAMESPACE, SOCKET_ROOT_NAMESPACE } from "domain/constants/socket";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { fetchJson, fetchWithTimeout } from "tests/e2e/harness/HttpTestClient";
import { disconnectSocket, waitForSocketConnection } from "tests/e2e/harness/SocketTestWait";
import {
  createClientSocket,
  expectSocketDoesNotConnect,
  waitForSocketConnectError
} from "tests/e2e/harness/SocketClientTestUtils";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import {
  createControlledPromise,
  findErrorByMessage,
  flattenErrorMessages,
  getAggregateErrors,
  getRejectedError,
  requireAggregateError,
  withTimeout
} from "tests/e2e/harness/TestPromiseUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const httpRequestTimeoutMs = 2000;
const serviceUnavailableStatus = 503;

interface ReadinessCleanupSocket {
  readonly socket: ClientSocket;
  readonly namespace: string;
}

type ReadinessCleanupHarness = Pick<
  ServerTestHarness,
  "serverUrl" | "stop" | "waitForSocketDisconnect"
>;

interface ReadinessCleanupOptions {
  readonly sockets: readonly ReadinessCleanupSocket[];
  readonly harness?: ReadinessCleanupHarness;
  readonly releaseStartupGates?: readonly (() => void)[];
  readonly disconnectClient?: typeof disconnectSocket;
  readonly restoreMocks?: () => void;
}

describe("ServeApi readiness admission", () => {
  let harness: ServerTestHarness | undefined;
  const sockets: ReadinessCleanupSocket[] = [];
  const startupGateReleases: Array<() => void> = [];

  afterEach(async () => {
    const currentHarness = harness;
    harness = undefined;

    await cleanupReadinessResources({
      sockets: sockets.splice(0),
      harness: currentHarness,
      releaseStartupGates: startupGateReleases.splice(0)
    });
  });

  it("keeps HTTP and Socket.IO application traffic out until startup preparation completes", async () => {
    const permissionEntered = createControlledPromise();
    const releasePermission = createStartupGate();
    const packageSearchSpy = jest.spyOn(PackageService.prototype, "searchPackages");
    const actionSubmitSpy = jest.spyOn(GameActionExecutor.prototype, "submitAction");

    jest
      .spyOn(PermissionService.prototype, "grantAllPermissionsByEmails")
      .mockImplementation(async (): Promise<void> => {
        permissionEntered.resolve();
        await releasePermission.promise;
      });

    harness = await ServerTestHarness.startInitializing({ apiPort: 0 });
    const packagesUrl = `${harness.serverUrl}/v1/packages?limit=20&offset=0&sortBy=id`;
    await withTimeout(
      permissionEntered.promise,
      httpRequestTimeoutMs,
      "permission startup preparation to pause"
    );

    await expect(fetchJson(`${harness.serverUrl}/health/live`)).resolves.toMatchObject({
      status: HttpStatus.OK,
      body: { status: "live" }
    });
    await expect(fetchJson(`${harness.serverUrl}/health/ready`)).resolves.toMatchObject({
      status: serviceUnavailableStatus,
      body: { status: "not_ready" },
      retryAfter: expect.any(String),
      cacheControl: expect.stringContaining("no-store")
    });

    await expect(fetchJson(packagesUrl)).resolves.toMatchObject({
      status: serviceUnavailableStatus,
      body: { status: "not_ready" }
    });
    expect(packageSearchSpy).not.toHaveBeenCalled();

    const rootSocket = createClientSocket(harness.serverUrl);
    const gameSocket = createClientSocket(harness.serverUrl, SOCKET_GAME_NAMESPACE);
    sockets.push(
      { socket: rootSocket, namespace: SOCKET_ROOT_NAMESPACE },
      { socket: gameSocket, namespace: SOCKET_GAME_NAMESPACE }
    );

    gameSocket.emit(SocketIOGameEvents.PLAYER_READY, {});

    await expectSocketDoesNotConnect(rootSocket, "root-during-startup", harness.serverUrl);
    await expectSocketDoesNotConnect(gameSocket, "game-during-startup", harness.serverUrl);
    expect(actionSubmitSpy).not.toHaveBeenCalled();

    releasePermission.resolve();
    await harness.initPromise;

    await expect(fetchJson(`${harness.serverUrl}/health/ready`)).resolves.toMatchObject({
      status: HttpStatus.OK,
      body: { status: "ready" }
    });
    await waitForSocketConnection(rootSocket, {
      client: "root-during-startup",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    });
    await waitForSocketConnection(gameSocket, {
      client: "game-during-startup",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    });

    await expect(fetchJson(packagesUrl)).resolves.toMatchObject({
      status: HttpStatus.OK
    });
    expect(packageSearchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not start runtime services after shutdown is requested during initialization", async () => {
    const permissionEntered = createControlledPromise();
    const releasePermission = createStartupGate();
    const events: string[] = [];
    const pubSubSpy = jest.spyOn(RedisPubSubService.prototype, "initKeyExpirationHandling");
    const cronSpy = jest.spyOn(CronSchedulerService.prototype, "initialize");
    const metricsSpy = jest.spyOn(MetricsService.prototype, "start");
    jest.spyOn(MetricsService.prototype, "stop").mockImplementation(async (): Promise<void> => {
      events.push("cleanup-started");
      events.push("cleanup-finished");
    });

    jest
      .spyOn(PermissionService.prototype, "grantAllPermissionsByEmails")
      .mockImplementation(async (): Promise<void> => {
        events.push("startup-stage-entered");
        permissionEntered.resolve();
        await releasePermission.promise;
        events.push("startup-stage-released");
        events.push("startup-aborted");
      });

    harness = await ServerTestHarness.startInitializing({ apiPort: 0 });
    await withTimeout(
      permissionEntered.promise,
      httpRequestTimeoutMs,
      "permission startup preparation to pause before shutdown"
    );

    const firstShutdown = harness.api.shutdown();
    const secondShutdown = harness.api.shutdown();
    events.push("shutdown-requested");
    expect(secondShutdown).toBe(firstShutdown);

    let shutdownSettled = false;
    void firstShutdown.finally(() => {
      shutdownSettled = true;
    });

    await expect(fetchJson(`${harness.serverUrl}/health/ready`)).resolves.toMatchObject({
      status: serviceUnavailableStatus,
      body: { status: "not_ready" }
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(shutdownSettled).toBe(false);
    expect(events).not.toContain("cleanup-started");

    const rejectedSocket = createClientSocket(harness.serverUrl, SOCKET_GAME_NAMESPACE);
    sockets.push({ socket: rejectedSocket, namespace: SOCKET_GAME_NAMESPACE });
    const connectError = await waitForSocketConnectError(
      rejectedSocket,
      "game-after-shutdown-request",
      harness.serverUrl
    );
    expect(connectError.message).toContain("server-not-ready");

    releasePermission.resolve();
    await expect(harness.initPromise).rejects.toThrow("shutdown");
    await withTimeout(
      firstShutdown,
      httpRequestTimeoutMs,
      "ServeApi shutdown during initialization"
    );
    events.push("shutdown-resolved");

    expect(pubSubSpy).not.toHaveBeenCalled();
    expect(cronSpy).not.toHaveBeenCalled();
    expect(metricsSpy).not.toHaveBeenCalled();
    expect(events).toEqual([
      "startup-stage-entered",
      "shutdown-requested",
      "startup-stage-released",
      "startup-aborted",
      "cleanup-started",
      "cleanup-finished",
      "shutdown-resolved"
    ]);
    await expect(fetchWithTimeout(`${harness.serverUrl}/health/live`)).rejects.toThrow(
      "HTTP request failed"
    );
  });

  it("keeps failed startup not ready and reports pending Socket.IO admission failure", async () => {
    const permissionEntered = createControlledPromise();
    const releasePermission = createStartupGate();
    const metricsStopEntered = createControlledPromise();
    const releaseMetricsStop = createStartupGate();
    const startupFailure = new Error("permission bootstrap failed intentionally");
    const events: string[] = [];
    const originalClose: IOServer["close"] = IOServer.prototype.close;
    const socketCloseSpy = jest
      .spyOn(IOServer.prototype, "close")
      .mockImplementation(function closeWithLifecycleEvent(
        this: IOServer,
        fn?: (err?: Error) => void
      ): Promise<void> {
        return originalClose.call(this, (error?: Error) => {
          events.push("Socket.IO close callback completed");
          events.push("HTTP server closed");
          fn?.(error);
        });
      });
    const pubSubSpy = jest.spyOn(RedisPubSubService.prototype, "initKeyExpirationHandling");
    const cronSpy = jest.spyOn(CronSchedulerService.prototype, "initialize");
    const metricsSpy = jest.spyOn(MetricsService.prototype, "start");
    jest.spyOn(MetricsService.prototype, "stop").mockImplementation(async (): Promise<void> => {
      metricsStopEntered.resolve();
      await releaseMetricsStop.promise;
    });

    jest
      .spyOn(PermissionService.prototype, "grantAllPermissionsByEmails")
      .mockImplementation(async (): Promise<void> => {
        permissionEntered.resolve();
        await releasePermission.promise;
        events.push("startup collaborator fails");
        throw startupFailure;
      });

    harness = await ServerTestHarness.startInitializing({ apiPort: 0 });
    events.push("HTTP listening");
    await withTimeout(
      permissionEntered.promise,
      httpRequestTimeoutMs,
      "permission startup preparation before failure"
    );
    events.push("startup collaborator entered");

    await expect(fetchJson(`${harness.serverUrl}/health/ready`)).resolves.toMatchObject({
      status: serviceUnavailableStatus,
      body: { status: "not_ready" }
    });

    const gameSocket = createClientSocket(harness.serverUrl, SOCKET_GAME_NAMESPACE);
    sockets.push({ socket: gameSocket, namespace: SOCKET_GAME_NAMESPACE });

    await expectSocketDoesNotConnect(gameSocket, "game-before-startup-failure", harness.serverUrl);

    const initRejection = harness.initPromise.catch((error: unknown) => {
      events.push("initPromise rejected");
      return error;
    });
    const admissionRejected = waitForSocketConnectError(
      gameSocket,
      "game-before-startup-failure",
      harness.serverUrl
    ).then((error) => {
      events.push("readiness rejected");
      events.push("Socket.IO admission rejected");
      return error;
    });

    releasePermission.resolve();
    await withTimeout(
      metricsStopEntered.promise,
      httpRequestTimeoutMs,
      "metrics cleanup to pause before Socket.IO close"
    );
    const connectError = await admissionRejected;
    expect(connectError.message).toContain("server-not-ready");
    releaseMetricsStop.resolve();

    await expect(initRejection).resolves.toBe(startupFailure);
    expect(pubSubSpy).not.toHaveBeenCalled();
    expect(cronSpy).not.toHaveBeenCalled();
    expect(metricsSpy).not.toHaveBeenCalled();
    await expect(fetchWithTimeout(`${harness.serverUrl}/health/live`)).rejects.toThrow(
      "HTTP request failed"
    );
    await expect(fetchWithTimeout(`${harness.serverUrl}/health/ready`)).rejects.toThrow(
      "HTTP request failed"
    );

    const firstShutdown = harness.api.shutdown();
    const secondShutdown = harness.api.shutdown();
    expect(secondShutdown).toBe(firstShutdown);
    await expect(firstShutdown).resolves.toBeUndefined();
    expect(socketCloseSpy).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      "HTTP listening",
      "startup collaborator entered",
      "startup collaborator fails",
      "readiness rejected",
      "Socket.IO admission rejected",
      "Socket.IO close callback completed",
      "HTTP server closed",
      "initPromise rejected"
    ]);
  });

  it("aggregates startup failure and rollback cleanup failure with retained causes", async () => {
    const permissionEntered = createControlledPromise();
    const releasePermission = createStartupGate();
    const startupFailure = new Error("permission bootstrap failed before rollback");
    const cleanupFailure = new Error("metrics cleanup failed during rollback");

    jest
      .spyOn(PermissionService.prototype, "grantAllPermissionsByEmails")
      .mockImplementation(async (): Promise<void> => {
        permissionEntered.resolve();
        await releasePermission.promise;
        throw startupFailure;
      });
    jest.spyOn(MetricsService.prototype, "stop").mockRejectedValue(cleanupFailure);

    harness = await ServerTestHarness.startInitializing({ apiPort: 0 });
    await withTimeout(
      permissionEntered.promise,
      httpRequestTimeoutMs,
      "permission startup preparation before aggregate failure"
    );

    releasePermission.resolve();
    const initError = await getRejectedError(harness.initPromise);
    const aggregate = requireAggregateError(initError);

    expect(aggregate.message).toBe("ServeApi startup failed and rollback was incomplete");
    const startupError = findErrorByMessage(
      getAggregateErrors(aggregate),
      "ServeApi startup failed: permission bootstrap failed before rollback"
    );
    expect(startupError?.cause).toBe(startupFailure);

    const rollbackError = findErrorByMessage(
      getAggregateErrors(aggregate),
      "ServeApi startup rollback failed: ServeApi shutdown failed"
    );
    const rollbackAggregate = requireAggregateError(rollbackError?.cause);
    const metricsError = findErrorByMessage(
      getAggregateErrors(rollbackAggregate),
      "Metrics service stop failed: metrics cleanup failed during rollback"
    );
    expect(metricsError?.cause).toBe(cleanupFailure);
    expect(flattenErrorMessages(initError)).toEqual(
      expect.arrayContaining([
        "ServeApi startup failed and rollback was incomplete",
        "ServeApi startup failed: permission bootstrap failed before rollback",
        "permission bootstrap failed before rollback",
        "ServeApi startup rollback failed: ServeApi shutdown failed",
        "ServeApi shutdown failed",
        "Metrics service stop failed: metrics cleanup failed during rollback",
        "metrics cleanup failed during rollback"
      ])
    );

    const currentHarness = harness;
    harness = undefined;
    if (!currentHarness) {
      throw new Error("Expected harness to be initialized");
    }
    const stopError = await getRejectedError(currentHarness.stop());
    expect(flattenErrorMessages(stopError)).toEqual(
      expect.arrayContaining([
        "Metrics service stop failed: metrics cleanup failed during rollback",
        "metrics cleanup failed during rollback"
      ])
    );
  });

  it("keeps single-instance restart recovery before readiness", async () => {
    const cleanupEntered = createControlledPromise();
    const releaseCleanup = createStartupGate();
    const events: string[] = [];

    jest
      .spyOn(GameService.prototype, "recoverAllGamesAfterSingleInstanceRestart")
      .mockImplementation(async () => {
        events.push("cleanup-start");
        cleanupEntered.resolve();
        await releaseCleanup.promise;
        events.push("cleanup-end");
        return {
          status: "completed" as const,
          recoveredGames: 0,
          recoveredTimers: 0
        };
      });
    const sessionCleanupSpy = jest
      .spyOn(SocketUserDataService.prototype, "clearAllSocketSessionsAfterSingleInstanceRestart")
      .mockResolvedValue({
        status: "completed",
        removedSocketSessions: 0,
        removedUserSocketLookups: 0
      });

    harness = await ServerTestHarness.startInitializing({
      apiPort: 0,
      startupRecoveryEnabled: true
    });
    await withTimeout(
      cleanupEntered.promise,
      httpRequestTimeoutMs,
      "single-instance restart recovery cleanup to pause"
    );

    await expect(fetchJson(`${harness.serverUrl}/health/ready`)).resolves.toMatchObject({
      status: serviceUnavailableStatus,
      body: { status: "not_ready" }
    });

    releaseCleanup.resolve();
    await harness.initPromise;
    const ready = await fetchJson(`${harness.serverUrl}/health/ready`);
    events.push("ready");

    expect(ready).toMatchObject({
      status: HttpStatus.OK,
      body: { status: "ready" }
    });
    expect(sessionCleanupSpy).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["cleanup-start", "cleanup-end", "ready"]);
  });

  it("aggregates every cleanup failure and restores mocks after harness stop", async () => {
    const firstDisconnectFailure = new Error("first client disconnect failed");
    const secondDisconnectFailure = new Error("second client disconnect failed");
    const serverDisconnectFailure = new Error("server disconnect wait failed");
    const harnessStopFailure = new Error("harness stop failed");
    const restoreFailure = new Error("mock restore failed");
    const events: string[] = [];
    const firstSocket = { id: "socket-1" } as ClientSocket;
    const secondSocket = { id: "socket-2" } as ClientSocket;
    const disconnectClient = jest
      .fn<typeof disconnectSocket>()
      .mockImplementationOnce(async () => {
        events.push("disconnect-1");
        throw firstDisconnectFailure;
      })
      .mockImplementationOnce(async () => {
        events.push("disconnect-2");
        throw secondDisconnectFailure;
      });
    const waitForSocketDisconnect = jest
      .fn<ReadinessCleanupHarness["waitForSocketDisconnect"]>()
      .mockImplementationOnce(async () => {
        events.push("server-wait-1");
        throw serverDisconnectFailure;
      })
      .mockImplementationOnce(async () => {
        events.push("server-wait-2");
      });
    const stop = jest.fn<ReadinessCleanupHarness["stop"]>().mockImplementation(async () => {
      events.push("harness-stop");
      throw harnessStopFailure;
    });
    const restoreMocks = jest.fn(() => {
      events.push("restore-mocks");
      throw restoreFailure;
    });

    const error = await getRejectedError(
      cleanupReadinessResources({
        sockets: [
          { socket: firstSocket, namespace: SOCKET_ROOT_NAMESPACE },
          { socket: secondSocket, namespace: SOCKET_GAME_NAMESPACE }
        ],
        harness: {
          serverUrl: "http://readiness.test",
          stop,
          waitForSocketDisconnect
        },
        disconnectClient,
        restoreMocks
      })
    );
    const aggregate = requireAggregateError(error);

    expect(events).toEqual([
      "disconnect-1",
      "server-wait-1",
      "disconnect-2",
      "server-wait-2",
      "harness-stop",
      "restore-mocks"
    ]);
    expect(getAggregateErrors(aggregate).map((failure) => (failure as Error).cause)).toEqual([
      firstDisconnectFailure,
      serverDisconnectFailure,
      secondDisconnectFailure,
      harnessStopFailure,
      restoreFailure
    ]);
  });

  function createStartupGate(): ReturnType<typeof createControlledPromise<void>> {
    const gate = createControlledPromise<void>();
    startupGateReleases.push(() => gate.resolve());
    return gate;
  }
});

async function cleanupReadinessResources(options: ReadinessCleanupOptions): Promise<void> {
  const failures: Error[] = [];
  const disconnectClient = options.disconnectClient ?? disconnectSocket;
  const restoreMocks = options.restoreMocks ?? (() => jest.restoreAllMocks());

  try {
    for (const release of options.releaseStartupGates ?? []) {
      await collectReadinessCleanupFailure(failures, "Startup gate release", release);
    }

    for (const { socket, namespace } of options.sockets) {
      const socketId = socket.id;
      await collectReadinessCleanupFailure(
        failures,
        `Client socket disconnect (namespace=${namespace}, socketId=${socketId ?? "unknown"})`,
        async () => {
          await disconnectClient(socket, {
            client: "readiness-cleanup",
            namespace,
            serverUrl: options.harness?.serverUrl ?? "unknown",
            timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
          });
        }
      );

      if (options.harness && socketId) {
        await collectReadinessCleanupFailure(
          failures,
          `Server socket disconnect (namespace=${namespace}, socketId=${socketId})`,
          async () => {
            await options.harness?.waitForSocketDisconnect(
              namespace,
              socketId,
              "readiness-cleanup",
              TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
            );
          }
        );
      }
    }

    if (options.harness) {
      await collectReadinessCleanupFailure(failures, "Harness stop", async () => {
        await options.harness?.stop();
      });
    }
  } finally {
    await collectReadinessCleanupFailure(failures, "Jest mock restoration", () => {
      restoreMocks();
    });
  }

  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw new AggregateError(
      failures,
      `ServeApi readiness cleanup failed: ${failures.map((failure) => failure.message).join("; ")}`
    );
  }
}

async function collectReadinessCleanupFailure(
  failures: Error[],
  label: string,
  action: () => void | Promise<void>
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    failures.push(new Error(`${label} failed: ${cause.message}`, { cause }));
  }
}
