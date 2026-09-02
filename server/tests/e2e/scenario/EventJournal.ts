import { type Socket } from "socket.io-client";

export type EventDirection = "inbound" | "outbound";

export interface JournalActor {
  readonly label: string;
  readonly socket: Socket;
  readonly namespace?: string;
  readonly userId?: number;
  readonly gameId?: string;
}

export interface EventRecord<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly sequence: number;
  readonly direction: EventDirection;
  readonly event: string;
  readonly args: TArgs;
  readonly actorLabel: string;
  readonly namespace: string;
  readonly socketId: string | undefined;
  readonly userId: number | undefined;
  readonly gameId: string | undefined;
  readonly recordedAt: Date;
}

/** Event payload predicates are deliberately synchronous to preserve record order. */
export type EventPredicate<TArgs extends readonly unknown[] = readonly unknown[]> = (
  record: EventRecord<TArgs>
) => boolean;

export interface EventExpectation<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor?: JournalActor;
  readonly direction?: EventDirection;
  readonly event: string | readonly string[];
  readonly timeoutMs: number;
  readonly afterSequence?: number;
  readonly predicate?: EventPredicate<TArgs>;
  readonly description?: string;
  readonly signal?: AbortSignal;
}

export interface NoEventExpectation<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor?: JournalActor;
  readonly direction?: EventDirection;
  readonly event: string;
  readonly durationMs: number;
  readonly afterSequence?: number;
  readonly predicate?: EventPredicate<TArgs>;
  readonly description?: string;
  readonly signal?: AbortSignal;
}

type OnAnyHandler = (event: string, ...args: unknown[]) => void;
type EventJournalCompletionMode = "finish" | "abort";

interface JournalAttachment {
  readonly actor: JournalActor;
  readonly handler: OnAnyHandler;
  readonly outgoingHandler?: OnAnyHandler;
  readonly lifecycleHandlers: readonly {
    event: "disconnect" | "connect_error";
    handler: (...args: unknown[]) => void;
  }[];
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: Error) => void;
}

interface PendingEventWait<TArgs extends readonly unknown[]> {
  readonly id: number;
  readonly expectation: EventExpectation<TArgs>;
  readonly deferred: Deferred<EventRecord<TArgs>>;
  readonly timeout: NodeJS.Timeout;
  readonly removeAbortHandler: () => void;
}

interface PendingNoEventWait<TArgs extends readonly unknown[]> {
  readonly id: number;
  readonly expectation: NoEventExpectation<TArgs>;
  readonly deferred: Deferred<void>;
  readonly timeout: NodeJS.Timeout;
  readonly removeAbortHandler: () => void;
}

export class EventJournalDisposedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EventJournalDisposedError";
  }
}

export class EventJournalAbortedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EventJournalAbortedError";
  }
}

/** Records inbound broadcasts and outbound client commands for scenario tests. */
export class EventJournal {
  private readonly attachments = new Map<string, JournalAttachment>();
  private readonly records: EventRecord[] = [];
  private readonly eventWaits = new Map<number, PendingEventWait<readonly unknown[]>>();
  private readonly noEventWaits = new Map<number, PendingNoEventWait<readonly unknown[]>>();
  private nextSequence = 1;
  private nextWaitId = 1;
  private disposed = false;
  private completionMode: EventJournalCompletionMode | undefined;
  private completionPromise: Promise<void> | undefined;

  public attach(actor: JournalActor): void {
    this.assertNotDisposed();

    if (this.attachments.has(actor.label)) {
      throw new Error(`Event journal actor label "${actor.label}" is already attached`);
    }

    const handler: OnAnyHandler = (event: string, ...args: unknown[]) => {
      this.record(actor, "inbound", event, args);
    };
    const outgoingHandler: OnAnyHandler | undefined =
      typeof actor.socket.onAnyOutgoing === "function"
        ? (event, ...args) => this.record(actor, "outbound", event, args)
        : undefined;
    const lifecycleHandlers: JournalAttachment["lifecycleHandlers"] =
      typeof actor.socket.on === "function"
        ? (["disconnect", "connect_error"] as const).map((event) => ({
            event,
            handler: (...args: unknown[]) => {
              this.record(actor, "inbound", event, args);
              this.rejectDisconnectedActorWaits(actor, event);
            }
          }))
        : [];
    actor.socket.onAny(handler);
    if (outgoingHandler) {
      actor.socket.onAnyOutgoing(outgoingHandler);
    }
    for (const lifecycle of lifecycleHandlers) {
      actor.socket.on(lifecycle.event, lifecycle.handler);
    }
    this.attachments.set(actor.label, { actor, handler, outgoingHandler, lifecycleHandlers });
  }

