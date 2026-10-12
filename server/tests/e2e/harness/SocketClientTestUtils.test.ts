import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { type Socket as ServerSocket } from "socket.io";
import { io as createSocket } from "socket.io-client";

import { connectRootSocket } from "tests/e2e/harness/SocketClientTestUtils";
import { runAndWaitForSocketHandler } from "tests/e2e/harness/SocketTestWait";
import { createControlledPromise } from "tests/e2e/harness/TestPromiseUtils";

jest.mock("socket.io-client", () => ({ io: jest.fn() }));

class FakeClientSocket extends EventEmitter {
  public connected = false;
  public id: string | undefined;
  public connectListenersAtConnect = 0;
  public connectErrorListenersAtConnect = 0;
  public readonly close = jest.fn(() => {
    this.connected = false;
    return this;
  });
  public readonly connect = jest.fn(() => {
    this.connectListenersAtConnect = this.listenerCount("connect");
    this.connectErrorListenersAtConnect = this.listenerCount("connect_error");

    if (this.connectionError) {
      this.emit("connect_error", this.connectionError);
    } else {
      this.connected = true;
      this.id = "root-socket";
      this.emit("connect");
    }

    return this;
  });

  public constructor(private readonly connectionError?: Error) {
    super();
  }
}

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("SocketClientTestUtils", () => {
  it("arms connection listeners before explicitly connecting a root socket", async () => {
    const socket = new FakeClientSocket();
    jest.mocked(createSocket).mockReturnValue(socket as unknown as ReturnType<typeof createSocket>);

    await expect(connectRootSocket("http://127.0.0.1:3000", "root-client")).resolves.toBe(socket);

    expect(createSocket).toHaveBeenCalledWith(
      "http://127.0.0.1:3000",
      expect.objectContaining({ autoConnect: false })
    );
    expect(socket.connectListenersAtConnect).toBe(1);
    expect(socket.connectErrorListenersAtConnect).toBe(1);
    expect(socket.listenerCount("connect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
  });

  it("closes a failed root socket and removes every listener", async () => {
    const connectionError = new Error("connection rejected");
    const socket = new FakeClientSocket(connectionError);
    socket.on("unrelated", () => undefined);
    jest.mocked(createSocket).mockReturnValue(socket as unknown as ReturnType<typeof createSocket>);

    const connection = connectRootSocket("http://127.0.0.1:3000", "failed-root-client");
    await expect(connection).rejects.toThrow("failed-root-client");
    await expect(connection).rejects.toMatchObject({ cause: connectionError });

    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(socket.eventNames()).toEqual([]);
  });
});

describe("Silent server handler completion", () => {
  it("waits for the original async handler and restores its listeners", async () => {
    jest.useFakeTimers();
    const socket = Object.assign(new EventEmitter(), { id: "server", connected: true });
    const processing = createControlledPromise<void>();
    const handler = jest.fn(function (this: EventEmitter, input: unknown) {
      expect(this).toBe(socket);
      expect(input).toEqual({ id: 7 });
      return processing.promise;
    });
    socket.on("command", handler);
    let finished = false;
    const completion = runAndWaitForSocketHandler(
      socket as unknown as ServerSocket,
      "command",
      () => {
        socket.emit("command", { id: 7 });
      },
      500
    ).then(() => {
      finished = true;
    });
    await jest.advanceTimersByTimeAsync(150);
    expect(finished).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
    processing.resolve();
    await completion;
    expect(finished).toBe(true);
    expect(socket.listeners("command")).toEqual([handler]);
    expect(socket.listenerCount("disconnect")).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(["sync handler", "async handler", "emit", "disconnect", "timeout"])(
    "fails on %s without leaking the observer or timer",
    async (failure) => {
      jest.useFakeTimers();
      const socket = Object.assign(new EventEmitter(), { id: "server", connected: true });
      const error = new Error(failure);
      const handler = (): Promise<void> | void => {
        if (failure === "sync handler") throw error;
        if (failure === "async handler") return Promise.reject(error);
      };
      socket.on("command", handler);
      const completion = runAndWaitForSocketHandler(
        socket as unknown as ServerSocket,
        "command",
        () => {
          if (failure === "emit") throw error;
          if (failure === "disconnect") {
            socket.connected = false;
            socket.emit("disconnect");
          } else if (failure !== "timeout") socket.emit("command");
        },
        50
      );
      const outcome = expect(completion).rejects.toThrow(
        failure === "timeout" ? "Timed out after 50ms" : failure
      );
      await jest.advanceTimersByTimeAsync(50);
      await outcome;
      expect(socket.listeners("command")).toEqual([handler]);
      expect(socket.listenerCount("disconnect")).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it("rejects disconnected sockets and ambiguous handlers without sending a command", async () => {
    const socket = Object.assign(new EventEmitter(), { id: "server", connected: false });
    const operation = jest.fn();
    const handler = (): void => undefined;
    socket.on("command", handler);
    await expect(
      runAndWaitForSocketHandler(socket as unknown as ServerSocket, "command", operation, 50)
    ).rejects.toThrow("one connected server handler");
    socket.connected = true;
    socket.on("command", handler);
    await expect(
      runAndWaitForSocketHandler(socket as unknown as ServerSocket, "command", operation, 50)
    ).rejects.toThrow("one connected server handler");
    expect(operation).not.toHaveBeenCalled();
    expect(socket.listeners("command")).toEqual([handler, handler]);
  });
});
