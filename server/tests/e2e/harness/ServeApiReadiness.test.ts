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
import {
  disconnectSocket,
  waitForSocketConnection
} from "tests/e2e/harness/SocketTestWait";
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

describe("ServeApi readiness admission", () => {
  let harness: ServerTestHarness | undefined;
  const sockets: Array<{ socket: ClientSocket; namespace: string }> = [];

  afterEach(async () => {
    const currentHarness = harness;

    for (const { socket, namespace } of sockets.splice(0)) {
      const socketId = socket.id;
      await disconnectSocket(socket, {
        client: "readiness-cleanup",
        namespace,
        serverUrl: currentHarness?.serverUrl ?? "unknown",
        timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
      });
      if (currentHarness && socketId) {
        await currentHarness.waitForSocketDisconnect(
          namespace,
          socketId,
          "readiness-cleanup",
          TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
        );
      }
    }

    harness = undefined;
    await currentHarness?.stop();

    jest.restoreAllMocks();
  });

  it("keeps HTTP and Socket.IO application traffic out until startup preparation completes", async () => {
    const permissionEntered = createControlledPromise();
    const releasePermission = createControlledPromise();
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
    const releasePermission = createControlledPromise();
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
    const releasePermission = createControlledPromise<void>();
    const metricsStopEntered = createControlledPromise();
    const releaseMetricsStop = createControlledPromise();
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
    const releasePermission = createControlledPromise<void>();
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
    const releaseCleanup = createControlledPromise();
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
});
