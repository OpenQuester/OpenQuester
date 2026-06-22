import { type Socket } from "socket.io-client";

interface SocketWaitContext {
  client: string;
  serverUrl: string;
  timeoutMs: number;
  namespace?: string;
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
            buildSocketContext(socket, context, `timeoutMs=${context.timeoutMs}`),
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
  if (!socket.connected) {
    throw new Error(
      `Cannot wait for Socket.IO event "${context.event}" because client is not connected ` +
        buildSocketContext(socket, context)
    );
  }

  return new Promise<unknown[]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(buildSocketTimeoutError("Socket.IO event", { ...context, socket }));
    }, context.timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off(context.event, onEvent);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
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
            buildSocketContext(socket, context),
          { cause: error }
        )
      );
    };

    const onDisconnect = (reason: string): void => {
      cleanup();
      reject(
        new Error(
          `Socket.IO client disconnected while waiting for event "${context.event}" ` +
            buildSocketContext(socket, context, `reason="${reason}"`)
        )
      );
    };

    socket.once(context.event, onEvent);
    socket.once("connect_error", onConnectError);
    socket.once("disconnect", onDisconnect);
  });
}

export async function disconnectSocket(
  socket: Socket,
  context: SocketWaitContext
): Promise<void> {
  if (!socket.connected) {
    socket.disconnect();
    if (socket.connected) {
      throw buildSocketDisconnectStateError(socket, context);
    }
    return;
  }

  const disconnected = waitForSocketDisconnectEvent(socket, context);
  socket.disconnect();
  await disconnected;

  if (socket.connected) {
    throw buildSocketDisconnectStateError(socket, context);
  }
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
      reject(buildSocketDisconnectTimeoutError(socket, context));
    }, context.timeoutMs);

    socket.once(event, onDisconnect);
  });
}

function buildSocketTimeoutError(
  operation: string,
  context: SocketEventWaitContext & { socket: Socket }
): Error {
  return new Error(
    `Timed out after ${context.timeoutMs}ms waiting for ${operation} "${context.event}" ` +
      buildSocketContext(context.socket, context)
  );
}

function buildSocketContext(
  socket: Socket,
  context: SocketWaitContext,
  extra?: string
): string {
  const extraPart = extra ? `${extra}, ` : "";
  return (
    `(client="${context.client}", namespace="${context.namespace ?? "unknown"}", ` +
    `socketId="${socket.id ?? "unknown"}", ${extraPart}` +
    `connected=${socket.connected}, serverUrl="${context.serverUrl}")`
  );
}

function buildSocketDisconnectStateError(socket: Socket, context: SocketWaitContext): Error {
  return new Error(
    `Socket.IO client remained connected after disconnect ` +
      `(client="${context.client}", namespace="${context.namespace ?? "unknown"}", ` +
      `socketId="${socket.id ?? "unknown"}", connected=${socket.connected}, ` +
      `serverUrl="${context.serverUrl}", timeoutMs=${context.timeoutMs})`
  );
}

function buildSocketDisconnectTimeoutError(socket: Socket, context: SocketWaitContext): Error {
  return new Error(
    `Timed out after ${context.timeoutMs}ms waiting for Socket.IO socket disconnect ` +
      `(client="${context.client}", namespace="${context.namespace ?? "unknown"}", ` +
      `socketId="${socket.id ?? "unknown"}", connected=${socket.connected}, ` +
      `serverUrl="${context.serverUrl}")`
  );
}
