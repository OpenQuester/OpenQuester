import { afterEach, describe, expect, it } from "@jest/globals";
import { io as createSocket, type Socket as ClientSocket } from "socket.io-client";

import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import {
  disconnectSocket,
  waitForSocketConnection,
  waitForSocketEvent
} from "tests/e2e/harness/SocketTestWait";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const shortTimeoutMs = 100;

const createClientSocket = (
  serverUrl: string,
  namespace: string = "",
  forceNew: boolean = true
): ClientSocket =>
  createSocket(`${serverUrl}${namespace}`, {
    forceNew,
    reconnection: false,
    timeout: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS,
    transports: ["websocket"]
  });

const requireSocketId = (socket: ClientSocket): string => {
  if (!socket.id) {
    throw new Error("Expected connected Socket.IO client to have an id");
  }

  return socket.id;
};

describe("SocketTestWait", () => {
  let harness: ServerTestHarness | undefined;
  const sockets: Array<{ socket: ClientSocket; namespace: string; socketId?: string }> = [];

  afterEach(async () => {
    const currentHarness = harness;

    for (const { socket, namespace, socketId: registeredSocketId } of sockets.splice(0)) {
      const socketId = registeredSocketId ?? socket.id;
      if (socket.connected) {
        await disconnectSocket(socket, {
          client: "socket-wait-cleanup",
          namespace,
          serverUrl: currentHarness?.serverUrl ?? "unknown",
          timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
        });
      } else {
        socket.disconnect();
      }

      if (currentHarness && socketId) {
        await currentHarness.waitForSocketDisconnect(
          namespace,
          socketId,
          "socket-wait-cleanup",
          TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
        );
      }
    }

    harness = undefined;
    await currentHarness?.stop();
  });

  it("includes event, timeout, client, socket id, connection state, and URL in timeout errors", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    const socket = createClientSocket(harness.serverUrl);
    sockets.push({ socket, namespace: "/" });
    await waitForSocketConnection(socket, {
      client: "timeout-client",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    });
    sockets[sockets.length - 1].socketId = requireSocketId(socket);

    await expect(
      waitForSocketEvent(socket, {
        client: "timeout-client",
        event: "never-emitted",
        namespace: "/",
        serverUrl: harness.serverUrl,
        timeoutMs: shortTimeoutMs
      })
    ).rejects.toThrow(
      `Timed out after ${shortTimeoutMs}ms waiting for Socket.IO event "never-emitted" ` +
        `(client="timeout-client", namespace="/", socketId="${requireSocketId(socket)}", ` +
        `connected=true, serverUrl="${harness.serverUrl}")`
    );
  });

  it("rejects event waits when the client is not already connected", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    const socket = createSocket(harness.serverUrl, {
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      timeout: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS,
      transports: ["websocket"]
    });
    sockets.push({ socket, namespace: "/" });

    await expect(
      waitForSocketEvent(socket, {
        client: "not-connected-client",
        event: "question-data",
        namespace: "/",
        serverUrl: harness.serverUrl,
        timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
      })
    ).rejects.toThrow(
      `Cannot wait for Socket.IO event "question-data" because client is not connected ` +
        `(client="not-connected-client", namespace="/", socketId="unknown", ` +
        `connected=false, serverUrl="${harness.serverUrl}")`
    );
  });

  it("fails immediately when the socket disconnects before the expected event", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    const socket = createClientSocket(harness.serverUrl);
    sockets.push({ socket, namespace: "/" });
    await waitForSocketConnection(socket, {
      client: "disconnect-client",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    });
    const socketId = requireSocketId(socket);
    sockets[sockets.length - 1].socketId = socketId;

    const eventWait = waitForSocketEvent(socket, {
      client: "disconnect-client",
      event: "question-data",
      namespace: "/",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
    });
    await Promise.resolve();
    socket.disconnect();

    await expect(eventWait).rejects.toThrow(
      `Socket.IO client disconnected while waiting for event "question-data" ` +
        `(client="disconnect-client", namespace="/", socketId="${socketId}", ` +
        `reason="io client disconnect", connected=false, serverUrl="${harness.serverUrl}")`
    );
  });

  it("disconnects one namespace socket without requiring the shared Manager engine to close", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    const rootSocket = createClientSocket(harness.serverUrl, "", false);
    const gameSocket = createClientSocket(harness.serverUrl, SOCKET_GAME_NAMESPACE, false);
    sockets.push(
      { socket: rootSocket, namespace: "/" },
      { socket: gameSocket, namespace: SOCKET_GAME_NAMESPACE }
    );

    await waitForSocketConnection(rootSocket, {
      client: "multiplex-root",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    });
    sockets[0].socketId = requireSocketId(rootSocket);
    await waitForSocketConnection(gameSocket, {
      client: "multiplex-game",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    });
    sockets[1].socketId = requireSocketId(gameSocket);

    await expect(
      disconnectSocket(gameSocket, {
        client: "multiplex-game",
        namespace: SOCKET_GAME_NAMESPACE,
        serverUrl: harness.serverUrl,
        timeoutMs: shortTimeoutMs
      })
    ).resolves.toBeUndefined();
    expect(gameSocket.connected).toBe(false);
    expect(rootSocket.connected).toBe(true);
  });

  it("does not remove unrelated disconnect listeners", async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    const socket = createClientSocket(harness.serverUrl);
    sockets.push({ socket, namespace: "/" });
    await waitForSocketConnection(socket, {
      client: "listener-client",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    });
    sockets[sockets.length - 1].socketId = requireSocketId(socket);

    let unrelatedDisconnects = 0;
    socket.on("disconnect", () => {
      unrelatedDisconnects += 1;
    });

    await disconnectSocket(socket, {
      client: "listener-client",
      serverUrl: harness.serverUrl,
      timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
    });

    expect(unrelatedDisconnects).toBe(1);
  });
});
