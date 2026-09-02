import { describe, expect, it, jest } from "@jest/globals";

import type { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import type { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { GameScenario } from "tests/e2e/scenario/GameScenario";

describe("SocketGameTestSuite lifecycle", () => {
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
