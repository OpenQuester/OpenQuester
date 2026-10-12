import { type GameActionLockService } from "application/services/lock/GameActionLockService";
import { type ScenarioEventCollector } from "tests/e2e/scenario/GameScenario";

export const QUEUE_BURST_SIZE = 20;
export const QUEUE_DRAIN_BUDGET_MS = 500;
export const NO_TEST_FAILURE = Symbol("NO_TEST_FAILURE");
export type EventCollector<T> = ScenarioEventCollector<T>;
type EventCollectorCleanup = Pick<EventCollector<unknown>, "stop">;
export interface CollectedSocketEvent<T> {
  event: string;
  data: T;
}

export async function releaseHeldGameLock(
  lockService: Pick<GameActionLockService, "releaseLock">,
  gameId: string,
  lockToken: string
): Promise<string> {
  if (!lockToken) {
    return "";
  }

  const released = await lockService.releaseLock(gameId, lockToken);
  if (!released) {
    throw new Error(`Game lock release lost ownership for game ${gameId}`);
  }

  return "";
}

export async function finishTestCleanup(
  primaryFailure: unknown,
  collectors: ReadonlyArray<EventCollectorCleanup | undefined>,
  releaseLock?: () => Promise<void>
): Promise<void> {
  const failures: unknown[] = primaryFailure === NO_TEST_FAILURE ? [] : [primaryFailure];

  for (const [index, collector] of collectors.entries()) {
    if (!collector) {
      continue;
    }

    try {
      collector.stop();
    } catch (error) {
      failures.push(new Error(`Event collector ${index + 1} cleanup failed`, { cause: error }));
    }
  }

  if (releaseLock) {
    try {
      await releaseLock();
    } catch (error) {
      failures.push(new Error("Held game lock cleanup failed", { cause: error }));
    }
  }

  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, "Test cleanup completed with failures");
  }
}
