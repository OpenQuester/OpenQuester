import { expect } from "@jest/globals";
import { type Repository } from "typeorm";

import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { type QuestionState } from "domain/types/dto/game/state/QuestionState";
import { type MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { User } from "infrastructure/database/models/User";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { type EventRecord } from "tests/e2e/scenario/EventJournal";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { ScenarioAssertions } from "tests/e2e/scenario/ScenarioAssertions";
import { type ScenarioActor } from "tests/e2e/scenario/ScenarioActor";
import { SocketGameScenarioDriver } from "tests/e2e/scenario/SocketGameScenarioDriver";
import {
  type AcceptedActionProbe
} from "tests/socket/game/utils/SocketGameTestEventUtils";
import { type GameTestSetup, SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { TestUtils } from "tests/utils/TestUtils";

const GAME_NAMESPACE = "/game";

export interface CreateMediaDownloadFlowOptions {
  readonly harness: ServerTestHarness;
  readonly utils: SocketGameTestUtils;
  readonly userRepo: Repository<User>;
  readonly playerCount?: number;
  readonly spectatorCount?: number;
  readonly testUtils?: TestUtils;
}

export interface ExpectedMediaDownloadStatus {
  readonly playerId: number;
  readonly mediaDownloaded: true;
  readonly allPlayersReady: boolean;
  readonly timer:
    | { readonly kind: "none" }
    | { readonly kind: "active"; readonly durationMs: number };
}

export interface MediaDownloadCommandCountExpectation {
  readonly actor?: ScenarioActor;
  readonly afterSequence: number;
  readonly expectedCount: number;
}

export interface PlayerMediaDownloadedExpectation {
  readonly actor: ScenarioActor;
  readonly expected: boolean;
}

type MediaStatusRecord = EventRecord<readonly [MediaDownloadStatusBroadcastData]>;

/**
 * Scenario helper for the Media Download client-contract suite. It exposes
 * small causal actions/assertions and leaves each test responsible for the
 * business sequence it is proving.
 */
export class MediaDownloadFlow {
  private constructor(
    private readonly setup: GameTestSetup,
    private readonly utils: SocketGameTestUtils,
    private readonly timerUtils: TestUtils,
    public readonly scenario: GameScenario,
    public readonly showman: ScenarioActor,
    public readonly players: readonly ScenarioActor[],
    public readonly spectators: readonly ScenarioActor[]
  ) {}

  public static async start(options: CreateMediaDownloadFlowOptions): Promise<MediaDownloadFlow> {
    let setup: GameTestSetup | undefined;
    let scenario: GameScenario | undefined;

    try {
      const createdSetup = await options.utils.setupGameTestEnvironment(
        options.userRepo,
        options.harness.app,
        options.playerCount ?? 2,
        options.spectatorCount ?? 0
      );
      setup = createdSetup;
      const timerUtils =
        options.testUtils ?? new TestUtils(options.harness.app, options.userRepo, options.harness.serverUrl);
      const createdScenario = new GameScenario(new SocketGameScenarioDriver(options.utils));
      scenario = createdScenario;
      const showman = createdScenario.addActor({
        label: "showman",
        socket: createdSetup.showmanSocket,
        namespace: GAME_NAMESPACE,
        userId: createdSetup.showmanUser.id,
        gameId: createdSetup.gameId
      });
      const players = createdSetup.playerSockets.map((socket, index) =>
        createdScenario.addActor({
          label: `player-${index + 1}`,
          socket,
          namespace: GAME_NAMESPACE,
          userId: createdSetup.playerUsers[index].id,
          gameId: createdSetup.gameId
        })
      );
      const spectators = createdSetup.spectatorSockets.map((socket, index) =>
        createdScenario.addActor({
          label: `spectator-${index + 1}`,
          socket,
          namespace: GAME_NAMESPACE,
          gameId: createdSetup.gameId
        })
      );

      return new MediaDownloadFlow(
        createdSetup,
        options.utils,
        timerUtils,
        createdScenario,
        showman,
        players,
        spectators
      );
    } catch (error) {
      const failures = [toError(error)];

      if (scenario) {
        try {
          await scenario.dispose();
        } catch (cleanupError) {
          failures.push(toError(cleanupError));
        }
      }

      if (setup) {
        try {
          await options.utils.cleanupGameClients(setup);
        } catch (cleanupError) {
          failures.push(toError(cleanupError));
        }
      }

      if (failures.length === 1) {
        throw failures[0];
      }

      throw new AggregateError(
        failures,
        `Media download flow startup and cleanup failed: ${failures.map((failure) => failure.message).join("; ")}`
      );
    }
  }

  public get gameId(): string {
    return this.setup.gameId;
  }

  public get assert(): ScenarioAssertions {
    return this.scenario.assert;
  }

  public get allRecipients(): readonly ScenarioActor[] {
    return [this.showman, ...this.players, ...this.spectators];
  }

  public player(index: number): ScenarioActor {
    const actor = this.players[index];
    if (!actor) {
      throw new Error(`Media download player ${index} is not registered`);
    }

    return actor;
  }

  public mark(): number {
    return this.scenario.mark();
  }

  public async pickMediaQuestion(): Promise<void> {
    await this.utils.startGame(this.setup.showmanSocket);
    const questionId = await this.utils.getFirstAvailableQuestionId(this.gameId);
    const afterQuestionPick = this.mark();
    const questionPickProbe = this.scenario.createAcceptedActionProbe({
      gameId: this.gameId,
      actionType: GameActionType.QUESTION_PICK
    });
    const questionDataReceived = observeExpectation(
      Promise.all(
        this.players.map((player) =>
          this.assert.inbound({
            actor: player,
            event: SocketIOGameEvents.QUESTION_DATA,
            timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
            afterSequence: afterQuestionPick
          })
        )
      )
    );

    this.showman.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

    await Promise.all([questionPickProbe.waitForCount(1), questionDataReceived]);
    await this.waitForActionsComplete();
  }

  public emitPlayerDownloaded(actor: ScenarioActor): void {
    actor.emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
  }

  public emitAllPlayersDownloaded(): void {
    this.players.forEach((player) => this.emitPlayerDownloaded(player));
  }

  public emitDuplicateDownloads(actor: ScenarioActor, count: number): void {
    actor.emitMany({ count, event: SocketIOGameEvents.MEDIA_DOWNLOADED });
  }

  public createAcceptedMediaDownloadProbe(actor?: ScenarioActor): AcceptedActionProbe {
    return this.scenario.createAcceptedActionProbe({
      gameId: this.gameId,
      actionType: GameActionType.MEDIA_DOWNLOADED,
      ...(actor
        ? {
            playerId: this.requireActorUserId(actor),
            socketId: this.requireActorSocketId(actor)
          }
        : {})
    });
  }

  public async expireMediaDownloadTimer(): Promise<void> {
    await this.timerUtils.expireTimerAndWaitForAction(
      this.gameId,
      GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED
    );
  }

  public waitForActionsComplete(): Promise<void> {
    return this.assert.waitForActionsComplete({ gameId: this.gameId });
  }

  public expectQuestionState(expectedState: QuestionState): Promise<void> {
    return this.assert.questionState({ gameId: this.gameId, expectedState });
  }

  public expectActiveTimerDuration(expectedDurationMs: number): Promise<void> {
    return this.assert.activeTimerDuration({
      gameId: this.gameId,
      expectedDurationMs
    });
  }

  public expectPlayerMediaDownloaded(
    expectation: PlayerMediaDownloadedExpectation
  ): Promise<void> {
    return this.assert.playerMediaDownloaded({
      gameId: this.gameId,
      actor: expectation.actor,
      expected: expectation.expected
    });
  }

  public async expectMediaReadiness(
    expectations: readonly PlayerMediaDownloadedExpectation[]
  ): Promise<void> {
    await Promise.all(
      expectations.map((expectation) => this.expectPlayerMediaDownloaded(expectation))
    );
  }

  public waitForMediaDownloadStatus(
    actor: ScenarioActor,
    afterSequence: number,
    expected: ExpectedMediaDownloadStatus
  ): Promise<MediaStatusRecord> {
    return observeExpectation(
      this.assert
        .inbound<readonly [MediaDownloadStatusBroadcastData]>({
          actor,
          event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          afterSequence,
          predicate: (eventRecord) => {
            const data = eventRecord.args[0];
            return data.playerId === expected.playerId && data.allPlayersReady === expected.allPlayersReady;
          }
        })
        .then((record) => {
          this.assertCompleteMediaDownloadStatus(record, expected);
          return record;
        })
    );
  }

  public waitForMediaDownloadBroadcast(
    actors: readonly ScenarioActor[],
    afterSequence: number,
    expected: ExpectedMediaDownloadStatus
  ): Promise<readonly MediaStatusRecord[]> {
    return observeExpectation(
      Promise.all(
        actors.map((actor) => this.waitForMediaDownloadStatus(actor, afterSequence, expected))
      )
    );
  }

  /** Used only when concurrent actors make the final player identity unknown until drain. */
  public waitForAllPlayersReadyBroadcast(
    actors: readonly ScenarioActor[],
    afterSequence: number
  ): Promise<readonly MediaStatusRecord[]> {
    return observeExpectation(
      Promise.all(
        actors.map((actor) =>
          this.assert.inbound<readonly [MediaDownloadStatusBroadcastData]>({
            actor,
            event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
            afterSequence,
            predicate: (record) => record.args[0].allPlayersReady === true
          })
        )
      )
    );
  }

  public mediaStatusHistory(actor: ScenarioActor, afterSequence: number): readonly MediaStatusRecord[] {
    return this.assert.records<readonly [MediaDownloadStatusBroadcastData]>({
      actor,
      direction: "inbound",
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      afterSequence
    });
  }

  public assertCompleteMediaDownloadStatus(
    record: MediaStatusRecord,
    expected: ExpectedMediaDownloadStatus
  ): void {
    const data = record.args[0];

    expect(data.playerId).toBe(expected.playerId);
    expect(data.mediaDownloaded).toBe(expected.mediaDownloaded);
    expect(data.allPlayersReady).toBe(expected.allPlayersReady);

    if (expected.timer.kind === "none") {
      expect(data.timer).toBeNull();
      return;
    }

    expect(data.timer).toEqual(
      expect.objectContaining({ durationMs: expected.timer.durationMs })
    );
  }

  public assertAllMediaStatuses(
    records: readonly MediaStatusRecord[],
    expected: ExpectedMediaDownloadStatus
  ): void {
    records.forEach((record) => this.assertCompleteMediaDownloadStatus(record, expected));
  }

  public assertExactMediaStatusCount(
    actor: ScenarioActor,
    afterSequence: number,
    expectedCount: number
  ): void {
    this.assert.expectDirectedEventCount({
      actor,
      direction: "inbound",
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      afterSequence,
      expectedCount
    });
  }

  public assertAcceptedMediaDownloadCount(
    probe: AcceptedActionProbe,
    expectedCount: number,
    actor?: ScenarioActor
  ): ReturnType<AcceptedActionProbe["records"]> {
    const records = probe.records();
    expect(records).toHaveLength(expectedCount);

    for (const record of records) {
      expect(record.gameId).toBe(this.gameId);
      expect(record.actionType).toBe(GameActionType.MEDIA_DOWNLOADED);
      if (actor) {
        expect(record.playerId).toBe(this.requireActorUserId(actor));
        expect(record.socketId).toBe(this.requireActorSocketId(actor));
      }
    }

    return records;
  }

  public assertOutboundMediaDownloadCommands(
    expectation: MediaDownloadCommandCountExpectation
  ): void {
    this.assert.expectOutboundCommandCount({
      actor: expectation.actor,
      event: SocketIOGameEvents.MEDIA_DOWNLOADED,
      afterSequence: expectation.afterSequence,
      expectedCount: expectation.expectedCount
    });
  }

  public expectNoSocketErrors(afterSequence: number): Promise<void> {
    return this.assert.noInbound({
      event: "error",
      durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
      afterSequence,
      description: "media download scenario should not emit socket errors"
    });
  }

  public async cleanup(): Promise<void> {
    const failures: Error[] = [];

    try {
      await this.scenario.dispose();
    } catch (error) {
      failures.push(toError(error));
    }

    try {
      await this.utils.cleanupGameClients(this.setup);
    } catch (error) {
      failures.push(toError(error));
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `Media download flow cleanup failed: ${failures.map((failure) => failure.message).join("; ")}`
      );
    }
  }

  private requireActorUserId(actor: ScenarioActor): number {
    if (actor.userId === undefined) {
      throw new Error(`Scenario actor "${actor.label}" does not have a userId`);
    }

    return actor.userId;
  }

  private requireActorSocketId(actor: ScenarioActor): string {
    if (!actor.socketId) {
      throw new Error(`Scenario actor "${actor.label}" does not have a socketId`);
    }

    return actor.socketId;
  }
}

export async function withMediaDownloadFlow<T>(
  options: CreateMediaDownloadFlowOptions,
  callback: (flow: MediaDownloadFlow) => Promise<T>
): Promise<T> {
  const flow = await MediaDownloadFlow.start(options);
  let result: T | undefined;
  let scenarioFailure: Error | undefined;

  try {
    result = await callback(flow);
  } catch (error) {
    scenarioFailure = toError(error);
  }

  let cleanupFailure: Error | undefined;
  try {
    await flow.cleanup();
  } catch (error) {
    cleanupFailure = toError(error);
  }

  if (scenarioFailure && cleanupFailure) {
    throw new AggregateError(
      [scenarioFailure, cleanupFailure],
      `Media download scenario and cleanup both failed: ${scenarioFailure.message}; ${cleanupFailure.message}`
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Keeps abandoned scenario-derived waits observed without changing their public rejection. */
function observeExpectation<T>(expectation: Promise<T>): Promise<T> {
  void expectation.catch(() => undefined);
  return expectation;
}
