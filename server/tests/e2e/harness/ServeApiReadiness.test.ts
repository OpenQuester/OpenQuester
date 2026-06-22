import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { io as createSocket, type Socket as ClientSocket } from "socket.io-client";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { CronSchedulerService } from "application/services/cron/CronSchedulerService";
import { GameService } from "application/services/game/GameService";
import { MetricsService } from "application/services/metrics/MetricsService";
import { PackageService } from "application/services/package/PackageService";
import { PermissionService } from "application/services/permission/PermissionService";
import { RedisPubSubService } from "application/services/redis/RedisPubSubService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  disconnectSocket,
  waitForSocketConnection
} from "tests/e2e/harness/SocketTestWait";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const httpTimeoutMs = 2000;
const serviceUnavailableStatus = 503;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (error: unknown) => void;
}

interface JsonResponse {
  status: number;
  body: unknown;
  retryAfter: string | null;
  cacheControl: string | null;
}

const createDeferred = <T = void>(): Deferred<T> => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
};

const createClientSocket = (serverUrl: string, namespace: string = ""): ClientSocket =>
  createSocket(`${serverUrl}${namespace}`, {
    forceNew: true,
    reconnection: false,
    timeout: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS,
    transports: ["websocket"]
  });

const fetchJson = async (url: string): Promise<JsonResponse> => {
  const response = await fetchWithTimeout(url);

  return {
    status: response.status,
    body: await response.json(),
    retryAfter: response.headers.get("retry-after"),
    cacheControl: response.headers.get("cache-control")
  };
};

const fetchWithTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), httpTimeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    throw new Error(`HTTP request failed for ${url}`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${operation}`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const expectSocketDoesNotConnect = async (
  socket: ClientSocket,
  client: string,
  serverUrl: string
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };

    const onConnect = (): void => {
      cleanup();
      reject(
        new Error(
          `Socket.IO client connected before readiness ` +
            `(client="${client}", socketId="${socket.id ?? "unknown"}", ` +
            `serverUrl="${serverUrl}")`
        )
      );
    };

    const onConnectError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
  });
};

const waitForSocketConnectError = async (
  socket: ClientSocket,
  client: string,
  serverUrl: string
): Promise<Error> =>
  new Promise<Error>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out after ${TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS}ms waiting for ` +
            `Socket.IO connect_error (client="${client}", socketId="${socket.id ?? "unknown"}", ` +
            `connected=${socket.connected}, serverUrl="${serverUrl}")`
        )
      );
    }, TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };

    const onConnect = (): void => {
      cleanup();
      reject(
        new Error(
          `Socket.IO client connected while waiting for connect_error ` +
            `(client="${client}", socketId="${socket.id ?? "unknown"}", ` +
            `serverUrl="${serverUrl}")`
        )
      );
    };

    const onConnectError = (error: Error): void => {
      cleanup();
      resolve(error);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
  });

