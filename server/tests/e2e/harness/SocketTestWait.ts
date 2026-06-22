import { type Socket } from "socket.io-client";

interface SocketWaitContext {
  client: string;
  serverUrl: string;
  timeoutMs: number;
}

interface SocketEventWaitContext extends SocketWaitContext {
  event: string;
}

export async function waitForSocketConnection(
  socket: Socket,
  context: SocketWaitContext
): Promise<void> {
  if (socket.connected) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        buildSocketTimeoutError("Socket.IO connection", {
          ...context,
          event: "connect",
          socket
        })
      );
    }, context.timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };

    const onConnect = (): void => {
      cleanup();
      resolve();
    };

    const onConnectError = (error: Error): void => {
      cleanup();
      reject(
        new Error(
          `Socket.IO connection failed for client="${context.client}" ` +
            `(socketId="${socket.id ?? "unknown"}", serverUrl="${context.serverUrl}")`,
          { cause: error }
        )
      );
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
  });
}

export async function waitForSocketEvent(
  socket: Socket,
  context: SocketEventWaitContext
): Promise<unknown[]> {
  await waitForSocketConnection(socket, context);

  return new Promise<unknown[]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(buildSocketTimeoutError("Socket.IO event", { ...context, socket }));
    }, context.timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off(context.event, onEvent);
      socket.off("connect_error", onConnectError);
    };

    const onEvent = (...args: unknown[]): void => {
      cleanup();
      resolve(args);
    };

    const onConnectError = (error: Error): void => {
      cleanup();
      reject(
        new Error(
          `Socket.IO connect_error while waiting for event "${context.event}" ` +
            `(client="${context.client}", socketId="${socket.id ?? "unknown"}", ` +
            `serverUrl="${context.serverUrl}")`,
          { cause: error }
        )
      );
    };

    socket.once(context.event, onEvent);
    socket.once("connect_error", onConnectError);
  });
}

export async function disconnectSocket(
  socket: Socket,
  context: SocketWaitContext
): Promise<void> {
  if (!socket.connected) {
    socket.disconnect();
    return;
  }

  const disconnected = waitForSocketDisconnectEvent(socket, context);
  const engineClosed = waitForEngineClose(socket, context);

  socket.disconnect();
  await Promise.all([disconnected, engineClosed]);
}

async function waitForSocketDisconnectEvent(
  socket: Socket,
  context: SocketWaitContext
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const event = "disconnect";

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off(event, onDisconnect);
    };

    const onDisconnect = (): void => {
      cleanup();
      resolve();
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(buildSocketTimeoutError("Socket.IO event", { ...context, event, socket }));
    }, context.timeoutMs);

    socket.once(event, onDisconnect);
  });
}

async function waitForEngineClose(socket: Socket, context: SocketWaitContext): Promise<void> {
  if (socket.io.engine.readyState === "closed") {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const event = "engine close";

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.io.engine.off("close", onClose);
    };

    const onClose = (): void => {
      cleanup();
      resolve();
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(buildSocketTimeoutError("Socket.IO event", { ...context, event, socket }));
    }, context.timeoutMs);

    socket.io.engine.once("close", onClose);
  });
}

function buildSocketTimeoutError(
  operation: string,
  context: SocketEventWaitContext & { socket: Socket }
): Error {
  return new Error(
    `Timed out after ${context.timeoutMs}ms waiting for ${operation} "${context.event}" ` +
      `(client="${context.client}", socketId="${context.socket.id ?? "unknown"}", ` +
      `connected=${context.socket.connected}, serverUrl="${context.serverUrl}")`
  );
}