  /** Stop observing an old connection generation while retaining its recorded history. */
  public detach(actor: JournalActor): void {
    const attachment = this.attachments.get(actor.label);
    if (!attachment) return;

    this.detachAttachment(attachment);
    this.attachments.delete(actor.label);
    this.rejectDisconnectedActorWaits(actor, "connection replaced");
  }

  public observesOutgoing(actor: JournalActor): boolean {
    return this.attachments.get(actor.label)?.outgoingHandler !== undefined;
  }

  public mark(): number {
    this.assertNotDisposed();
    return this.nextSequence - 1;
  }

  public snapshot(): readonly EventRecord[] {
    return this.records.map(copyEventRecord);
  }

  public recordOutgoing(actor: JournalActor, event: string, args: readonly unknown[]): void {
    this.record(actor, "outbound", event, args);
  }

  public expectEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ): Promise<EventRecord<TArgs>> {
    this.assertNotDisposed();

    if (expectation.signal?.aborted) {
      return observeRejection(Promise.reject(this.createAbortedError(expectation)));
    }

    try {
      const existing = this.findMatchingRecord(expectation);
      if (existing) {
        return Promise.resolve(copyEventRecord(existing));
      }
    } catch (error) {
      return observeRejection(Promise.reject(this.toPredicateError(error, expectation)));
    }

    const waitId = this.allocateWaitId();
    const deferred = createDeferred<EventRecord<TArgs>>();
    const timeout = setTimeout(() => {
      const wait = this.eventWaits.get(waitId);
      if (!wait) {
        return;
      }

      this.eventWaits.delete(waitId);
      wait.removeAbortHandler();
      wait.deferred.reject(new Error(this.formatEventTimeout(wait.expectation)));
    }, expectation.timeoutMs);
    const wait: PendingEventWait<TArgs> = {
      id: waitId,
      expectation,
      deferred,
      timeout,
      removeAbortHandler: this.onAbort(expectation.signal, () => {
        this.rejectEventWait(wait, this.createAbortedError(expectation));
      })
    };

    this.eventWaits.set(waitId, wait as unknown as PendingEventWait<readonly unknown[]>);
    return deferred.promise;
  }

  public expectNoEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: NoEventExpectation<TArgs>
  ): Promise<void> {
    this.assertNotDisposed();

    if (expectation.signal?.aborted) {
      return observeRejection(Promise.reject(this.createAbortedError(expectation)));
    }

    try {
      const existing = this.findMatchingRecord(expectation);
      if (existing) {
        return observeRejection(
          Promise.reject(new Error(this.formatUnexpectedEvent(existing, expectation)))
        );
      }
    } catch (error) {
      return observeRejection(Promise.reject(this.toPredicateError(error, expectation)));
    }

    const waitId = this.allocateWaitId();
    const deferred = createDeferred<void>();
    const timeout = setTimeout(() => {
      const wait = this.noEventWaits.get(waitId);
      if (!wait) {
        return;
      }

      this.noEventWaits.delete(waitId);
      wait.removeAbortHandler();
      wait.deferred.resolve();
    }, expectation.durationMs);
    const wait: PendingNoEventWait<TArgs> = {
      id: waitId,
      expectation,
      deferred,
      timeout,
      removeAbortHandler: this.onAbort(expectation.signal, () => {
        this.rejectNoEventWait(wait, this.createAbortedError(expectation));
      })
    };

    this.noEventWaits.set(waitId, wait as PendingNoEventWait<readonly unknown[]>);
    return deferred.promise;
  }

  public dispose(): Promise<void> {
    return this.complete("abort");
  }

  public finish(): Promise<void> {
    return this.complete("finish");
  }

  private complete(mode: EventJournalCompletionMode): Promise<void> {
    if (this.completionPromise) {
      if (this.completionMode !== mode) {
        throw new Error(
          `Event journal completion already started in ${this.completionMode ?? "unknown"} mode`
        );
      }

      return this.completionPromise;
    }

    this.completionMode = mode;
    this.completionPromise = this.disposeInternal(mode);
    return this.completionPromise;
  }

  private async disposeInternal(mode: EventJournalCompletionMode): Promise<void> {
    this.disposed = true;
    const infrastructureFailures: Error[] = [];

    if (mode === "finish" && (this.eventWaits.size > 0 || this.noEventWaits.size > 0)) {
      infrastructureFailures.push(
        new Error(
          `Event journal finished with pending assertions: ` +
            `${this.eventWaits.size} event waits, ${this.noEventWaits.size} no-event waits`
        )
      );
    }

    for (const [actorLabel, attachment] of [...this.attachments.entries()]) {
      try {
        this.detachAttachment(attachment);
      } catch (error) {
        infrastructureFailures.push(toError(error));
      } finally {
        this.attachments.delete(actorLabel);
      }
    }

    const eventWaits = [...this.eventWaits.values()];
    const noEventWaits = [...this.noEventWaits.values()];
    this.eventWaits.clear();
    this.noEventWaits.clear();

    for (const wait of eventWaits) {
      clearTimeout(wait.timeout);
      wait.removeAbortHandler();
      wait.deferred.reject(this.createDisposedError("event", wait.expectation));
    }
    for (const wait of noEventWaits) {
      clearTimeout(wait.timeout);
      wait.removeAbortHandler();
      wait.deferred.reject(this.createDisposedError("no-event", wait.expectation));
    }

    if (infrastructureFailures.length > 0) {
      throw new AggregateError(
        infrastructureFailures,
        `Event journal ${mode} failed: ${infrastructureFailures
          .map((failure) => failure.message)
          .join("; ")}`
      );
    }
  }

  private allocateWaitId(): number {
    const id = this.nextWaitId;
    this.nextWaitId += 1;
    return id;
  }

  private detachAttachment(attachment: JournalAttachment): void {
    const failures: Error[] = [];
    const removals = [
      () => attachment.actor.socket.offAny(attachment.handler),
      ...attachment.lifecycleHandlers.map(
        ({ event, handler }) =>
          () =>
            attachment.actor.socket.off(event, handler)
      )
    ];
    if (attachment.outgoingHandler) {
      removals.push(() => attachment.actor.socket.offAnyOutgoing(attachment.outgoingHandler));
    }
    for (const remove of removals) {
      try {
        remove();
      } catch (error) {
        failures.push(toError(error));
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `Cannot detach actor "${attachment.actor.label}": ${failures.map((error) => error.message).join("; ")}`
      );
    }
  }

  private onAbort(signal: AbortSignal | undefined, abort: () => void): () => void {
    signal?.addEventListener("abort", abort, { once: true });
    return () => signal?.removeEventListener("abort", abort);
  }

  private createAbortedError<TArgs extends readonly unknown[]>(
    expectation: EventExpectation<TArgs> | NoEventExpectation<TArgs>
  ): EventJournalAbortedError {
    const reason = expectation.signal?.reason;
    return new EventJournalAbortedError(
      `Event journal wait aborted for "${expectation.event}" ${this.formatExpectationContext(expectation)}` +
        (reason instanceof Error ? `: ${reason.message}` : "")
    );
  }

  private rejectDisconnectedActorWaits(actor: JournalActor, event: string): void {
    const error = new Error(
      `Scenario actor "${actor.label}" disconnected (${event}, namespace="${actor.namespace ?? "unknown"}", ` +
        `gameId="${actor.gameId ?? "unknown"}") lastEvents=${this.formatLastRecords()}`
    );
    for (const wait of [...this.eventWaits.values()]) {
      if (wait.expectation.actor?.label === actor.label) this.rejectEventWait(wait, error);
    }
    for (const wait of [...this.noEventWaits.values()]) {
      if (wait.expectation.actor?.label === actor.label) this.rejectNoEventWait(wait, error);
    }
  }

  private resolveEventWait<TArgs extends readonly unknown[]>(
    wait: PendingEventWait<TArgs>,
    record: EventRecord<TArgs>
  ): void {
    if (!this.eventWaits.has(wait.id)) {
      return;
    }

    clearTimeout(wait.timeout);
    wait.removeAbortHandler();
    this.eventWaits.delete(wait.id);
    wait.deferred.resolve(copyEventRecord(record));
  }

  private rejectEventWait<TArgs extends readonly unknown[]>(
    wait: PendingEventWait<TArgs>,
    error: Error
  ): void {
    if (!this.eventWaits.has(wait.id)) {
      return;
    }

    clearTimeout(wait.timeout);
    wait.removeAbortHandler();
    this.eventWaits.delete(wait.id);
    wait.deferred.reject(error);
  }

  private rejectNoEventWait<TArgs extends readonly unknown[]>(
    wait: PendingNoEventWait<TArgs>,
    error: Error
  ): void {
    if (!this.noEventWaits.has(wait.id)) {
      return;
    }

    clearTimeout(wait.timeout);
    wait.removeAbortHandler();
    this.noEventWaits.delete(wait.id);
    wait.deferred.reject(error);
  }

  private record(
    actor: JournalActor,
    direction: EventDirection,
    event: string,
    args: readonly unknown[]
  ): void {
    this.assertNotDisposed();

    const record: EventRecord = {
      sequence: this.nextSequence,
      direction,
      event,
      args: args.map(copyEventArgument),
      actorLabel: actor.label,
      namespace: actor.namespace ?? "unknown",
      socketId: actor.socket.id,
      userId: actor.userId,
      gameId: actor.gameId,
      recordedAt: new Date()
    };

    this.nextSequence += 1;
    this.records.push(record);
    this.notifyWaiters(record);
  }

  private notifyWaiters(record: EventRecord): void {
    for (const wait of [...this.eventWaits.values()]) {
      try {
        if (this.matches(record, wait.expectation)) {
          this.resolveEventWait(wait, record);
        }
      } catch (error) {
        this.rejectEventWait(wait, this.toPredicateError(error, wait.expectation));
      }
    }

    for (const wait of [...this.noEventWaits.values()]) {
      try {
        if (this.matches(record, wait.expectation)) {
          this.rejectNoEventWait(
            wait,
            new Error(this.formatUnexpectedEvent(record, wait.expectation))
          );
        }
      } catch (error) {
        this.rejectNoEventWait(wait, this.toPredicateError(error, wait.expectation));
      }
    }
  }

  private findMatchingRecord<TArgs extends readonly unknown[]>(
    expectation: EventExpectation<TArgs> | NoEventExpectation<TArgs>
  ): EventRecord<TArgs> | undefined {
    for (const record of this.records) {
      if (this.matches(record, expectation)) {
        return record as EventRecord<TArgs>;
      }
    }

    return undefined;
  }

  private matches<TArgs extends readonly unknown[]>(
    record: EventRecord,
    expectation: EventExpectation<TArgs> | NoEventExpectation<TArgs>
  ): boolean {
    if (typeof expectation.event === "string") {
      if (record.event !== expectation.event) return false;
    } else if (!expectation.event.includes(record.event)) return false;
    if (expectation.direction && record.direction !== expectation.direction) return false;
    if (expectation.actor && record.actorLabel !== expectation.actor.label) return false;
    if (expectation.afterSequence !== undefined && record.sequence <= expectation.afterSequence) {
      return false;
    }
    if (!expectation.predicate) return true;

    return expectation.predicate(record as EventRecord<TArgs>);
  }

  private createDisposedError(
    direction: "event" | "no-event",
    expectation: EventExpectation<readonly unknown[]> | NoEventExpectation<readonly unknown[]>
  ): EventJournalDisposedError {
    return new EventJournalDisposedError(
      `Event journal disposed while waiting for ${direction} "${expectation.event}" ` +
        `${this.formatExpectationContext(expectation)} lastEvents=${this.formatLastRecords()}`
    );
  }

  private toPredicateError<TArgs extends readonly unknown[]>(
    error: unknown,
    expectation: EventExpectation<TArgs> | NoEventExpectation<TArgs>
  ): Error {
    const cause = toError(error);
    return new Error(
      `Event predicate failed for "${expectation.event}" ${this.formatExpectationContext(expectation)}: ${cause.message}`,
      { cause }
    );
  }

  private formatEventTimeout<TArgs extends readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ): string {
    return (
      `Timed out after ${expectation.timeoutMs}ms waiting for event "${expectation.event}" ` +
      `${this.formatExpectationContext(expectation)} lastEvents=${this.formatLastRecords()}`
    );
  }

  private formatUnexpectedEvent<TArgs extends readonly unknown[]>(
    record: EventRecord,
    expectation: NoEventExpectation<TArgs>
  ): string {
    return (
      `Unexpected event "${expectation.event}" received during ${expectation.durationMs}ms ` +
      `${this.formatExpectationContext(expectation)} record=${this.formatRecord(record)} ` +
      `lastEvents=${this.formatLastRecords()}`
    );
  }

  private formatExpectationContext<TArgs extends readonly unknown[]>(
    expectation: EventExpectation<TArgs> | NoEventExpectation<TArgs>
  ): string {
    return JSON.stringify({
      description: expectation.description,
      actor: expectation.actor?.label,
      socketId: expectation.actor?.socket.id,
      namespace: expectation.actor?.namespace,
      gameId: expectation.actor?.gameId,
      direction: expectation.direction,
      afterSequence: expectation.afterSequence,
      recordedEvents: this.records.length
    });
  }

  private formatLastRecords(limit = 10): string {
    return JSON.stringify(
      this.records.slice(-limit).map((record) => this.recordToDebugObject(record))
    );
  }

  private formatRecord(record: EventRecord): string {
    return JSON.stringify(this.recordToDebugObject(record));
  }

  private recordToDebugObject(record: EventRecord): Record<string, unknown> {
    return {
      sequence: record.sequence,
      direction: record.direction,
      event: record.event,
      actorLabel: record.actorLabel,
      namespace: record.namespace,
      socketId: record.socketId,
      userId: record.userId,
      gameId: record.gameId,
      args: record.args
    };
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new EventJournalDisposedError("Event journal is disposed");
    }
  }
}

