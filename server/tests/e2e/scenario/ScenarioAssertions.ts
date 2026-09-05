import { expect } from "@jest/globals";

import { type QuestionState } from "domain/types/dto/game/state/QuestionState";
import { withTimeout } from "tests/e2e/harness/TestPromiseUtils";
import {
  copyEventRecord,
  type EventDirection,
  type EventExpectation,
  type EventRecord,
  type EventPredicate,
  type NoEventExpectation
} from "tests/e2e/scenario/EventJournal";
import { type ScenarioActor } from "tests/e2e/scenario/ScenarioActor";
import { type SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

interface ScenarioAssertionsOptions {
  readonly utils?: SocketGameTestUtils;
  readonly validateActor: (actor: ScenarioActor) => void;
  readonly expectEvent: <TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ) => Promise<EventRecord<TArgs>>;
  readonly expectNoEvent: <TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: NoEventExpectation<TArgs>
  ) => Promise<void>;
  readonly eventHistory: () => readonly EventRecord[];
  readonly trackExpectation: <T>(expectation: Promise<T>, description: string) => Promise<T>;
}

interface EventMatchOptions<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor: ScenarioActor;
  readonly event: string;
  readonly timeoutMs: number;
  readonly afterSequence?: number;
  readonly description?: string;
  readonly predicate?: EventPredicate<TArgs>;
}

interface NoEventMatchOptions<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor: ScenarioActor;
  readonly event: string;
  readonly durationMs: number;
  readonly afterSequence?: number;
  readonly description?: string;
  readonly predicate?: EventPredicate<TArgs>;
}

interface NoEventManyMatchOptions<
  TArgs extends readonly unknown[] = readonly unknown[]
> extends Omit<NoEventMatchOptions<TArgs>, "actor"> {
  readonly actors: readonly ScenarioActor[];
}

interface EventRecordQueryOptions<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor?: ScenarioActor;
  readonly direction?: EventDirection;
  readonly event?: string;
  readonly afterSequence?: number;
  readonly predicate?: EventPredicate<TArgs>;
}

interface BroadcastOptions<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actors: readonly ScenarioActor[];
  readonly event: string;
  readonly timeoutMs: number;
  readonly afterSequence?: number;
  readonly description?: string;
  readonly predicate?: EventPredicate<TArgs>;
}

interface CommandCountOptions {
  readonly actor?: ScenarioActor;
  readonly event: string;
  readonly afterSequence?: number;
  readonly expectedCount: number;
}

interface ActionsCompleteOptions {
  readonly gameId: string;
  readonly timeoutMs?: number;
}

interface QuestionStateOptions {
  readonly gameId: string;
  readonly expectedState: QuestionState;
}

interface PlayerMediaDownloadedOptions {
  readonly gameId: string;
  readonly actor: ScenarioActor;
  readonly expected: boolean;
}

interface ActiveTimerDurationOptions {
  readonly gameId: string;
  readonly expectedDurationMs: number;
}

interface GameStateOptions {
  readonly gameId: string;
}

interface DirectedEventCountOptions<
  TArgs extends readonly unknown[] = readonly unknown[]
