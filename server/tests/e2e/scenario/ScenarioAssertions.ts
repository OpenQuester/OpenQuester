import { expect } from "@jest/globals";

import { type GameActionType } from "domain/enums/GameActionType";
import { type QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  type EventDirection,
  type EventExpectation,
  type EventRecord,
  type EventPredicate,
  type NoEventExpectation
} from "tests/e2e/scenario/EventJournal";
import { type ScenarioActor } from "tests/e2e/scenario/ScenarioActor";
import { type ScenarioGameDriver } from "tests/e2e/scenario/ScenarioGameDriver";

export interface ScenarioAssertionsOptions {
  readonly driver?: ScenarioGameDriver;
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

export interface DirectedEventCountOptions<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor?: ScenarioActor;
  readonly direction: EventDirection;
  readonly event: string;
  readonly afterSequence?: number;
  readonly expectedCount: number;
  readonly predicate?: EventPredicate<TArgs>;
}

export interface BroadcastOptions<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actors: readonly ScenarioActor[];
  readonly event: string;
  readonly timeoutMs: number;
  readonly afterSequence?: number;
  readonly description?: string;
  readonly predicate?: EventPredicate<TArgs>;
}

export interface SubmittedActionsOptions {
  readonly gameId: string;
  readonly expectedCount: number;
  readonly actionType?: GameActionType;
  readonly timeoutMs?: number;
}

export interface ActionsCompleteOptions {
  readonly gameId: string;
  readonly timeoutMs?: number;
}

export interface QuestionStateOptions {
  readonly gameId: string;
  readonly expectedState: QuestionState;
}

/**
 * Small assertion facade over EventJournal and the optional scenario driver.
 *
 * Scenario tests should prefer this class over raw journal predicates once a
 * repeated pattern appears. It keeps the test body readable while still using
 * the journal/driver as the source of truth.
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

  public broadcast<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: BroadcastOptions<TArgs>
  ): Promise<readonly EventRecord<TArgs>[]> {
    return Promise.all(
      options.actors.map((actor) =>
        this.inbound({
          actor,
          event: options.event,
          timeoutMs: options.timeoutMs,
          afterSequence: options.afterSequence,
          predicate: options.predicate,
          description: options.description
        })
      )
    );
  }

  public expectOutboundCommandCount(options: CommandCountOptions): void {
    this.expectDirectedEventCount({
      actor: options.actor,
      direction: "outbound",
      event: options.event,
      afterSequence: options.afterSequence,
      expectedCount: options.expectedCount
    });
  }

  public expectDirectedEventCount<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: DirectedEventCountOptions<TArgs>
  ): void {
    const records = this.options.eventHistory().filter(
      (record) =>
        record.direction === options.direction &&
        record.event === options.event &&
        (options.actor ? record.actorLabel === options.actor.label : true) &&
        (options.afterSequence === undefined || record.sequence > options.afterSequence) &&
        (options.predicate ? options.predicate(record as EventRecord<TArgs>) : true)
    );

    expect(records).toHaveLength(options.expectedCount);
  }

  public waitForSubmittedActions(options: SubmittedActionsOptions): Promise<void> {
    return this.requireDriver().waitForSubmittedActions(options);
  }

  public waitForActionsComplete(options: ActionsCompleteOptions): Promise<void> {
    return this.requireDriver().waitForActionsComplete(options);
  }

  public async questionState(options: QuestionStateOptions): Promise<void> {
    const state = await this.requireDriver().getGameState(options.gameId);

    expect(state?.questionState).toBe(options.expectedState);
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

  private requireDriver(): ScenarioGameDriver {
    if (!this.options.driver) {
      throw new Error("Scenario driver is required for action/state assertions");
    }

    return this.options.driver;
  }
}
