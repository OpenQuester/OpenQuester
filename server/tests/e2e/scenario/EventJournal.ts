import { type Socket } from "socket.io-client";

export interface JournalActor {
  readonly label: string;
  readonly socket: Socket;
  readonly namespace?: string;
  readonly userId?: number;
  readonly gameId?: string;
}

export interface EventRecord<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly sequence: number;
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
  readonly event: string;
  readonly timeoutMs: number;
  readonly afterSequence?: number;
  readonly predicate?: EventPredicate<TArgs>;
  readonly description?: string;
}

export interface NoEventExpectation<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly actor?: JournalActor;
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

/**
 * Records every Socket.IO event seen by attached test clients.
 *
 * The journal is intentionally independent from individual waits. Tests can emit
 * many commands first and assert the resulting event history afterwards without
 * losing events that arrived before a specific assertion was awaited.
 */
export class EventJournal {
  private readonly attachments = new Map<string, JournalAttachment>();
  private readonly records: EventRecord[] = [];
  private readonly eventWaits = new Set<PendingEventWait<readonly unknown[]>>();
  private readonly noEventWaits = new Set<PendingNoEventWait<readonly unknown[]>>();
  private nextSequence = 1;

  public attach(actor: JournalActor): void {
    this.detach(actor.label);

    const handler: OnAnyHandler = (event: string, ...args: unknown[]) => {
      this.record(actor, event, args);
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
    return this.nextSequence - 1;
  }

  public snapshot(): readonly EventRecord[] {
    return [...this.records];
  }

  public recordsFor(actor: JournalActor): readonly EventRecord[] {
    return this.records.filter((record) => record.actorLabel === actor.label);
  }

  public async expectEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: EventExpectation<TArgs>
  ): Promise<EventRecord<TArgs>> {
    const existing = await this.findMatchingRecord(expectation);
    if (existing) {
      return existing;
    }

    return new Promise<EventRecord<TArgs>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.eventWaits.delete(wait as PendingEventWait<readonly unknown[]>);
        reject(new Error(this.formatEventTimeout(expectation)));
      }, expectation.timeoutMs);

      const wait: PendingEventWait<TArgs> = {
        expectation,
        resolve,
        reject,
        timeout
      };

      this.eventWaits.add(wait as PendingEventWait<readonly unknown[]>);
    });
  }

  public async expectNoEvent<TArgs extends readonly unknown[] = readonly unknown[]>(
    expectation: NoEventExpectation<TArgs>
  ): Promise<void> {
    const existing = await this.findMatchingRecord({
      actor: expectation.actor,
      event: expectation.event,
      timeoutMs: expectation.durationMs,
      afterSequence: expectation.afterSequence,
      predicate: expectation.predicate,
      description: expectation.description
    });

    if (existing) {
      throw new Error(this.formatUnexpectedEvent(existing, expectation));
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.noEventWaits.delete(wait as PendingNoEventWait<readonly unknown[]>);
        resolve();
      }, expectation.durationMs);

      const wait: PendingNoEventWait<TArgs> = {
        expectation,
        resolve,
        reject,
        timeout
      };

      this.noEventWaits.add(wait as PendingNoEventWait<readonly unknown[]>);
    });
  }

  private record(actor: JournalActor, event: string, args: readonly unknown[]): void {
    const record: EventRecord = {
      sequence: this.nextSequence,
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
    if (!(await this.matches(record, wait.expectation))) {
      return;
    }

    clearTimeout(wait.timeout);
    this.eventWaits.delete(wait);
    wait.resolve(record);
  }

  private async tryRejectNoEventWait(
    wait: PendingNoEventWait<readonly unknown[]>,
    record: EventRecord
  ): Promise<void> {
    if (!(await this.matches(record, wait.expectation))) {
      return;
    }

    clearTimeout(wait.timeout);
    this.noEventWaits.delete(wait);
    wait.reject(new Error(this.formatUnexpectedEvent(record, wait.expectation)));
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
    if (record.event !== expectation.event) {
      return false;
    }

    if (expectation.actor && record.actorLabel !== expectation.actor.label) {
      return false;
    }

    if (expectation.afterSequence !== undefined && record.sequence <= expectation.afterSequence) {
      return false;
    }

    if (!expectation.predicate) {
      return true;
    }

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
      afterSequence: expectation.afterSequence,
      recordedEvents: this.records.length
    });
  }

  private formatRecord(record: EventRecord): string {
    return JSON.stringify({
      sequence: record.sequence,
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