> extends EventRecordQueryOptions<TArgs> {
  readonly direction: EventDirection;
  readonly event: string;
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
    return this.track(
      this.expectDirectedEvent("inbound", options),
      options.description ?? `inbound "${options.event}" for actor "${options.actor.label}"`
    );
  }

  public noInbound<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: NoEventMatchOptions<TArgs>
  ): Promise<void> {
    return this.track(
      this.expectNoDirectedEvent("inbound", options),
      options.description ?? `no inbound "${options.event}"`
    );
  }

  public broadcast<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: BroadcastOptions<TArgs>
  ): Promise<readonly EventRecord<TArgs>[]> {
    this.requireRecipients(options.actors);
    const expectation = Promise.all(
      options.actors.map((actor) =>
        this.expectDirectedEvent("inbound", {
          actor,
          event: options.event,
          timeoutMs: options.timeoutMs,
          afterSequence: options.afterSequence,
          description: options.description,
          predicate: options.predicate
        })
      )
    );

    return this.track(
      expectation,
      options.description ??
        `inbound broadcast "${options.event}" for actors ${options.actors
          .map((actor) => `"${actor.label}"`)
          .join(", ")}`
    );
  }

  public noInboundMany<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: NoEventManyMatchOptions<TArgs>
  ): Promise<void> {
    this.requireRecipients(options.actors);
    return this.track(
      Promise.all(
        options.actors.map((actor) => this.expectNoDirectedEvent("inbound", { ...options, actor }))
      ).then(() => undefined),
      options.description ??
        `no inbound "${options.event}" for actors ${options.actors.map(({ label }) => label).join(", ")}`
    );
  }

  private requireRecipients(actors: readonly ScenarioActor[]): void {
    if (actors.length === 0 || new Set(actors.map(({ label }) => label)).size !== actors.length) {
      throw new Error("Event assertions require a non-empty list of unique actors");
    }
    actors.forEach(this.options.validateActor);
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
    const records = this.records(options);

    if (records.length !== options.expectedCount) {
      throw new Error(
        `Expected exactly ${options.expectedCount} ${options.direction} "${options.event}" records, ` +
          `received ${records.length}; matching=${JSON.stringify(records.map(toEventDiagnostic))}; ` +
          `recent=${JSON.stringify(this.options.eventHistory().slice(-10).map(toEventDiagnostic))}`
      );
    }
  }

  /**
   * Returns a synchronous, defensive journal snapshot. Use it only after the
   * expected actions and queue drain have established quiescence.
   */
  public records<TArgs extends readonly unknown[] = readonly unknown[]>(
    options: EventRecordQueryOptions<TArgs> = {}
  ): readonly EventRecord<TArgs>[] {
    return this.options
      .eventHistory()
      .filter(
        (record) =>
          (options.direction === undefined || record.direction === options.direction) &&
          (options.event === undefined || record.event === options.event) &&
          (options.actor === undefined || record.actorLabel === options.actor.label) &&
          (options.afterSequence === undefined || record.sequence > options.afterSequence) &&
          (options.predicate === undefined || options.predicate(record as EventRecord<TArgs>))
      )
      .sort((left, right) => left.sequence - right.sequence)
      .map((record) => copyEventRecord(record as EventRecord<TArgs>));
  }

  public waitForActionsComplete(options: ActionsCompleteOptions): Promise<void> {
    return this.track(
      this.requireUtils().waitForActionsComplete(options.gameId, options.timeoutMs),
      `actions complete for game "${options.gameId}"`
    );
  }

  public questionState(options: QuestionStateOptions): Promise<void> {
    const description = `question state ${options.expectedState} for game "${options.gameId}"`;
    return this.trackBoundedStateAssertion(
      (async () => {
        const state = await this.requireUtils().getGameState(options.gameId);

        expect(state?.questionState).toBe(options.expectedState);
      })(),
      description
    );
  }

  public playerMediaDownloaded(options: PlayerMediaDownloadedOptions): Promise<void> {
    const description = `media readiness ${options.expected} for actor "${options.actor.label}"`;
    return this.trackBoundedStateAssertion(
      (async () => {
        if (options.actor.userId === undefined) {
          throw new Error(`Actor ${options.actor.label} does not have a userId`);
        }

        const game = await this.requireUtils().getGameFromGameService(options.gameId);
        const player = game.getPlayer(options.actor.userId, { fetchDisconnected: true });

        if (!player) {
          throw new Error(`Player ${options.actor.userId} not found in game ${options.gameId}`);
        }

        expect(Boolean(player.mediaDownloaded)).toBe(options.expected);
      })(),
      description
    );
  }

  public activeTimerDuration(options: ActiveTimerDurationOptions): Promise<void> {
    const description = `active timer ${options.expectedDurationMs}ms for game "${options.gameId}"`;
    return this.trackBoundedStateAssertion(
      (async () => {
        const state = await this.requireUtils().getGameState(options.gameId);

        expect(state?.timer).not.toBeNull();
        expect(state?.timer?.durationMs).toBe(options.expectedDurationMs);
      })(),
      description
    );
  }

  public noActiveTimer(options: GameStateOptions): Promise<void> {
    const description = `no active timer for game "${options.gameId}"`;
    return this.trackBoundedStateAssertion(
      (async () => {
        const state = await this.requireUtils().getGameState(options.gameId);

        expect(state?.timer).toBeNull();
      })(),
      description
    );
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

  private requireUtils(): SocketGameTestUtils {
    if (!this.options.utils) {
      throw new Error("Socket game test utilities are required for state assertions");
    }

    return this.options.utils;
  }

  private track<T>(expectation: Promise<T>, description: string): Promise<T> {
    return this.options.trackExpectation(expectation, description);
  }

  private trackBoundedStateAssertion(assertion: Promise<void>, description: string): Promise<void> {
    return this.track(
      withTimeout(assertion, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS, description),
      description
    );
  }
}

function toEventDiagnostic(record: EventRecord): Record<string, unknown> {
  return {
    sequence: record.sequence,
    direction: record.direction,
    event: record.event,
    actorLabel: record.actorLabel,
    args: record.args
  };
}
