import { afterEach, describe, expect, it } from "@jest/globals";
import { createServer, type Server as HTTPServer } from "http";
import { io as createSocket, type Socket } from "socket.io-client";

import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const healthPath = "/v1/test/health";

const connectSocket = async (serverUrl: string): Promise<Socket> => {
  const socket = createSocket(`${serverUrl}${SOCKET_GAME_NAMESPACE}`, {
    reconnection: false,
    timeout: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS,
    transports: ["websocket"]
  });

  return new Promise<Socket>((resolve, reject) => {
    const cleanup = (): void => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };
    const onConnect = (): void => {
      cleanup();
      resolve(socket);
    };
    const onConnectError = (error: Error): void => {
      cleanup();
      socket.disconnect();
      reject(error);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
  });
};

const waitForSocketDisconnect = async (socket: Socket): Promise<void> => {
  if (!socket.connected) {
    return;
  }

  await new Promise<void>((resolve) => {
    socket.once("disconnect", () => resolve());
  });
};

const listenOnEphemeralPort = async (): Promise<{ server: HTTPServer; port: number }> => {
  const server = createServer((_req, res) => {
    res.statusCode = 204;
    res.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected dummy server to bind to a TCP port");
  }

  return { server, port: address.port };
};

const closeServer = async (server: HTTPServer): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

describe("ServerTestHarness", () => {
  let harness: ServerTestHarness | undefined;

  afterEach(async () => {
    await harness?.stop();
    harness = undefined;
  });

  it("starts a real HTTP and Socket.IO server on the actual bound port", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });

    const url = new URL(harness.serverUrl);
    expect(url.protocol).toBe("http:");
    expect(url.hostname).toBe("127.0.0.1");
    expect(Number.parseInt(url.port, 10)).toBeGreaterThan(0);
    expect(url.port).not.toBe("0");
    expect(process.env.API_PORT).toBe("0");

    const response = await fetch(`${harness.serverUrl}${healthPath}`);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);

    const socket = await connectSocket(harness.serverUrl);
    const disconnected = waitForSocketDisconnect(socket);

    await harness.stop();
    await disconnected;

    expect(socket.connected).toBe(false);
    await expect(fetch(`${harness.serverUrl}${healthPath}`)).rejects.toThrow();
  });

  it("allows stop to be called more than once", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });

    await harness.stop();
    await expect(harness.stop()).resolves.toBeUndefined();
  });

  it("rejects startup when the configured port cannot listen", async () => {
    const occupied = await listenOnEphemeralPort();

    try {
      await expect(ServerTestHarness.start({ apiPort: occupied.port })).rejects.toThrow();
    } finally {
      await closeServer(occupied.server);
    }
  });
});
