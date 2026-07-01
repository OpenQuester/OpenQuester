import { EventJournal, type EventExpectation, type EventRecord, type NoEventExpectation } from "tests/e2e/scenario/EventJournal";
import { ScenarioActor, type ScenarioActorOptions } from "tests/e2e/scenario/ScenarioActor";

/**
 * Lightweight scenario shell for client-perspective realtime tests.
 *
 * This is deliberately small for Phase 2: it centralizes actors and the event
 * journal without forcing existing game tests to migrate all at once.
 */
export class GameScenario {
  private readonly actors = new Map<string, ScenarioActor>();

  public constructor(private readonly journal: EventJournal = new EventJournal()) {}

  public addActor(options: ScenarioActorOptions): ScenarioActor {
    const actor = new ScenarioActor(options);
    this.actors.set(actor.label, actor);
    this.journal.attach({
      label: actor.label,
      socket: actor.socket,
      namespace: actor.namespace,
      userId: actor.userId,
      gameId: actor.gameId
    });

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