/** Runs a journal-backed assertion and preserves both scenario and disposal failures. */
export async function withEventJournal<T>(
  callback: (journal: EventJournal) => Promise<T>
): Promise<T> {
  const journal = new EventJournal();
  let result: T | undefined;
  let scenarioFailure: Error | undefined;

  try {
    result = await callback(journal);
  } catch (error) {
    scenarioFailure = toError(error);
  }

  let cleanupFailure: Error | undefined;
  try {
    if (scenarioFailure) {
      await journal.dispose();
    } else {
      await journal.finish();
    }
  } catch (error) {
    cleanupFailure = toError(error);
  }

  if (scenarioFailure && cleanupFailure) {
    throw new AggregateError(
      [scenarioFailure, cleanupFailure],
      `Event journal scenario and cleanup both failed: ${scenarioFailure.message}; ${cleanupFailure.message}`
    );
  }
  if (scenarioFailure) {
    throw scenarioFailure;
  }
  if (cleanupFailure) {
    throw cleanupFailure;
  }

  return result as T;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = observeRejection(
    new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    })
  );

  return { promise, resolve, reject };
}

function observeRejection<T>(promise: Promise<T>): Promise<T> {
  void promise.catch(() => undefined);
  return promise;
}

export function copyEventRecord<TArgs extends readonly unknown[]>(
  record: EventRecord<TArgs>
): EventRecord<TArgs> {
  return {
    ...record,
    args: record.args.map(copyEventArgument) as unknown as TArgs,
    recordedAt: new Date(record.recordedAt)
  };
}

function copyEventArgument(value: unknown): unknown {
  if (value instanceof Date) {
    return new Date(value);
  }

  if (Array.isArray(value)) {
    return value.map(copyEventArgument);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, copyEventArgument(nestedValue)])
    );
  }

  return value;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
