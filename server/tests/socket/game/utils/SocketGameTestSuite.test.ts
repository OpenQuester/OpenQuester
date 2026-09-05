import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { type Socket } from "socket.io-client";

import type { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import type { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { flattenErrorMessages } from "tests/e2e/harness/TestPromiseUtils";

class ObservedSocket extends EventEmitter {
  public connected = true;
  public nsp = "/games";
  private readonly inbound = new Set<(event: string, ...args: unknown[]) => void>();
  public constructor(public readonly id: string) {
    super();
  }
  public onAny(listener: (event: string, ...args: unknown[]) => void): void {
    this.inbound.add(listener);
  }
  public offAny(listener: (event: string, ...args: unknown[]) => void): void {
    this.inbound.delete(listener);
  }
  public receive(event: string): void {
    for (const listener of this.inbound) listener(event);
  }
  public get observerCount(): number {
    return this.inbound.size + this.eventNames().length;
  }
  public asSocket(): Socket {
    return this as unknown as Socket;
  }
}

afterEach(() => {
  jest.useRealTimers();
});

describe("SocketGameTestSuite lifecycle", () => {
  it.each(["event", "derived", "aggregate"])(
    "retains a forgotten %s rejection that settles before the callback returns",
    async (kind) => {
      jest.useFakeTimers();
      const suite = createSuite({ cleanupOwnedClients: async () => undefined });
      const first = new ObservedSocket("first");
      const second = new ObservedSocket("second");
      let callbackReturned = false;
      const error = await captureFailure(() =>
        suite.scenario(async (scenario) => {
          const actors = [scenario.actor(first.asSocket()), scenario.actor(second.asSocket())];
          if (kind === "aggregate") {
            void scenario.assert.broadcast({ actors, event: "missing", timeoutMs: 25 });
            first.receive("missing");
          } else if (kind === "derived") {
            void scenario.trackExpectation(
              scenario.waitForEvent(first.asSocket(), "data", 25).then(() => {
                throw new Error("derived payload rejected");
              }),
              "complete derived assertion"
            );
            first.receive("data");
          } else {
            void scenario.waitForEvent(first.asSocket(), "missing", 25);
          }
          await jest.advanceTimersByTimeAsync(25);
          callbackReturned = true;
        })
      );
      expect(callbackReturned).toBe(true);
      expect(flattenErrorMessages(error).join(" ")).toContain(
        kind === "derived" ? "derived payload rejected" : "missing"
      );
      expect(first.observerCount + second.observerCount).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
      expect(() => suite.currentScenario).toThrow("No active game scenario");
    }
  );

  it("preserves the primary failure and a real journal disposal failure", async () => {
    const detach = jest.fn();
    const suite = createSuite({ cleanupOwnedClients: async () => undefined, detach });
    const socket = new ObservedSocket("disposal-failure");
    const originalOffAny = socket.offAny.bind(socket);
    jest.spyOn(socket, "offAny").mockImplementation((listener) => {
      originalOffAny(listener);
      throw new Error("offAny failed");
    });
    const primary = new Error("scenario failed");
    const error = await captureFailure(() =>
      suite.scenario(async (scenario) => {
        scenario.actor(socket.asSocket());
        throw primary;
      })
    );
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors[0].cause).toBe(primary);
    expect(flattenErrorMessages(error)).toContain("offAny failed");
    expect(detach).toHaveBeenCalledTimes(1);
    expect(socket.observerCount).toBe(0);
  });

  it("fails a scenario when a tracked assertion was not awaited", async () => {
    const detach = jest.fn();
    const suite = createSuite({ cleanupOwnedClients: async () => undefined, detach });

    await expect(
      suite.scenario(async (scenario) => {
        expect(suite.currentScenario).toBe(scenario);
        // Deliberately omit awaiting: scenario.finish must still fail this test body.
        void scenario.trackExpectation(Promise.reject(new Error("missing broadcast")), "broadcast");
      })
    ).rejects.toThrow("missing broadcast");

    expect(detach).toHaveBeenCalledTimes(1);
    expect(() => suite.currentScenario).toThrow("No active game scenario");
    await expect(suite.scenario(async () => "next case")).resolves.toBe("next case");
  });

  it("preserves the primary failure and abort failure and always detaches helpers", async () => {
    const detach = jest.fn();
    const suite = createSuite({ cleanupOwnedClients: async () => undefined, detach });
    const abort = jest
      .spyOn(GameScenario.prototype, "abort")
      .mockRejectedValueOnce(new Error("abort cleanup"));
    try {
      await expect(
        suite.scenario(async () => {
          throw new Error("wrong payload");
        })
      ).rejects.toThrow("wrong payload");
      expect(abort).toHaveBeenCalledTimes(1);
      expect(detach).toHaveBeenCalledTimes(1);
      expect(() => suite.currentScenario).toThrow("No active game scenario");
    } finally {
      abort.mockRestore();
    }
  });

  it("rejects overlapping scenarios without replacing the active one", async () => {
    const suite = createSuite({ cleanupOwnedClients: async () => undefined });
    await suite.scenario(async (active) => {
      await expect(suite.scenario(async () => undefined)).rejects.toThrow("Overlapping");
      expect(suite.currentScenario).toBe(active);
    });
  });

  it("preserves the primary failure when detach fails and releases the active scenario", async () => {
    const suite = createSuite({
      cleanupOwnedClients: async () => undefined,
      detach: () => {
        throw new Error("detach failed");
      }
    });
    await expect(
      suite.scenario(async () => {
        throw new Error("primary failed");
      })
    ).rejects.toThrow(/primary failed.*detach failed/);
    expect(() => suite.currentScenario).toThrow("No active game scenario");
  });

  it("always attempts owned-client cleanup and state reset and aggregates both failures", async () => {
    const clientFailure = new Error("client cleanup failed");
    const resetFailure = new Error("state reset failed");
    const cleanupOwnedClients = jest.fn<() => Promise<void>>().mockRejectedValue(clientFailure);
    const resetState = jest.fn<() => Promise<void>>().mockRejectedValue(resetFailure);
    const suite = createSuite({ cleanupOwnedClients, resetState });

    const error = await captureFailure(() => suite.reset());

    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toContain("Owned client cleanup failed: client cleanup failed");
    expect(error.message).toContain("Harness state reset failed: state reset failed");
    expect(cleanupOwnedClients).toHaveBeenCalledTimes(1);
    expect(resetState).toHaveBeenCalledTimes(1);
  });

  it("attempts remaining-client cleanup and harness stop once even when both fail", async () => {
    const cleanupOwnedClients = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error("remaining client cleanup failed"));
    const stop = jest.fn<() => Promise<void>>().mockRejectedValue(new Error("harness stop failed"));
    const suite = createSuite({ cleanupOwnedClients, stop });

    const firstStop = suite.stop();
    const secondStop = suite.stop();
    const error = await captureFailure(() => firstStop);

    expect(secondStop).toBe(firstStop);
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toContain("remaining client cleanup failed");
    expect(error.message).toContain("harness stop failed");
    expect(cleanupOwnedClients).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

function createSuite(options: {
  readonly cleanupOwnedClients: () => Promise<void>;
  readonly resetState?: () => Promise<void>;
  readonly stop?: () => Promise<void>;
  readonly detach?: () => void;
}): SocketGameTestSuite {
  const suite = Object.create(SocketGameTestSuite.prototype) as SocketGameTestSuite;
  const internals = suite as unknown as {
    harness: Pick<ServerTestHarness, "resetState" | "stop">;
    utils: Pick<SocketGameTestUtils, "cleanupOwnedClients" | "useScenario">;
    _stopPromise: Promise<void> | undefined;
  };
  internals.harness = {
    resetState: options.resetState ?? jest.fn<() => Promise<void>>().mockResolvedValue(),
    stop: options.stop ?? jest.fn<() => Promise<void>>().mockResolvedValue()
  };
  internals.utils = {
    cleanupOwnedClients: options.cleanupOwnedClients,
    useScenario: () => options.detach ?? (() => undefined)
  };
  internals._stopPromise = undefined;
  return suite;
}

async function captureFailure(action: () => Promise<unknown>): Promise<Error> {
  try {
    await action();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  throw new Error("Expected action to fail");
}
