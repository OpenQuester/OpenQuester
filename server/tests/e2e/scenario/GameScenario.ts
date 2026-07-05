import {
  EventJournal,
  type EventExpectation,
  type EventRecord,
  type NoEventExpectation
} from "tests/e2e/scenario/EventJournal";
import { ScenarioActor, type ScenarioActorOptions } from "tests/e2e/scenario/ScenarioActor";
import { ScenarioAssertions } from "tests/e2e/scenario/ScenarioAssertions";
import { type ScenarioGameDriver } from "tests/e2e/scenario/ScenarioGameDriver";

/**
 * Lightweight scenario shell for client-perspective realtime tests.
 *
 * This is deliberately small for Phase 2: it centralizes actors and the event
 * journal without forcing existing game tests to migrate all at once.
 */
export class GameScenario {
  private readonly actors = new Map<string, ScenarioActor>();
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
    const actor = new ScenarioActor({ ...options, journal: this.journal });
    this.actors.set(actor.label, actor);
    this.journal.attach(actor);

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

  public dispose(): void {
    this.journal.detachAll();
    this.actors.clear();
  }
}
