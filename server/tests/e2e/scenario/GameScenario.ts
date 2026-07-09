import {
  EventJournal,
  type EventExpectation,
  type EventRecord,
  type NoEventExpectation
} from "tests/e2e/scenario/EventJournal";
import { ScenarioActor, type ScenarioActorOptions } from "tests/e2e/scenario/ScenarioActor";
import { ScenarioAssertions } from "tests/e2e/scenario/ScenarioAssertions";
import { type ScenarioGameDriver } from "tests/e2e/scenario/ScenarioGameDriver";
import {
  type AcceptedActionFilter,
  type AcceptedActionProbe
} from "tests/socket/game/utils/SocketGameTestEventUtils";

/** Lightweight scenario shell for client-perspective realtime tests. */
export class GameScenario {
  private readonly actors = new Map<string, ScenarioActor>();
  private readonly acceptedActionProbes = new Set<AcceptedActionProbe>();
  private disposePromise: Promise<void> | undefined;
  private disposed = false;
  public readonly assert: ScenarioAssertions;

  public constructor(
    private readonly driver?: ScenarioGameDriver,
    private readonly journal: EventJournal = new EventJournal()
  ) {
    this.assert = new ScenarioAssertions({
      driver: this.driver,
      expectEvent: (expectation) => this.expectEvent(expectation),
      expectNoEvent: (expectation) => this.expectNoEvent(expectation),
      eventHistory: () => this.eventHistory()
    });
  }

  public addActor(options: Omit<ScenarioActorOptions, "journal">): ScenarioActor {
    this.assertNotDisposed();

    if (this.actors.has(options.label)) {
      throw new Error(`Scenario actor "${options.label}" is already registered`);
    }

    const actor = new ScenarioActor({ ...options, journal: this.journal });
    this.journal.attach(actor);
    this.actors.set(actor.label, actor);

    return actor;
  }

  public actor(label: string): ScenarioActor {
    const actor = this.actors.get(label);
    if (!actor) {
      throw new Error(`Scenario actor "${label}" was not registered`);
    }

    return actor;
  }

  public mark(): number {
    return this.journal.mark();
  }

  public createAcceptedActionProbe(filter: AcceptedActionFilter): AcceptedActionProbe {
    this.assertNotDisposed();

    const probe = this.requireDriver().createAcceptedActionProbe(filter);
    this.acceptedActionProbes.add(probe);
    return probe;
  }

  public expectEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ): Promise<EventRecord<TArgs>> {
    return this.journal.expectEvent(expectation);
  }

  public expectNoEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: NoEventExpectation<TArgs>
  ): Promise<void> {
    return this.journal.expectNoEvent(expectation);
  }

  public eventHistory(): readonly EventRecord[] {
    return this.journal.snapshot();
  }

  public dispose(): Promise<void> {
    if (!this.disposePromise) {
      this.disposed = true;
      this.disposePromise = this.disposeInternal();
    }

    return this.disposePromise;
  }

  private async disposeInternal(): Promise<void> {
    const failures: Error[] = [];

    for (const probe of this.acceptedActionProbes) {
      try {
        probe.dispose();
      } catch (error) {
        failures.push(toError(error));
      }
    }
    this.acceptedActionProbes.clear();

    try {
      await this.journal.dispose();
    } catch (error) {
      failures.push(toError(error));
    } finally {
      this.actors.clear();
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `Game scenario disposal failed: ${failures.map((failure) => failure.message).join("; ")}`
      );
    }
  }

  private requireDriver(): ScenarioGameDriver {
    if (!this.driver) {
      throw new Error("Scenario driver is required for accepted action probes");
    }

    return this.driver;
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
