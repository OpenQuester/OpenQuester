import type { Express } from "express";
import { User } from "infrastructure/database/models/User";
import type { DataSource, Repository } from "typeorm";

import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TestUtils } from "tests/utils/TestUtils";
import { GameScenario } from "tests/e2e/scenario/GameScenario";

export class SocketGameTestSuite {
  public readonly app: Express;
  public readonly dataSource: DataSource;
  public readonly userRepo: Repository<User>;
  public readonly serverUrl: string;
  public readonly utils: SocketGameTestUtils;
  public readonly testUtils: TestUtils;
  private _stopPromise: Promise<void> | undefined;
  private activeScenario: GameScenario | undefined;

  public get currentScenario(): GameScenario {
    if (!this.activeScenario) throw new Error("No active game scenario; use suite.scenario()");
    return this.activeScenario;
  }

  /** Own assertions as well as resources, including failures after the callback returns. */
  public async scenario<T>(run: (scenario: GameScenario) => Promise<T>): Promise<T> {
    if (this.activeScenario) throw new Error("Overlapping game scenarios are not supported");
    const scenario = new GameScenario(this.utils);
    this.activeScenario = scenario;
    let detach: (() => void) | undefined;
    let result: T | undefined;
    const failures: Error[] = [];
    try {
      detach = this.utils.useScenario(scenario);
      result = await run(scenario);
    } catch (error) {
      failures.push(toLifecycleError("Game scenario", error));
    }
    try {
      if (failures.length) await scenario.abort();
      else await scenario.finish();
    } catch (error) {
      failures.push(toLifecycleError("Scenario assertions and disposal", error));
    } finally {
      try {
        detach?.();
      } catch (error) {
        failures.push(toLifecycleError("Scenario helper detach", error));
      } finally {
        this.activeScenario = undefined;
      }
    }
    throwIfFailed("Game scenario failed", failures);
    return result as T;
  }

  private constructor(private readonly harness: ServerTestHarness) {
    this.app = harness.app;
    this.dataSource = harness.dataSource;
    this.userRepo = harness.dataSource.getRepository(User);
    this.serverUrl = harness.serverUrl;
    this.utils = new SocketGameTestUtils(this.serverUrl);
    this.testUtils = new TestUtils(this.app, this.userRepo, this.serverUrl, this.utils);
  }

  public static async start(): Promise<SocketGameTestSuite> {
    const harness = await ServerTestHarness.start({ apiPort: 0 });

    try {
      return new SocketGameTestSuite(harness);
    } catch (error) {
      try {
        await harness.stop();
      } catch (cleanupError) {
        throw combineErrors("Socket game test suite startup failed", [
          toLifecycleError("Suite construction", error),
          toLifecycleError("Harness cleanup after construction failure", cleanupError)
        ]);
      }
      throw error;
    }
  }

  public async reset(): Promise<void> {
    const failures: Error[] = [];

    await collectFailure(failures, "Owned client cleanup", async () => {
      await this.utils.cleanupOwnedClients();
    });
    await collectFailure(failures, "Harness state reset", async () => {
      await this.harness.resetState();
    });

    throwIfFailed("Socket game test reset failed", failures);
  }

  public stop(): Promise<void> {
    return (this._stopPromise ??= this.stopInternal());
  }

  private async stopInternal(): Promise<void> {
    const failures: Error[] = [];

    await collectFailure(failures, "Remaining client cleanup", async () => {
      await this.utils.cleanupOwnedClients();
    });
    await collectFailure(failures, "Harness stop", async () => {
      await this.harness.stop();
    });

    throwIfFailed("Socket game test suite stop failed", failures);
  }
}

async function collectFailure(
  failures: Error[],
  label: string,
  action: () => Promise<void>
): Promise<void> {
  try {
    await action();
  } catch (error) {
    failures.push(toLifecycleError(label, error));
  }
}

function toLifecycleError(label: string, error: unknown): Error {
  const cause = error instanceof Error ? error : new Error(String(error));
  return new Error(`${label} failed: ${cause.message}`, { cause });
}

function combineErrors(message: string, failures: Error[]): Error {
  if (failures.length === 1) {
    return failures[0];
  }

  return new AggregateError(
    failures,
    `${message}: ${failures.map((failure) => failure.message).join("; ")}`
  );
}

function throwIfFailed(message: string, failures: Error[]): void {
  if (failures.length > 0) {
    throw combineErrors(message, failures);
  }
}
