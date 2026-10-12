import { type Socket } from "socket.io-client";
import { type Socket as ServerSocket } from "socket.io";
import { createControlledPromise, withTimeout } from "tests/e2e/harness/TestPromiseUtils";

/**
 * Observes the real dispatcher for a silent transport no-op (no response or enqueue).
 * This is a causal boundary, not a replacement for client-visible assertions.
 */
export async function runAndWaitForSocketHandler(
  socket: ServerSocket,
  event: string,
  operation: () => void,
  timeoutMs: number
): Promise<void> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Socket handler timeout must be a positive finite number");
  }
  const handlers = socket.listeners(event);
  if (!socket.connected || handlers.length !== 1) {
    throw new Error(
      `Expected one connected server handler for "${event}" on socket "${socket.id}"`
    );
  }
  const original = handlers[0];
  const completed = createControlledPromise<void>();
  const observed = (...args: unknown[]): void => {
    try {
      void Promise.resolve(original.apply(socket, args)).then(
        () => completed.resolve(),
        (error: unknown) => completed.reject(error)
      );
    } catch (error) {
      completed.reject(error);
    }
  };
  const onDisconnect = (): void =>
    completed.reject(new Error(`Socket "${socket.id}" disconnected during "${event}"`));
  // Own rejection before operation(), which may synchronously fail or disconnect.
  const completion = withTimeout(
    completed.promise,
    timeoutMs,
    `server handler "${event}" on socket "${socket.id}"`
  );
  void completion.catch(() => undefined);
  try {
    socket.off(event, original);
    socket.on(event, observed);
    socket.once("disconnect", onDisconnect);
    operation();
    await completion;
  } finally {
    completed.resolve();
    await Promise.allSettled([completion]);
    socket.off("disconnect", onDisconnect);
    socket.off(event, observed);
    socket.on(event, original);
  }
}

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
  await waitForSocketConnectionInternal(socket, context, false);
}

export async function connectSocket(socket: Socket, context: SocketWaitContext): Promise<void> {
  await waitForSocketConnectionInternal(socket, context, true);
}

async function waitForSocketConnectionInternal(
  socket: Socket,
  context: SocketWaitContext,
  startConnection: boolean
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

    if (startConnection) {
      try {
        socket.connect();
      } catch (error) {
        onConnectError(error instanceof Error ? error : new Error(String(error)));
      }
    }
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

  const socketId = socket.id;

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
            buildSocketContext(socket, context, `reason="${reason}"`, socketId)
        )
      );
    };

    socket.once(context.event, onEvent);
    socket.once("connect_error", onConnectError);
    socket.once("disconnect", onDisconnect);
  });
}

export async function disconnectSocket(socket: Socket, context: SocketWaitContext): Promise<void> {
  if (!socket.connected) {
    socket.disconnect();
    if (socket.connected) {
      throw buildSocketDisconnectStateError(socket, context);
    }
    return;
  }

  const controller = new AbortController();
  const disconnected = waitForSocketDisconnectEvent(socket, context, controller.signal);
  void disconnected.catch(() => undefined);

  try {
    socket.disconnect();
  } catch (error) {
    controller.abort();
    await Promise.allSettled([disconnected]);
    throw new Error(`Socket.IO client disconnect failed ${buildSocketContext(socket, context)}`, {
      cause: error instanceof Error ? error : new Error(String(error))
    });
  }

  try {
    await disconnected;
  } finally {
    controller.abort();
    await Promise.allSettled([disconnected]);
  }

  if (socket.connected) {
    throw buildSocketDisconnectStateError(socket, context);
  }
}

async function waitForSocketDisconnectEvent(
  socket: Socket,
  context: SocketWaitContext,
  signal?: AbortSignal
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const event = "disconnect";

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off(event, onDisconnect);
      signal?.removeEventListener("abort", onAbort);
    };

    const onDisconnect = (): void => {
      cleanup();
      resolve();
    };

    const onAbort = (): void => {
      cleanup();
      reject(new Error(`Socket.IO disconnect wait aborted ${buildSocketContext(socket, context)}`));
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(buildSocketDisconnectTimeoutError(socket, context));
    }, context.timeoutMs);

    if (signal?.aborted) {
      onAbort();
      return;
    }

    socket.once(event, onDisconnect);
    signal?.addEventListener("abort", onAbort, { once: true });
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
  extra?: string,
  socketId?: string
): string {
  const extraPart = extra ? `${extra}, ` : "";
  return (
    `(client="${context.client}", namespace="${context.namespace ?? "unknown"}", ` +
    `socketId="${socketId ?? socket.id ?? "unknown"}", ${extraPart}` +
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
