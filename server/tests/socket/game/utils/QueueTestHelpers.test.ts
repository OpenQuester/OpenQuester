import { describe, expect, it } from "@jest/globals";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { type GameClientSocket } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { releaseHeldGameLock, finishTestCleanup } from "tests/socket/game/utils/QueueTestHelpers";

describe("Game lock test cleanup helpers", () => {
  it("settles unfinished collector promises when cleanup stops them", async () => {
    const scenario = new GameScenario();
    const socket = {
      id: "collector-test-socket",
      connected: true,
      onAny: () => undefined,
      offAny: () => undefined,
      on: () => undefined,
      off: () => undefined
    } as unknown as GameClientSocket;
    const eventCollector = scenario.collectEvents(
      socket,
      SocketIOGameEvents.QUESTION_ANSWER,
      1,
      TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
    );
    const socketEventCollector = scenario.collectSocketEvents(
      socket,
      [SocketIOGameEvents.QUESTION_ANSWER],
      1,
      TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
    );

    try {
      eventCollector.stop();
      socketEventCollector.stop();
      await expect(eventCollector.promise).rejects.toThrow("Stopped waiting");
      await expect(socketEventCollector.promise).rejects.toThrow("Stopped waiting");
    } finally {
      await scenario.abort();
    }
  });

  it("preserves primary and cleanup failures while finishing cleanup in order", async () => {
    const primaryFailure = new Error("primary failure");
    const collectorFailure = new Error("collector failure");
    const releaseFailure = new Error("release failure");
    const cleanupOrder: string[] = [];
    let thrown: unknown;

    try {
      await finishTestCleanup(
        primaryFailure,
        [
          {
            stop: () => {
              cleanupOrder.push("collector 1");
              throw collectorFailure;
            }
          },
          {
            stop: () => {
              cleanupOrder.push("collector 2");
            }
          }
        ],
        async () => {
          cleanupOrder.push("release");
          throw releaseFailure;
        }
      );
    } catch (error) {
      thrown = error;
    }

    expect(cleanupOrder).toEqual(["collector 1", "collector 2", "release"]);
    expect(thrown).toBeInstanceOf(AggregateError);
    const failures = (thrown as AggregateError).errors;
    expect(failures).toHaveLength(3);
    expect(failures[0]).toBe(primaryFailure);
    expect((failures[1] as Error).cause).toBe(collectorFailure);
    expect((failures[2] as Error).cause).toBe(releaseFailure);
  });

  it("requires confirmed lock ownership before clearing the token", async () => {
    await expect(
      releaseHeldGameLock({ releaseLock: async () => false }, "game-id", "lock-token")
    ).rejects.toThrow("Game lock release lost ownership for game game-id");

    await expect(
      releaseHeldGameLock({ releaseLock: async () => true }, "game-id", "lock-token")
    ).resolves.toBe("");
  });
});
