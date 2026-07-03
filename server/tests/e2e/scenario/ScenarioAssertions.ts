import {
  type EventDirection,
  type EventExpectation,
  type EventRecord,
  type EventPredicate,
  type NoEventExpectation
} from "tests/e2e/scenario/EventJournal";
import { type ScenarioActor } from "tests/e2e/scenario/ScenarioActor";

export interface ScenarioAssertionsOptions {
  readonly expectEvent: <TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ) => Promise<EventRecord<TArgs>>;
  readonly expectNoEvent: <TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: NoEventExpectation<TArgs>
  ) => Promise<void>;
  readonly eventHistory: () => readonly EventRecord[];
}

export interface EventMatchOptions<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor: ScenarioActor;
  readonly event: string;
  readonly timeoutMs: number;
  readonly afterSequence?: number;
  readonly description?: string;
  readonly predicate?: EventPredicate<TArgs>;
}

export interface NoEventMatchOptions<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor?: ScenarioActor;
  readonly event: string;
  readonly durationMs: number;
  readonly afterSequence?: number;
  readonly description?: string;
  readonly predicate?: EventPredicate<TArgs>;
}

export interface CommandCountOptions {
  readonly actor?: ScenarioActor;
  readonly event: string;
  readonly afterSequence?: number;
  readonly expectedCount: number;
}

/**
 * Small assertion facade over EventJournal.
 *
 * Scenario tests should prefer this class over raw journal predicates once a
 * repeated pattern appears. It keeps the test body readable while still using
 * the journal as the source of truth.
 */
export class ScenarioAssertions {
  public constructor(private readonly options: ScenarioAssertionsOptions) {}

  public inbound<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: EventMatchOptions<TArgs>
  ): Promise<EventRecord<TArgs>> {
    return this.expectDirectedEvent("inbound", options);
  }

  public outbound<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: EventMatchOptions<TArgs>
  ): Promise<EventRecord<TArgs>> {
    return this.expectDirectedEvent("outbound", options);
  }

  public noInbound<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: NoEventMatchOptions<TArgs>
  ): Promise<void> {
    return this.expectNoDirectedEvent("inbound", options);
  }

  public noOutbound<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: NoEventMatchOptions<TArgs>
  ): Promise<void> {
    return this.expectNoDirectedEvent("outbound", options);
  }

  public expectOutboundCommandCount(options: CommandCountOptions): void {
    const records = this.options.eventHistory().filter(
      (record) =>
        record.direction === "outbound" &&
        record.event === options.event &&
        (options.actor ? record.actorLabel === options.actor.label : true) &&
        (options.afterSequence === undefined || record.sequence > options.afterSequence)
    );

    expect(records).toHaveLength(options.expectedCount);
  }

  private expectDirectedEvent<TArgs extends readonly unknown[]>(
    direction: EventDirection,
    options: EventMatchOptions<TArgs>
  ): Promise<EventRecord<TArgs>> {
    return this.options.expectEvent({
      actor: options.actor,
      direction,
      event: options.event,
      timeoutMs: options.timeoutMs,
      afterSequence: options.afterSequence,
      predicate: options.predicate,
      description: options.description
    });
  }

  private expectNoDirectedEvent<TArgs extends readonly unknown[]>(
    direction: EventDirection,
    options: NoEventMatchOptions<TArgs>
  ): Promise<void> {
    return this.options.expectNoEvent({
      actor: options.actor,
      direction,
      event: options.event,
      durationMs: options.durationMs,
      afterSequence: options.afterSequence,
      predicate: options.predicate,
      description: options.description
    });
  }
}
