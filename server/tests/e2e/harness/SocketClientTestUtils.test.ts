import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { io as createSocket } from "socket.io-client";

import { connectRootSocket } from "tests/e2e/harness/SocketClientTestUtils";

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
