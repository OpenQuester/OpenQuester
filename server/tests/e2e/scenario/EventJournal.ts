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

export type EventPredicate<TArgs extends readonly unknown[] = readonly unknown[]> = (
  record: EventRecord<TArgs>
) => boolean | Promise<boolean>;

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

interface PendingEventWait<TArgs extends readonly unknown[]> {
  readonly expectation: EventExpectation<TArgs>;
  readonly resolve: (record: EventRecord<TArgs>) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: NodeJS.Timeout;
}

interface PendingNoEventWait<TArgs extends readonly unknown[]> {
  readonly expectation: NoEventExpectation<TArgs>;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
  readonly timeout: NodeJS.Timeout;
}

/** Records inbound broadcasts and outbound client commands for scenario tests. */
export class EventJournal {
  private readonly attachments = new Map<string, JournalAttachment>();
  private readonly records: EventRecord[] = [];
  private readonly eventWaits = new Set<PendingEventWait<readonly unknown[]>>();
  private readonly noEventWaits = new Set<PendingNoEventWait<readonly unknown[]>>();
  private nextSequence = 1;

  public attach(actor: JournalActor): void {
    this.detach(actor.label);

    const handler: OnAnyHandler = (event: string, ...args: unknown[]) => {
      this.record(actor, "inbound", event, args);
    };

    actor.socket.onAny(handler);
    this.attachments.set(actor.label, { actor, handler });
  }

  public detach(actorLabel: string): void {
    const attachment = this.attachments.get(actorLabel);
    if (!attachment) return;

    attachment.actor.socket.offAny(attachment.handler);
    this.attachments.delete(actorLabel);
  }

  public detachAll(): void {
    for (const actorLabel of [...this.attachments.keys()]) {
      this.detach(actorLabel);
    }
  }

  public mark(): number {
    return this.nextSequence - 1;
  }

  public snapshot(): readonly EventRecord[] {
    return [...this.records];
  }

  public recordsFor(actor: JournalActor): readonly EventRecord[] {
    return this.records.filter((record) => record.actorLabel === actor.label);
  }

  public recordOutgoing(actor: JournalActor, event: string, args: readonly unknown[]): void {
    this.record(actor, "outbound", event, args);
  }

