import { describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";

import { SOCKET_GAME_NAMESPACE, SOCKET_ROOT_NAMESPACE } from "domain/constants/socket";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

describe("ServerTestHarness per-test reset", () => {
  it("clears Redis only after every Socket.IO client is gone", async () => {
    const { harness, clearRedis } = createHarness([]);

    await expect(harness.resetState()).resolves.toBeUndefined();

    expect(clearRedis).toHaveBeenCalledTimes(1);
  });

  it("fails before reset when a client leaked from the previous test", async () => {
    jest.useFakeTimers();
    const { harness, clearRedis } = createHarness([
      {
        namespace: SOCKET_GAME_NAMESPACE,
        id: "socket-7",
        userId: 42,
        gameId: "game-9"
      }
    ]);

    const reset = harness.resetState();
    const failure = reset.catch((error: unknown) => error);

    try {
      await jest.advanceTimersByTimeAsync(TEST_TIMEOUTS.RESOURCE_CLEANUP_TIMEOUT_MS);
      const error = await failure;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("resetting test state");
      expect((error as Error).message).toContain("socket-7");
      expect((error as Error).message).toContain("game-9");
      expect(clearRedis).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("allows a client-side close already propagating to the server to settle before reset", async () => {
    const { harness, clearRedis, disconnect } = createHarness([
      {
        namespace: SOCKET_GAME_NAMESPACE,
        id: "socket-7",
        userId: 42,
        gameId: "game-9"
      }
    ]);

    queueMicrotask(() => disconnect(SOCKET_GAME_NAMESPACE, "socket-7"));

    await expect(harness.resetState()).resolves.toBeUndefined();
    expect(clearRedis).toHaveBeenCalledTimes(1);
  });
});

interface FakeSocket {
  readonly namespace: string;
  readonly id: string;
  readonly userId?: number;
  readonly gameId?: string;
}

function createHarness(sockets: readonly FakeSocket[]): {
  readonly harness: ServerTestHarness;
  readonly clearRedis: jest.Mock<() => Promise<void>>;
  readonly disconnect: (namespace: string, socketId: string) => void;
} {
  const clearRedis = jest.fn<() => Promise<void>>().mockResolvedValue();
  const namespaces = new Map(
    [SOCKET_ROOT_NAMESPACE, SOCKET_GAME_NAMESPACE].map((namespace) => [
      namespace,
      {
        name: namespace,
        sockets: new Map<string, EventEmitter & FakeSocket>()
      }
    ])
  );
  for (const socket of sockets) {
    namespaces
      .get(socket.namespace)
      ?.sockets.set(socket.id, Object.assign(new EventEmitter(), socket));
  }
  const harness = Object.create(ServerTestHarness.prototype) as ServerTestHarness;
  const internals = harness as unknown as {
    testEnvironment: { clearRedis: () => Promise<void> };
    testApp: {
      io: { of: (namespace: string) => unknown };
      serverUrl: string;
    };
  };
  internals.testEnvironment = { clearRedis };
  internals.testApp = {
    io: {
      of: (namespace: string) => namespaces.get(namespace)
    },
    serverUrl: "http://harness.test"
  };

  return {
    harness,
    clearRedis,
    disconnect: (namespace, socketId) => {
      const namespaceSockets = namespaces.get(namespace)?.sockets;
      const socket = namespaceSockets?.get(socketId);
      namespaceSockets?.delete(socketId);
      socket?.emit("disconnect", "client namespace disconnect");
    }
  };
}