describe("ServeApi readiness admission", () => {
  let harness: ServerTestHarness | undefined;
  const sockets: Array<{ socket: ClientSocket; namespace: string }> = [];

  afterEach(async () => {
    for (const { socket, namespace } of sockets.splice(0)) {
      await disconnectSocket(socket, {
        client: "readiness-cleanup",
        namespace,
        serverUrl: harness?.serverUrl ?? "unknown",
        timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
      });
    }

    const currentHarness = harness;
    harness = undefined;
    await currentHarness?.stop();

    jest.restoreAllMocks();
  });

  it("keeps HTTP and Socket.IO application traffic out until startup preparation completes", async () => {
    const permissionEntered = createDeferred();
    const releasePermission = createDeferred();
    const packageSearchSpy = jest.spyOn(PackageService.prototype, "searchPackages");
    const actionSubmitSpy = jest.spyOn(GameActionExecutor.prototype, "submitAction");

    jest
      .spyOn(PermissionService.prototype, "grantAllPermissionsByEmails")
      .mockImplementation(async (): Promise<void> => {
        permissionEntered.resolve();
        await releasePermission.promise;
      });

    harness = await ServerTestHarness.startInitializing({ apiPort: 0 });
    await withTimeout(
      permissionEntered.promise,
      httpTimeoutMs,
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

    await expect(fetchJson(`${harness.serverUrl}/v1/packages`)).resolves.toMatchObject({
      status: serviceUnavailableStatus,
      body: { status: "not_ready" }
    });
    expect(packageSearchSpy).not.toHaveBeenCalled();

    const rootSocket = createClientSocket(harness.serverUrl);
    const gameSocket = createClientSocket(harness.serverUrl, SOCKET_GAME_NAMESPACE);
    sockets.push(
      { socket: rootSocket, namespace: "/" },
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

    await expect(fetchJson(`${harness.serverUrl}/v1/packages`)).resolves.toMatchObject({
      status: HttpStatus.OK
    });
    expect(packageSearchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not start runtime services after shutdown is requested during initialization", async () => {
    const permissionEntered = createDeferred();
    const releasePermission = createDeferred();
    const pubSubSpy = jest.spyOn(RedisPubSubService.prototype, "initKeyExpirationHandling");
    const cronSpy = jest.spyOn(CronSchedulerService.prototype, "initialize");
    const metricsSpy = jest.spyOn(MetricsService.prototype, "start");

    jest
      .spyOn(PermissionService.prototype, "grantAllPermissionsByEmails")
      .mockImplementation(async (): Promise<void> => {
        permissionEntered.resolve();
        await releasePermission.promise;
      });

    harness = await ServerTestHarness.startInitializing({ apiPort: 0 });
    await withTimeout(
      permissionEntered.promise,
      httpTimeoutMs,
      "permission startup preparation to pause before shutdown"
    );

    const firstShutdown = harness.api.shutdown();
    const secondShutdown = harness.api.shutdown();
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

    releasePermission.resolve();
    await expect(harness.initPromise).rejects.toThrow("shutdown");
    await withTimeout(firstShutdown, httpTimeoutMs, "ServeApi shutdown during initialization");

    expect(pubSubSpy).not.toHaveBeenCalled();
    expect(cronSpy).not.toHaveBeenCalled();
    expect(metricsSpy).not.toHaveBeenCalled();
    await expect(fetchWithTimeout(`${harness.serverUrl}/health/live`)).rejects.toThrow(
      "HTTP request failed"
    );
  });

  it("keeps failed startup not ready and reports pending Socket.IO admission failure", async () => {
    const permissionEntered = createDeferred();
    const releasePermission = createDeferred<void>();
    const startupFailure = new Error("permission bootstrap failed intentionally");
    const cronSpy = jest.spyOn(CronSchedulerService.prototype, "initialize");
    const metricsSpy = jest.spyOn(MetricsService.prototype, "start");

    jest
      .spyOn(PermissionService.prototype, "grantAllPermissionsByEmails")
      .mockImplementation(async (): Promise<void> => {
        permissionEntered.resolve();
        await releasePermission.promise;
        throw startupFailure;
      });

    harness = await ServerTestHarness.startInitializing({ apiPort: 0 });
    await withTimeout(
      permissionEntered.promise,
      httpTimeoutMs,
      "permission startup preparation before failure"
    );

    await expect(fetchJson(`${harness.serverUrl}/health/ready`)).resolves.toMatchObject({
      status: serviceUnavailableStatus,
      body: { status: "not_ready" }
    });

    const gameSocket = createClientSocket(harness.serverUrl, SOCKET_GAME_NAMESPACE);
    sockets.push({ socket: gameSocket, namespace: SOCKET_GAME_NAMESPACE });

    await expectSocketDoesNotConnect(gameSocket, "game-before-startup-failure", harness.serverUrl);

    releasePermission.resolve();
    await expect(harness.initPromise).rejects.toBe(startupFailure);

    const connectError = await waitForSocketConnectError(
      gameSocket,
      "game-before-startup-failure",
      harness.serverUrl
    );
    expect(connectError.message).toContain("server-not-ready");
    expect(cronSpy).not.toHaveBeenCalled();
    expect(metricsSpy).not.toHaveBeenCalled();
    await expect(fetchWithTimeout(`${harness.serverUrl}/health/live`)).rejects.toThrow(
      "HTTP request failed"
    );

    const firstShutdown = harness.api.shutdown();
    const secondShutdown = harness.api.shutdown();
    expect(secondShutdown).toBe(firstShutdown);
    await expect(firstShutdown).resolves.toBeUndefined();
  });

  it("keeps single-instance restart recovery before readiness", async () => {
    const cleanupEntered = createDeferred();
    const releaseCleanup = createDeferred();
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
      httpTimeoutMs,
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