  public async expectEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ): Promise<EventRecord<TArgs>> {
    const existing = await this.findMatchingRecord(expectation);
    if (existing) return existing;

    return new Promise<EventRecord<TArgs>>((resolve, reject) => {
      const wait = this.createPendingEventWait(expectation, resolve, reject);
      this.eventWaits.add(wait as PendingEventWait<readonly unknown[]>);

      void this.findMatchingRecord(expectation)
        .then((record) => {
          if (record) this.resolveEventWait(wait, record);
        })
        .catch((error: unknown) => {
          this.rejectEventWait(wait, toError(error));
        });
    });
  }

  public async expectNoEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: NoEventExpectation<TArgs>
  ): Promise<void> {
    const existing = await this.findMatchingRecord(this.toEventExpectation(expectation));
    if (existing) throw new Error(this.formatUnexpectedEvent(existing, expectation));

    return new Promise<void>((resolve, reject) => {
      const wait = this.createPendingNoEventWait(expectation, resolve, reject);
      this.noEventWaits.add(wait as PendingNoEventWait<readonly unknown[]>);

      void this.findMatchingRecord(this.toEventExpectation(expectation))
        .then((record) => {
          if (record) this.rejectNoEventWait(wait, new Error(this.formatUnexpectedEvent(record, expectation)));
        })
        .catch((error: unknown) => {
          this.rejectNoEventWait(wait, toError(error));
        });
    });
  }

  private createPendingEventWait<TArgs extends readonly unknown[]>(
    expectation: EventExpectation<TArgs>,
    resolve: (record: EventRecord<TArgs>) => void,
    reject: (error: Error) => void
  ): PendingEventWait<TArgs> {
    const timeout = setTimeout(() => {
      this.eventWaits.delete(wait as PendingEventWait<readonly unknown[]>);
      reject(new Error(this.formatEventTimeout(expectation)));
    }, expectation.timeoutMs);

    const wait: PendingEventWait<TArgs> = { expectation, resolve, reject, timeout };
    return wait;
  }

  private createPendingNoEventWait<TArgs extends readonly unknown[]>(
    expectation: NoEventExpectation<TArgs>,
    resolve: () => void,
    reject: (error: Error) => void
  ): PendingNoEventWait<TArgs> {
    const timeout = setTimeout(() => {
      this.noEventWaits.delete(wait as PendingNoEventWait<readonly unknown[]>);
      resolve();
    }, expectation.durationMs);

    const wait: PendingNoEventWait<TArgs> = { expectation, resolve, reject, timeout };
    return wait;
  }

  private resolveEventWait<TArgs extends readonly unknown[]>(
    wait: PendingEventWait<TArgs>,
    record: EventRecord<TArgs>
  ): void {
    if (!this.eventWaits.has(wait as PendingEventWait<readonly unknown[]>)) return;

    clearTimeout(wait.timeout);
    this.eventWaits.delete(wait as PendingEventWait<readonly unknown[]>);
    wait.resolve(record);
  }

  private rejectEventWait<TArgs extends readonly unknown[]>(
    wait: PendingEventWait<TArgs>,
    error: Error
  ): void {
    if (!this.eventWaits.has(wait as PendingEventWait<readonly unknown[]>)) return;

    clearTimeout(wait.timeout);
    this.eventWaits.delete(wait as PendingEventWait<readonly unknown[]>);
    wait.reject(error);
  }

  private rejectNoEventWait<TArgs extends readonly unknown[]>(
    wait: PendingNoEventWait<TArgs>,
    error: Error
  ): void {
    if (!this.noEventWaits.has(wait as PendingNoEventWait<readonly unknown[]>)) return;

    clearTimeout(wait.timeout);
    this.noEventWaits.delete(wait as PendingNoEventWait<readonly unknown[]>);
    wait.reject(error);
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
    for (const wait of [...this.eventWaits]) {
      void this.tryResolveEventWait(wait, record);
    }

    for (const wait of [...this.noEventWaits]) {
      void this.tryRejectNoEventWait(wait, record);
    }
  }

  private async tryResolveEventWait(
    wait: PendingEventWait<readonly unknown[]>,
    record: EventRecord
  ): Promise<void> {
    try {
      if (!(await this.matches(record, wait.expectation))) return;
      this.resolveEventWait(wait, record);
    } catch (error) {
      this.rejectEventWait(wait, toError(error));
    }
  }

  private async tryRejectNoEventWait(
    wait: PendingNoEventWait<readonly unknown[]>,
    record: EventRecord
  ): Promise<void> {
    try {
      if (!(await this.matches(record, wait.expectation))) return;
      this.rejectNoEventWait(wait, new Error(this.formatUnexpectedEvent(record, wait.expectation)));
    } catch (error) {
      this.rejectNoEventWait(wait, toError(error));
    }
  }

  private async findMatchingRecord<TArgs extends readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ): Promise<EventRecord<TArgs> | undefined> {
    for (const record of this.records) {
      if (await this.matches(record, expectation)) {
        return record as EventRecord<TArgs>;
      }
    }

    return undefined;
  }

  private async matches<TArgs extends readonly unknown[]>(
    record: EventRecord,
    expectation: EventExpectation<TArgs> | NoEventExpectation<TArgs>
  ): Promise<boolean> {
    if (record.event !== expectation.event) return false;
    if (expectation.direction && record.direction !== expectation.direction) return false;
    if (expectation.actor && record.actorLabel !== expectation.actor.label) return false;
    if (expectation.afterSequence !== undefined && record.sequence <= expectation.afterSequence) {
      return false;
    }
    if (!expectation.predicate) return true;

    return expectation.predicate(record as EventRecord<TArgs>);
  }

  private formatEventTimeout<TArgs extends readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ): string {
    return (
      `Timed out after ${expectation.timeoutMs}ms waiting for event "${expectation.event}" ` +
      this.formatExpectationContext(expectation)
    );
  }

  private formatUnexpectedEvent<TArgs extends readonly unknown[]>(
    record: EventRecord,
    expectation: NoEventExpectation<TArgs>
  ): string {
    return (
      `Unexpected event "${expectation.event}" received during ${expectation.durationMs}ms ` +
      `${this.formatExpectationContext(expectation)} record=${this.formatRecord(record)}`
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

  private formatRecord(record: EventRecord): string {
    return JSON.stringify({
      sequence: record.sequence,
      direction: record.direction,
      event: record.event,
      actorLabel: record.actorLabel,
      namespace: record.namespace,
      socketId: record.socketId,
      userId: record.userId,
      gameId: record.gameId,
      args: record.args
    });
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
