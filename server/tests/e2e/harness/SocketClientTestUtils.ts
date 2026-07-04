import { io as createSocket, type Socket as ClientSocket } from "socket.io-client";

import { waitForSocketConnection } from "tests/e2e/harness/SocketTestWait";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

export function createClientSocket(
  serverUrl: string,
  namespace: string = ""
): ClientSocket {
  return createSocket(`${serverUrl}${namespace}`, {
    forceNew: true,
    reconnection: false,
    timeout: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS,
    transports: ["websocket"]
  });
}

export async function connectRootSocket(
  serverUrl: string,
  client: string
): Promise<ClientSocket> {
  const socket = createClientSocket(serverUrl);

  await waitForSocketConnection(socket, {
    client,
    serverUrl,
    timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
  });

  return socket;
}

export function requireSocketId(socket: ClientSocket): string {
  if (!socket.id) {
    throw new Error("Expected connected Socket.IO client to have an id");
  }

  return socket.id;
}

export async function expectSocketDoesNotConnect(
  socket: ClientSocket,
  client: string,
  serverUrl: string
): Promise<void> {
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
}

export async function waitForSocketConnectError(
  socket: ClientSocket,
  client: string,
  serverUrl: string
): Promise<Error> {
  return new Promise<Error>((resolve, reject) => {
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
}
