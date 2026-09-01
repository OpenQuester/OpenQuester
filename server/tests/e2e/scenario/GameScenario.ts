import { EventJournal } from "tests/e2e/scenario/EventJournal";
import { ScenarioActor, type ScenarioActorOptions } from "tests/e2e/scenario/ScenarioActor";
import { ScenarioAssertions } from "tests/e2e/scenario/ScenarioAssertions";
import {
  type AcceptedActionFilter,
  type AcceptedActionProbe
} from "tests/socket/game/utils/SocketGameTestEventUtils";
import { type SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

type ScenarioCompletionMode = "finish" | "abort";

type ExpectationOutcome =
  | { readonly status: "fulfilled" }
  | { readonly status: "rejected"; readonly reason: unknown };

interface TrackedExpectation {
  readonly description: string;
  readonly outcome: Promise<ExpectationOutcome>;
}

/** Lightweight scenario shell for client-perspective realtime tests. */
export class GameScenario {
  private readonly actorLabels = new Set<string>();
  private readonly acceptedActionProbes = new Set<AcceptedActionProbe>();
  private readonly expectations: TrackedExpectation[] = [];
  private readonly journal = new EventJournal();
  private completionMode: ScenarioCompletionMode | undefined;
  private completionPromise: Promise<void> | undefined;
  private disposed = false;
  public readonly assert: ScenarioAssertions;

  public constructor(private readonly utils?: SocketGameTestUtils) {
    this.assert = new ScenarioAssertions({
      utils: this.utils,
      expectEvent: (expectation) => this.journal.expectEvent(expectation),
      expectNoEvent: (expectation) => this.journal.expectNoEvent(expectation),
      eventHistory: () => this.journal.snapshot(),
      trackExpectation: (expectation, description) =>
        this.trackExpectation(expectation, description)
    });
  }

  public addActor(options: Omit<ScenarioActorOptions, "journal">): ScenarioActor {
    this.assertNotDisposed();

    if (this.actorLabels.has(options.label)) {
      throw new Error(`Scenario actor "${options.label}" is already registered`);
    }

    const actor = new ScenarioActor({ ...options, journal: this.journal });
    this.journal.attach(actor);
    this.actorLabels.add(actor.label);

    return actor;
  }

  public mark(): number {
    this.assertNotDisposed();
    return this.journal.mark();
  }

  public createAcceptedActionProbe(filter: AcceptedActionFilter): AcceptedActionProbe {
    this.assertNotDisposed();

    const probe = this.requireUtils().createAcceptedActionProbe(filter);
    this.acceptedActionProbes.add(probe);

    return {
      waitForCount: (expectedCount, timeoutMs) =>
        this.trackExpectation(
          probe.waitForCount(expectedCount, timeoutMs),
          `accepted action count ${expectedCount} for ${JSON.stringify(filter)}`
        ),
      records: () => probe.records(),
      dispose: () => probe.dispose()
    };
  }

  public trackExpectation<T>(expectation: Promise<T>, description: string): Promise<T> {
    this.assertNotDisposed();
    const outcome = expectation.then<ExpectationOutcome, ExpectationOutcome>(
      () => ({ status: "fulfilled" }),
      (reason: unknown) => ({ status: "rejected", reason })
    );

    this.expectations.push({ description, outcome });
    return expectation;
  }

  public finish(): Promise<void> {
    return this.complete("finish");
  }

  public abort(): Promise<void> {
    return this.complete("abort");
  }

  private complete(mode: ScenarioCompletionMode): Promise<void> {
    if (this.completionPromise) {
      if (this.completionMode !== mode) {
        throw new Error(`Game scenario completion already started in ${this.completionMode} mode`);
      }

      return this.completionPromise;
    }

    this.disposed = true;
    this.completionMode = mode;
    this.completionPromise = this.completeInternal(mode);
    return this.completionPromise;
  }

  private async completeInternal(mode: ScenarioCompletionMode): Promise<void> {
    const failures: Error[] = [];
    const expectationOutcomes = this.expectations.map((expectation) => expectation.outcome);

    if (mode === "finish") {
      const outcomes = await Promise.all(expectationOutcomes);
      const seenReasons = new Set<unknown>();

      outcomes.forEach((outcome, index) => {
        if (outcome.status === "fulfilled" || seenReasons.has(outcome.reason)) {
          return;
        }

        seenReasons.add(outcome.reason);
        const cause = toError(outcome.reason);
        failures.push(
          new Error(
            `Scenario expectation ${JSON.stringify(
              this.expectations[index].description
            )} failed: ${cause.message}`,
            { cause }
          )
        );
      });
    }

    for (const probe of this.acceptedActionProbes) {
      try {
        probe.dispose();
      } catch (error) {
        failures.push(toError(error));
      }
    }
    this.acceptedActionProbes.clear();

    try {
      if (mode === "finish") {
        await this.journal.finish();
      } else {
        await this.journal.dispose();
      }
    } catch (error) {
      failures.push(toError(error));
    } finally {
      this.actorLabels.clear();
    }

    if (mode === "abort") {
      await Promise.all(expectationOutcomes);
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `Game scenario ${mode} failed: ${failures.map((failure) => failure.message).join("; ")}`
      );
    }
  }

  private requireUtils(): SocketGameTestUtils {
    if (!this.utils) {
      throw new Error("Socket game test utilities are required for accepted action probes");
    }

    return this.utils;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("Game scenario is disposed");
    }
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
