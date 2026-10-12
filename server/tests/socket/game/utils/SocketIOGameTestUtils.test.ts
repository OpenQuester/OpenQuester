import { describe, expect, it, jest } from "@jest/globals";

import { type SocketGameTestEventUtils } from "tests/socket/game/utils/SocketGameTestEventUtils";
import { type SocketGameTestLobbyUtils } from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import {
  type GameClientSocket,
  SocketGameTestUtils
} from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("SocketGameTestUtils cleanup", () => {
  it("cancels pending event waits before disconnecting owned clients", async () => {
    const order: string[] = [];
    const utils = createUtils({
      cancelPendingEventWaits: async () => {
        order.push("waits");
        return 1;
      },
      cleanupOwnedClients: async () => {
        order.push("clients");
      }
    });

    await utils.cleanupOwnedClients();

    expect(order).toEqual(["waits", "clients"]);
  });

  it("always attempts client cleanup and preserves failures from both stages", async () => {
    const cancelFailure = new Error("wait cancellation failed");
    const clientFailure = new Error("client cleanup failed");
    const cleanupOwnedClients = jest.fn<() => Promise<void>>().mockRejectedValue(clientFailure);
    const utils = createUtils({
      cancelPendingEventWaits: jest.fn<() => Promise<number>>().mockRejectedValue(cancelFailure),
      cleanupOwnedClients
    });

    const failure = await utils.cleanupOwnedClients().catch((error: unknown) => error);

    expect(cleanupOwnedClients).toHaveBeenCalledTimes(1);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([cancelFailure, clientFailure]);
  });

  it("preserves promise rejection semantics when a wait cannot be armed", async () => {
    const failure = new Error("socket is disconnected");
    const utils = createUtils({
      cancelPendingEventWaits: async () => 0,
      cleanupOwnedClients: async () => undefined,
      waitForEvent: () => {
        throw failure;
      }
    });

    const wait = utils.waitForEvent({} as GameClientSocket, "target");

    await expect(wait).rejects.toBe(failure);
  });
});

function createUtils(options: {
  readonly cancelPendingEventWaits: () => Promise<number>;
  readonly cleanupOwnedClients: () => Promise<void>;
  readonly waitForEvent?: () => Promise<unknown>;
}): SocketGameTestUtils {
  const utils = Object.create(SocketGameTestUtils.prototype) as SocketGameTestUtils;
  const internals = utils as unknown as {
    eventUtils: Pick<SocketGameTestEventUtils, "cancelPendingEventWaits" | "waitForEvent">;
    lobbyUtils: Pick<SocketGameTestLobbyUtils, "cleanupOwnedClients">;
  };
  internals.eventUtils = {
    cancelPendingEventWaits: options.cancelPendingEventWaits,
    waitForEvent: options.waitForEvent ?? (async () => undefined)
  } as Pick<SocketGameTestEventUtils, "cancelPendingEventWaits" | "waitForEvent">;
  internals.lobbyUtils = { cleanupOwnedClients: options.cleanupOwnedClients };
  return utils;
}
