import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { createServer, type Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";

import { SOCKET_ROOT_NAMESPACE } from "domain/constants/socket";
import { Environment } from "shared/config/Environment";
import { fetchJson, fetchWithTimeout } from "tests/e2e/harness/HttpTestClient";
import { disconnectSocket } from "tests/e2e/harness/SocketTestWait";
import { connectRootSocket, requireSocketId } from "tests/e2e/harness/SocketClientTestUtils";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { flattenErrorMessages, withTimeout } from "tests/e2e/harness/TestPromiseUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const healthPath = "/health/live";
const httpRequestTimeoutMs = 2000;
const envKeysMutatedByHarness = [
  "ENV",
  "NODE_ENV",
  "CORS_ORIGINS",
  "LOG_LEVEL",
  "S3_BUCKET",
  "INFLUX_URL",
  "STARTUP_RECOVERY_ENABLED"
] as const;

type HarnessEnvKey = (typeof envKeysMutatedByHarness)[number];
type EnvValues = Record<HarnessEnvKey, string | undefined>;

const preListenEnvValues: Record<HarnessEnvKey, string> = {
  ENV: "pre-listen-env",
  NODE_ENV: "pre-listen-node-env",
  CORS_ORIGINS: "pre-listen-cors",
  LOG_LEVEL: "pre-listen-log",
  S3_BUCKET: "pre-listen-bucket",
  INFLUX_URL: "pre-listen-influx",
  STARTUP_RECOVERY_ENABLED: "pre-listen-preserved"
};

const listenOnEphemeralPort = async (): Promise<{
  server: HTTPServer;
  port: number;
  serverUrl: string;
}> => {
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
      server.listen(0, onListening);
    }),
    httpRequestTimeoutMs,
    "dummy HTTP listen"
  );

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected dummy server to bind to a TCP port");
  }

  return {
    server,
    port: address.port,
    serverUrl: `http://${normalizeClientHost(address)}:${address.port}`
  };
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
      server.closeIdleConnections();
    }),
    httpRequestTimeoutMs,
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

const captureEnvValues = (): EnvValues =>
  Object.fromEntries(envKeysMutatedByHarness.map((key) => [key, process.env[key]])) as EnvValues;

const setEnvValues = (values: Record<HarnessEnvKey, string>): void => {
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
};

const restoreEnvValues = (values: EnvValues): void => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
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

const normalizeClientHost = (address: { address: string; family: string | number }): string => {
  if (address.address === "::" || address.address === "0.0.0.0") {
    return "127.0.0.1";
  }
  if (address.family === "IPv6") {
    return `[${address.address}]`;
  }

  return address.address;
};

const expectDummyServerResponds = async (serverUrl: string): Promise<void> => {
  const response = await fetchWithTimeout(serverUrl);
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

    await expect(fetchJson(`${harness.serverUrl}${healthPath}`)).resolves.toMatchObject({
      status: 200,
      body: { status: "live" }
    });

    const socket = await connectRootSocket(harness.serverUrl, "lifecycle-smoke");
    const socketId = requireSocketId(socket);
    const serverDisconnect = harness.waitForSocketDisconnect(
      SOCKET_ROOT_NAMESPACE,
      socketId,
      "lifecycle-smoke",
      TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    );
    await disconnectSocket(socket, {
      client: "lifecycle-smoke",
      namespace: SOCKET_ROOT_NAMESPACE,
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
      await expectDummyServerResponds(occupied.serverUrl);

      harness = await ServerTestHarness.start({ apiPort: 0 });
      await expect(fetchJson(`${harness.serverUrl}${healthPath}`)).resolves.toMatchObject({
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
    const originalEnvValues = captureEnvValues();
    let restoredEnvValues: EnvValues | undefined;
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
    setEnvValues(preListenEnvValues);

    let startupError: unknown;
    try {
      await ServerTestHarness.startInitializing({ apiPort: 0 });
    } catch (error) {
      startupError = error;
    } finally {
      restoredEnvValues = captureEnvValues();
      restoreEnvValues(originalEnvValues);
    }

    expect(startupError).toBeDefined();
    const messages = flattenErrorMessages(startupError).join("\n");
    expect(messages).toContain("session config failed before HTTP listen");
    expect(messages).toContain(
      "Server initialization failed before HTTP listening:\n" +
        "session config failed before HTTP listen"
    );
    expect(messages).not.toContain("Timed out after 2000ms waiting for test HTTP server to listen");
    expect(messages).not.toContain("ERR_SERVER_NOT_RUNNING");
    expect(socketCloseSpy).toHaveBeenCalledTimes(1);
    expect(socketCloseResults).toEqual(["ERR_SERVER_NOT_RUNNING:Server is not running."]);
    expect(restoredEnvValues).toEqual(preListenEnvValues);
    expect(captureEnvValues()).toEqual(originalEnvValues);
  });

  it("runs repeated lifecycle cycles in one Jest process", async () => {
    for (let cycle = 1; cycle <= 2; cycle += 1) {
      harness = await ServerTestHarness.start({ apiPort: 0 });
      await expect(fetchJson(`${harness.serverUrl}${healthPath}`)).resolves.toMatchObject({
        status: 200,
        body: { status: "live" }
      });

      const socket = await connectRootSocket(harness.serverUrl, `cycle-${cycle}`);
      const socketId = requireSocketId(socket);
      const serverDisconnect = harness.waitForSocketDisconnect(
        SOCKET_ROOT_NAMESPACE,
        socketId,
        `cycle-${cycle}`,
        TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
      );
      await disconnectSocket(socket, {
        client: `cycle-${cycle}`,
        namespace: SOCKET_ROOT_NAMESPACE,
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
    await expect(firstStop).rejects.toThrow(SOCKET_ROOT_NAMESPACE);
    await expect(firstStop).rejects.toThrow("tests must close their Socket.IO clients");
    await expectServerClosed(serverUrl);
  });
});
