import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { type Express } from "express";
import { type User } from "infrastructure/database/models/User";
import { io as createSocket } from "socket.io-client";
import { type Repository } from "typeorm";

import { type SocketGameTestEventUtils } from "tests/socket/game/utils/SocketGameTestEventUtils";
import { SocketGameTestLobbyUtils } from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import { SocketGameTestUserUtils } from "tests/socket/game/utils/SocketGameTestUserUtils";

jest.mock("socket.io-client", () => ({ io: jest.fn() }));

class FakeGameClientSocket extends EventEmitter {
  public connected = false;
  public id: string | undefined;
  public connectListenersAtConnect = 0;
  public connectErrorListenersAtConnect = 0;
  public readonly close = jest.fn(() => {
    this.connected = false;
    return this;
  });
  public readonly disconnect = jest.fn(() => {
    this.connected = false;
    return this;
  });
  public readonly connect = jest.fn(() => {
    this.connectListenersAtConnect = this.listenerCount("connect");
    this.connectErrorListenersAtConnect = this.listenerCount("connect_error");
    this.connected = true;
    this.id = "game-socket";
    this.emit("connect");
    return this;
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("SocketGameTestUserUtils connection ownership", () => {
  it("creates authenticated clients disconnected and arms listeners before connect", async () => {
    const socket = new FakeGameClientSocket();
    jest.mocked(createSocket).mockReturnValue(socket as unknown as ReturnType<typeof createSocket>);
    const utils = createUtilsWithoutContainer();
    const user = { id: 7 } as User;
    jest.spyOn(utils, "createAndLoginUser").mockResolvedValue({ user, cookie: "session=new-user" });
    const authenticate = jest.spyOn(utils, "authenticateSocket").mockResolvedValue();

    const result = await utils.createGameClient({} as Express, {} as Repository<User>);

    expect(result.socket).toBe(socket);
    expect(createSocket).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/game",
      expect.objectContaining({ autoConnect: false })
    );
    expect(socket.connectListenersAtConnect).toBe(1);
    expect(socket.connectErrorListenersAtConnect).toBe(1);
    expect(authenticate).toHaveBeenCalledWith(expect.anything(), socket, "session=new-user");
    expect(socket.listenerCount("connect")).toBe(0);
    expect(socket.listenerCount("connect_error")).toBe(0);
    expect(utils.getOwnedSockets()).toEqual([socket]);
  });

  it("closes reconnect clients and removes listeners when authentication fails", async () => {
    const socket = new FakeGameClientSocket();
    socket.on("unrelated", () => undefined);
    jest.mocked(createSocket).mockReturnValue(socket as unknown as ReturnType<typeof createSocket>);
    const utils = createUtilsWithoutContainer();
    jest.spyOn(utils, "loginExistingUser").mockResolvedValue({
      cookie: "session=existing-user"
    });
    jest.spyOn(utils, "authenticateSocket").mockRejectedValue(new Error("authentication failed"));

    await expect(utils.createSocketForExistingUser({} as Express, 9)).rejects.toThrow(
      "authentication failed"
    );

    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(socket.eventNames()).toEqual([]);
    expect(utils.getOwnedSockets()).toEqual([]);
  });

  it("preserves setup cleanup failures and retries the retained client during owned cleanup", async () => {
    const socket = new FakeGameClientSocket();
    socket.close.mockImplementationOnce(() => {
      throw new Error("socket close failed");
    });
    jest.spyOn(socket, "removeAllListeners").mockImplementationOnce(() => {
      throw new Error("listener removal failed");
    });
    jest.mocked(createSocket).mockReturnValue(socket as unknown as ReturnType<typeof createSocket>);
    const utils = createUtilsWithoutContainer();
    jest.spyOn(utils, "loginExistingUser").mockResolvedValue({
      cookie: "session=existing-user"
    });
    jest.spyOn(utils, "authenticateSocket").mockRejectedValue(new Error("authentication failed"));

    const error = await captureFailure(() => utils.createSocketForExistingUser({} as Express, 9));

    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toContain("authentication failed");
    expect(error.message).toContain("socket close failed");
    expect(error.message).toContain("listener removal failed");
    expect(utils.getOwnedSockets()).toEqual([socket]);

    const lobbyUtils = new SocketGameTestLobbyUtils(utils, {} as SocketGameTestEventUtils, {
      getGameIdForSocket: async () => null
    });
    await expect(lobbyUtils.cleanupOwnedClients()).resolves.toBeUndefined();

    expect(socket.close).toHaveBeenCalledTimes(2);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(utils.getOwnedSockets()).toEqual([]);
  });
});

function createUtilsWithoutContainer(): SocketGameTestUserUtils {
  const utils = Object.create(SocketGameTestUserUtils.prototype) as SocketGameTestUserUtils;
  (utils as unknown as { serverUrl: string }).serverUrl = "http://127.0.0.1:3000/game";
  return utils;
}

async function captureFailure(action: () => Promise<unknown>): Promise<Error> {
  try {
    await action();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  throw new Error("Expected action to fail");
}
