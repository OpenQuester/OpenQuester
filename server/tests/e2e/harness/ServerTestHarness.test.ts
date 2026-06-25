import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { createServer, type Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";
import { io as createSocket, type Socket as ClientSocket } from "socket.io-client";

import { Environment } from "shared/config/Environment";
import {
  disconnectSocket,
  waitForSocketConnection
} from "tests/e2e/harness/SocketTestWait";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const healthPath = "/health/live";
const httpTimeoutMs = 2000;

const connectRootSocket = async (
  serverUrl: string,
  client: string
): Promise<ClientSocket> => {
  const socket = createSocket(serverUrl, {
    forceNew: true,
    reconnection: false,
    timeout: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS,
    transports: ["websocket"]
  });

  await waitForSocketConnection(socket, {
    client,
    serverUrl,
    timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
  });

  return socket;
};

const requireSocketId = (socket: ClientSocket): string => {
  if (!socket.id) {
    throw new Error("Expected connected Socket.IO client to have an id");
  }

  return socket.id;
};

const listenOnEphemeralPort = async (): Promise<{ server: HTTPServer; port: number }> => {
  const server = createServer((_req, res) => {
    res.statusCode = 204;
    res.end();
  });

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        server.off("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.listen(0, "127.0.0.1", onListening);
    }),
    httpTimeoutMs,
    "dummy HTTP listen"
  );

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected dummy server to bind to a TCP port");
  }

  return { server, port: address.port };
};

const closeServer = async (server: HTTPServer): Promise<void> => {
  if (!server.listening) {
    return;
  }

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
    httpTimeoutMs,
    "dummy HTTP close"
  );
};

const formatSocketIoCloseResult = (error: Error | undefined): string => {
  if (!error) {
    return "ok";
  }

  const errorWithCode = error as { code?: unknown };
  if (typeof errorWithCode.code === "string") {
    return `${errorWithCode.code}:${error.message}`;
  }

  return error.message;
};

