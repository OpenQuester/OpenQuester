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
  readonly event: string;
  readonly timeoutMs: number;
  readonly afterSequence?: number;
  readonly predicate?: EventPredicate<TArgs>;
  readonly description?: string;
}

export interface NoEventExpectation<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor?: JournalActor;
  readonly direction?: EventDirection;
  readonly event: string;
  readonly durationMs: number;
  readonly afterSequence?: number;
  readonly predicate?: EventPredicate<TArgs>;
  readonly description?: string;
}

type OnAnyHandler = (event: string, ...args: unknown[]) => void;

interface JournalAttachment {
  readonly actor: JournalActor;
  readonly handler: OnAnyHandler;
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
}

interface PendingNoEventWait<TArgs extends readonly unknown[]> {
  readonly id: number;
  readonly expectation: NoEventExpectation<TArgs>;
  readonly deferred: Deferred<void>;
  readonly timeout: NodeJS.Timeout;
}

export class EventJournalDisposedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EventJournalDisposedError";
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
  private disposePromise: Promise<void> | undefined;

  public attach(actor: JournalActor): void {
    this.assertNotDisposed();

    if (this.attachments.has(actor.label)) {
      throw new Error(`Event journal actor label "${actor.label}" is already attached`);
    }

    const handler: OnAnyHandler = (event: string, ...args: unknown[]) => {
      this.record(actor, "inbound", event, args);
    };

    actor.socket.onAny(handler);
    this.attachments.set(actor.label, { actor, handler });
  }

  public detach(actorLabel: string): void {
    const attachment = this.attachments.get(actorLabel);
    if (!attachment) {
      return;
    }

    attachment.actor.socket.offAny(attachment.handler);
    this.attachments.delete(actorLabel);
  }

  public detachAll(): void {
    for (const actorLabel of [...this.attachments.keys()]) {
      this.detach(actorLabel);
    }
  }

  public mark(): number {
    this.assertNotDisposed();
    return this.nextSequence - 1;
  }

  public snapshot(): readonly EventRecord[] {
    return this.records.map(copyEventRecord);
  }

  public recordsFor(actor: JournalActor): readonly EventRecord[] {
    return this.records
      .filter((record) => record.actorLabel === actor.label)
      .map(copyEventRecord);
  }

  public recordOutgoing(actor: JournalActor, event: string, args: readonly unknown[]): void {
    this.record(actor, "outbound", event, args);
  }

  public expectEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ): Promise<EventRecord<TArgs>> {
    this.assertNotDisposed();

    try {
      const existing = this.findMatchingRecord(expectation);
      if (existing) {
        return Promise.resolve(existing);
      }
    } catch (error) {
      return Promise.reject(this.toPredicateError(error, expectation));
    }

    const waitId = this.allocateWaitId();
    const deferred = createDeferred<EventRecord<TArgs>>();
    const timeout = setTimeout(() => {
      const wait = this.eventWaits.get(waitId);
      if (!wait) {
        return;
      }

      this.eventWaits.delete(waitId);
      wait.deferred.reject(new Error(this.formatEventTimeout(wait.expectation)));
    }, expectation.timeoutMs);
    const wait: PendingEventWait<TArgs> = {
      id: waitId,
      expectation,
      deferred,
      timeout
    };

    this.eventWaits.set(waitId, wait as unknown as PendingEventWait<readonly unknown[]>);
    return deferred.promise;
  }

  public expectNoEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: NoEventExpectation<TArgs>
  ): Promise<void> {
    this.assertNotDisposed();

    try {
      const existing = this.findMatchingRecord(this.toEventExpectation(expectation));
      if (existing) {
        return Promise.reject(new Error(this.formatUnexpectedEvent(existing, expectation)));
      }
    } catch (error) {
      return Promise.reject(this.toPredicateError(error, expectation));
    }

    const waitId = this.allocateWaitId();
    const deferred = createDeferred<void>();
    const timeout = setTimeout(() => {
      const wait = this.noEventWaits.get(waitId);
      if (!wait) {
        return;
      }

      this.noEventWaits.delete(waitId);
      wait.deferred.resolve();
    }, expectation.durationMs);
    const wait: PendingNoEventWait<TArgs> = {
      id: waitId,
      expectation,
      deferred,
      timeout
    };

    this.noEventWaits.set(waitId, wait as PendingNoEventWait<readonly unknown[]>);
    return deferred.promise;
  }

  public dispose(): Promise<void> {
    if (!this.disposePromise) {
      this.disposePromise = this.disposeInternal();
    }

    return this.disposePromise;
  }

  private async disposeInternal(): Promise<void> {
    this.disposed = true;
    const infrastructureFailures: Error[] = [];

    for (const [actorLabel, attachment] of [...this.attachments.entries()]) {
      try {
        attachment.actor.socket.offAny(attachment.handler);
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
      wait.deferred.reject(this.createDisposedError("event", wait.expectation));
    }
    for (const wait of noEventWaits) {
      clearTimeout(wait.timeout);
      wait.deferred.reject(this.createDisposedError("no-event", wait.expectation));
    }

    await Promise.allSettled([
      ...eventWaits.map((wait) => wait.deferred.promise),
      ...noEventWaits.map((wait) => wait.deferred.promise)
    ]);

    if (infrastructureFailures.length > 0) {
      throw new AggregateError(
        infrastructureFailures,
        `Event journal disposal failed: ${infrastructureFailures
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

  private resolveEventWait<TArgs extends readonly unknown[]>(
    wait: PendingEventWait<TArgs>,
    record: EventRecord<TArgs>
  ): void {
    if (!this.eventWaits.has(wait.id)) {
      return;
    }

    clearTimeout(wait.timeout);
    this.eventWaits.delete(wait.id);
    wait.deferred.resolve(record);
  }

  private rejectEventWait<TArgs extends readonly unknown[]>(
    wait: PendingEventWait<TArgs>,
    error: Error
  ): void {
    if (!this.eventWaits.has(wait.id)) {
      return;
    }

    clearTimeout(wait.timeout);
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
    this.noEventWaits.delete(wait.id);
    wait.deferred.reject(error);
  }

  private toEventExpectation<TArgs extends readonly unknown[]>(
    expectation: NoEventExpectation<TArgs>
  ): EventExpectation<TArgs> {
    return {
      actor: expectation.actor,
      direction: expectation.direction,
      event: expectation.event,
      timeoutMs: expectation.durationMs,
      afterSequence: expectation.afterSequence,
      predicate: expectation.predicate,
      description: expectation.description
    };
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
      args,
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
    expectation: EventExpectation<TArgs>
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
    if (record.event !== expectation.event) return false;
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
      direction: expectation.direction,
      afterSequence: expectation.afterSequence,
      recordedEvents: this.records.length
    });
  }

  private formatLastRecords(limit = 10): string {
    return JSON.stringify(this.records.slice(-limit).map((record) => this.recordToDebugObject(record)));
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

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
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
