import { type Socket } from "socket.io-client";

import { withTimeout } from "tests/e2e/harness/TestPromiseUtils";
import { EventJournal, EventJournalAbortedError } from "tests/e2e/scenario/EventJournal";
import { ScenarioActor, type ScenarioActorOptions } from "tests/e2e/scenario/ScenarioActor";
import { ScenarioAssertions } from "tests/e2e/scenario/ScenarioAssertions";
import {
  type AcceptedActionFilter,
  type AcceptedActionProbe
} from "tests/socket/game/utils/SocketGameTestEventUtils";
import { type SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

type ScenarioCompletionMode = "finish" | "abort";

type ExpectationOutcome =
  | { readonly status: "fulfilled" }
  | { readonly status: "rejected"; readonly reason: unknown };

interface TrackedExpectation {
  readonly description: string;
  readonly outcome: Promise<ExpectationOutcome>;
}

interface ActorConnection {
  readonly actor: ScenarioActor;
  readonly baseLabel: string;
  readonly generation: number;
  socketId: string | undefined;
}

export interface ScenarioEventCollector<T> {
  readonly promise: Promise<T[]>;
  readonly stop: () => void;
  readonly count: () => number;
}

/** Lightweight scenario shell for client-perspective realtime tests. */
export class GameScenario {
  private readonly actorLabels = new Set<string>();
  private readonly actors = new Map<Socket, ActorConnection>();
  private readonly acceptedActionProbes = new Set<AcceptedActionProbe>();
  private readonly expectations: TrackedExpectation[] = [];
  private readonly completionAssertions: (() => void)[] = [];
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
    if (this.actors.has(options.socket)) {
      throw new Error("Scenario socket is already registered; use scenario.actor(socket)");
    }

    const actor = new ScenarioActor({ ...options, journal: this.journal });
    this.journal.attach(actor);
    this.actorLabels.add(actor.label);
    this.actors.set(actor.socket, {
      actor,
      baseLabel: actor.label,
      generation: 1,
      socketId: actor.socket.id
    });

    return actor;
  }

  /** One identity per socket connection; a reconnect never reuses an earlier actor's history. */
  public actor(socket: Socket, label?: string): ScenarioActor {
    this.assertNotDisposed();
    const previous = this.actors.get(socket);
    if (previous) {
      if (previous.socketId === undefined) previous.socketId = socket.id;
      if (socket.id === undefined || previous.socketId === socket.id) return previous.actor;

      this.journal.detach(previous.actor);
      this.actors.delete(socket);
      const generation = previous.generation + 1;
      const actor = this.addActor({
        label: `${previous.baseLabel}#${generation}`,
        socket,
        namespace: (socket as unknown as { nsp?: string }).nsp,
        userId: previous.actor.userId,
        gameId: previous.actor.gameId
      });
      this.actors.set(socket, {
        actor,
        baseLabel: previous.baseLabel,
        generation,
        socketId: socket.id
      });
      return actor;
    }
    return this.addActor({
      label: label ?? `client-${this.actors.size + 1}`,
      socket,
      namespace: (socket as unknown as { nsp?: string }).nsp
    });
  }

  /** Fresh events only; migrated payload waits retain the shared event-wait timeout cap. */
  public waitForEvent<T = any>(
    socket: Socket,
    event: string,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    signal?: AbortSignal
  ): Promise<T> {
    return this.waitForEventMatching(socket, event, () => true, timeout, signal);
  }

  public waitForEventMatching<T = any>(
    socket: Socket,
    event: string,
    predicate: (data: T) => boolean,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    signal?: AbortSignal
  ): Promise<T> {
    const actor = this.actor(socket);
    const expectation = this.createEventWait<T>(actor, event, timeout, predicate, signal);
    return this.trackExpectation(
      expectation,
      `inbound "${event}" for actor "${actor.label}"`,
      signal
    );
  }

  /** Retains the shared no-event observation-window cap for migrated tests. */
  public waitForNoEvent(
    socket: Socket,
    event: string,
    duration: number = TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
    signal?: AbortSignal
  ): Promise<void> {
    const actor = this.actor(socket);
    this.requireConnected(actor, event);
    return this.trackExpectation(
      this.journal.expectNoEvent({
        actor,
        direction: "inbound",
        event,
        durationMs: Math.min(duration, TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS),
        afterSequence: this.mark(),
        signal
      }),
      `no inbound "${event}" for actor "${actor.label}"`,
      signal
    );
  }

  public emitAndWaitForEvent<T = any>(
    socket: Socket,
    event: string,
    emit: () => void,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    predicate: (data: T) => boolean = () => true
  ): Promise<T> {
    return this.runAndWaitForEvent(socket, event, emit, timeout, predicate);
  }

  public runAndWaitForEvent<T = any>(
    socket: Socket,
    event: string,
    operation: () => void | Promise<void>,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    predicate: (data: T) => boolean = () => true
  ): Promise<T> {
    const actor = this.actor(socket);
    const controller = new AbortController();
    const eventPromise = this.createEventWait(actor, event, timeout, predicate, controller.signal);
    const expectation = (async (): Promise<T> => {
      try {
        const result = await withTimeout(
          Promise.all([eventPromise, operation()]),
          timeout,
          `operation producing "${event}" for actor "${actor.label}"`
        );
        return result[0];
      } finally {
        controller.abort();
        await Promise.allSettled([eventPromise]);
      }
    })();
    return this.trackExpectation(
      expectation,
      `operation producing "${event}" for actor "${actor.label}"`
    );
  }

  public collectEvents<T>(
    socket: Socket,
    event: string,
    expectedCount: number,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
  ): ScenarioEventCollector<T> {
    const collector = this.collectSocketEvents<T>(socket, [event], expectedCount, timeout);
    return {
      ...collector,
      promise: this.trackExpectation(
        collector.promise.then((records) => records.map(({ data }) => data)),
        `${expectedCount} inbound "${event}" payloads`
      )
    };
  }

  public collectSocketEvents<T, TEvent extends string = string>(
    socket: Socket,
    events: readonly TEvent[],
    expectedCount: number,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
  ): ScenarioEventCollector<{ event: TEvent; data: T }> {
    if (!Number.isInteger(expectedCount) || expectedCount < 1 || events.length === 0) {
      throw new Error("Event collector requires at least one event and a positive integer count");
    }
    const actor = this.actor(socket);
    this.requireConnected(actor, events.join(", "));
    const afterSequence = this.mark();
    const controller = new AbortController();
    let finalCount: number | undefined;
    const records = (): { event: TEvent; data: T }[] =>
      this.journal
        .snapshot()
        .filter(
          (record) =>
            record.actorLabel === actor.label &&
            record.direction === "inbound" &&
            record.sequence > afterSequence &&
            events.includes(record.event as TEvent)
        )
        .map((record) => ({ event: record.event as TEvent, data: record.args[0] as T }));
    const promise = this.trackExpectation(
      this.journal
        .expectEvent({
          actor,
          direction: "inbound",
          event: events,
          timeoutMs: timeout,
          afterSequence,
          signal: controller.signal,
          predicate: () => records().length >= expectedCount,
          description: `${expectedCount} events (${events.join(", ")}) for actor "${actor.label}"`
        })
        .then(() => records()),
      `${expectedCount} events (${events.join(", ")}) for actor "${actor.label}"`
    );
    const assertExactCount = (): void => {
      const count = finalCount ?? records().length;
      if (count > expectedCount) {
        throw new Error(
          `Expected exactly ${expectedCount} events (${events.join(", ")}) for actor "${actor.label}", received ${count}`
        );
      }
    };
    this.completionAssertions.push(assertExactCount);
    return {
      promise,
      stop: () => {
        if (finalCount !== undefined) return;
        finalCount = records().length;
        controller.abort(
          new Error(
            `Stopped waiting for ${expectedCount} events (${events.join(", ")}); received ${finalCount}`
          )
        );
        assertExactCount();
      },
      count: () => finalCount ?? records().length
    };
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

  public trackExpectation<T>(
    expectation: Promise<T>,
    description: string,
    cancellationSignal?: AbortSignal
  ): Promise<T> {
    this.assertNotDisposed();
    const outcome = expectation.then<ExpectationOutcome, ExpectationOutcome>(
      () => ({ status: "fulfilled" }),
      (reason: unknown) =>
        cancellationSignal?.aborted && reason instanceof EventJournalAbortedError
          ? { status: "fulfilled" }
          : { status: "rejected", reason }
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
      for (const assertion of this.completionAssertions) {
        try {
          assertion();
        } catch (error) {
          failures.push(toError(error));
        }
      }
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
      this.actors.clear();
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

  private createEventWait<T>(
    actor: ScenarioActor,
    event: string,
    timeoutMs: number,
    predicate: (data: T) => boolean,
    signal?: AbortSignal
  ): Promise<T> {
    this.requireConnected(actor, event);
    return this.journal
      .expectEvent<[T]>({
        actor,
        direction: "inbound",
        event,
        timeoutMs: Math.min(timeoutMs, TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS),
        afterSequence: this.mark(),
        signal,
        predicate: ({ args }) => predicate(args[0])
      })
      .then((record) => record.args[0]);
  }

  private requireConnected(actor: ScenarioActor, event: string): void {
    if (actor.socket.connected === false) {
      throw new Error(`Cannot wait for "${event}" from disconnected actor "${actor.label}"`);
    }
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