const fetchJson = async (url: string): Promise<{ status: number; body: unknown }> => {
  const response = await fetchWithTimeout(url);
  return {
    status: response.status,
    body: await response.json()
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

const flattenErrorMessages = (error: unknown): string[] => {
  const messages: string[] = [];
  const visit = (current: unknown): void => {
    if (current instanceof AggregateError) {
      messages.push(current.message);
      for (const nested of current.errors) {
        visit(nested);
      }
      visit(current.cause);
      return;
    }

    if (current instanceof Error) {
      messages.push(current.message);
      visit(current.cause);
      return;
    }

    if (current !== undefined) {
      messages.push(String(current));
    }
  };

  visit(error);
  return messages;
};

const expectStartupFailureForPort = async (port: number): Promise<void> => {
  let startupError: unknown;
  try {
    await ServerTestHarness.start({ apiPort: port });
  } catch (error) {
    startupError = error;
  }

  expect(startupError).toBeDefined();
  const messages = flattenErrorMessages(startupError).join("\n");
  expect(messages).toContain("EADDRINUSE");
  expect(messages).toContain(String(port));
  expect(messages).toContain("HTTP listen");
};

const expectServerClosed = async (serverUrl: string): Promise<void> => {
  await expect(fetchWithTimeout(`${serverUrl}${healthPath}`)).rejects.toThrow(
    "HTTP request failed"
  );
};

const expectDummyServerResponds = async (port: number): Promise<void> => {
  const response = await fetchWithTimeout(`http://127.0.0.1:${port}`);
  expect(response.status).toBe(204);
};

describe("ServerTestHarness", () => {
  let harness: ServerTestHarness | undefined;

  afterEach(async () => {
    const currentHarness = harness;
    harness = undefined;
    await currentHarness?.stop();
    jest.restoreAllMocks();
  });

  it("starts a real HTTP and root Socket.IO server on the actual bound port", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });

    const url = new URL(harness.serverUrl);
    expect(url.protocol).toBe("http:");
    expect(url.hostname).toBe("127.0.0.1");
    expect(Number.parseInt(url.port, 10)).toBeGreaterThan(0);
    expect(url.port).not.toBe("0");
    expect(process.env.API_PORT).toBe("0");

    await expect(fetchJson(`${harness.serverUrl}${healthPath}`)).resolves.toEqual({
      status: 200,
      body: { status: "live" }
    });

    const socket = await connectRootSocket(harness.serverUrl, "lifecycle-smoke");
    const socketId = requireSocketId(socket);
    const serverDisconnect = harness.waitForSocketDisconnect(
      "/",
      socketId,
      "lifecycle-smoke",
      TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    );
    await disconnectSocket(socket, {
      client: "lifecycle-smoke",
      namespace: "/",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    });
    await serverDisconnect;

    const serverUrl = harness.serverUrl;
    await harness.stop();
    await expectServerClosed(serverUrl);
  });

  it("returns the same successful stop promise for repeated stop calls", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });

    const firstStop = harness.stop();
    const secondStop = harness.stop();

    expect(secondStop).toBe(firstStop);
    await expect(firstStop).resolves.toBeUndefined();
  });

  it("rejects occupied-port startup with the HTTP listen EADDRINUSE failure", async () => {
    const occupied = await listenOnEphemeralPort();

    try {
      await expectStartupFailureForPort(occupied.port);
      await expectDummyServerResponds(occupied.port);

      harness = await ServerTestHarness.start({ apiPort: 0 });
      await expect(fetchJson(`${harness.serverUrl}${healthPath}`)).resolves.toEqual({
        status: 200,
        body: { status: "live" }
      });
      await harness.stop();
    } finally {
      await closeServer(occupied.server);
    }
  });

  it("fails startInitializing immediately when initialization fails before HTTP listen", async () => {
    const startupFailure = new Error("session config failed before HTTP listen");
    const originalStartupRecoveryEnabled = process.env.STARTUP_RECOVERY_ENABLED;
    let restoredStartupRecoveryEnabled: string | undefined;
    const socketCloseResults: string[] = [];
    const originalClose: IOServer["close"] = IOServer.prototype.close;
    jest.spyOn(Environment.prototype, "loadSessionConfig").mockRejectedValue(startupFailure);
    const socketCloseSpy = jest
      .spyOn(IOServer.prototype, "close")
      .mockImplementation(function closeWithResultCapture(
        this: IOServer,
        fn?: (err?: Error) => void
      ): Promise<void> {
        return originalClose.call(this, (error?: Error) => {
          socketCloseResults.push(formatSocketIoCloseResult(error));
          fn?.(error);
        });
      });
    process.env.STARTUP_RECOVERY_ENABLED = "pre-listen-preserved";

    let startupError: unknown;
    try {
      await ServerTestHarness.startInitializing({ apiPort: 0 });
    } catch (error) {
      startupError = error;
    } finally {
      restoredStartupRecoveryEnabled = process.env.STARTUP_RECOVERY_ENABLED;
      if (originalStartupRecoveryEnabled === undefined) {
        delete process.env.STARTUP_RECOVERY_ENABLED;
      } else {
        process.env.STARTUP_RECOVERY_ENABLED = originalStartupRecoveryEnabled;
      }
    }

    expect(startupError).toBeDefined();
    const messages = flattenErrorMessages(startupError).join("\n");
    expect(messages).toContain("session config failed before HTTP listen");
    expect(messages).toContain(
      "Server initialization failed before HTTP listening:\n" +
        "session config failed before HTTP listen"
    );
    expect(messages).not.toContain(
      "Timed out after 2000ms waiting for test HTTP server to listen"
    );
    expect(messages).not.toContain("ERR_SERVER_NOT_RUNNING");
    expect(socketCloseSpy).toHaveBeenCalledTimes(1);
    expect(socketCloseResults).toEqual(["ERR_SERVER_NOT_RUNNING:Server is not running."]);
    expect(restoredStartupRecoveryEnabled).toBe("pre-listen-preserved");
    expect(process.env.STARTUP_RECOVERY_ENABLED).toBe(originalStartupRecoveryEnabled);
  });

  it("runs repeated lifecycle cycles in one Jest process", async () => {
    for (let cycle = 1; cycle <= 3; cycle += 1) {
      harness = await ServerTestHarness.start({ apiPort: 0 });
      await expect(fetchJson(`${harness.serverUrl}${healthPath}`)).resolves.toEqual({
        status: 200,
        body: { status: "live" }
      });

      const socket = await connectRootSocket(harness.serverUrl, `cycle-${cycle}`);
      const socketId = requireSocketId(socket);
      const serverDisconnect = harness.waitForSocketDisconnect(
        "/",
        socketId,
        `cycle-${cycle}`,
        TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
      );
      await disconnectSocket(socket, {
        client: `cycle-${cycle}`,
        namespace: "/",
        serverUrl: harness.serverUrl,
        timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
      });
      await serverDisconnect;

      await harness.stop();
      harness = undefined;
    }
  });

  it("reports connected client diagnostics while still closing leaked resources", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    const socket = await connectRootSocket(harness.serverUrl, "leaked-root-client");
    const serverUrl = harness.serverUrl;

    const firstStop = harness.stop();
    const secondStop = harness.stop();
    harness = undefined;

    expect(secondStop).toBe(firstStop);
    await expect(firstStop).rejects.toThrow(socket.id ?? "unknown");
    await expect(firstStop).rejects.toThrow("/");
    await expect(firstStop).rejects.toThrow("tests must close their Socket.IO clients");
    await expectServerClosed(serverUrl);
  });
});
