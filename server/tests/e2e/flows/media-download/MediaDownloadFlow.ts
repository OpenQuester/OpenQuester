import { expect } from "@jest/globals";
import { container } from "tsyringe";
import { type Repository } from "typeorm";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import {
  MEDIA_DOWNLOAD_TIMEOUT,
  SYSTEM_PLAYER_ID,
  SYSTEM_SOCKET_ID
} from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { type GameAction, type GameActionResult } from "domain/types/action/GameAction";
import { type TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { type PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { type GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { type GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import { type MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import {
  type PlayerKickBroadcastData,
  type PlayerRestrictionBroadcastData,
  type PlayerRestrictionInputData,
  type PlayerRoleChangeBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { ValueUtils } from "domain/utils/ValueUtils";
import { User } from "infrastructure/database/models/User";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { withTimeout } from "tests/e2e/harness/TestPromiseUtils";
import { type EventRecord } from "tests/e2e/scenario/EventJournal";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { type ScenarioActor } from "tests/e2e/scenario/ScenarioActor";
import { type AcceptedActionProbe } from "tests/socket/game/utils/SocketGameTestEventUtils";
import {
  type GameTestSetup,
  SocketGameTestUtils
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { TestUtils } from "tests/utils/TestUtils";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import {
  assertMediaQuestionData,
  assertMediaFixtureFiles,
  assertMediaDownloadStatus
} from "./MediaDownloadAssertions";

export interface CreateMediaDownloadFlowOptions {
  readonly harness: ServerTestHarness;
  readonly utils: SocketGameTestUtils;
  readonly userRepo: Repository<User>;
  readonly playerCount?: number;
  readonly spectatorCount?: number;
  readonly includeMediaQuestionFiles?: boolean;
  readonly testUtils?: TestUtils;
}

export interface ExpectedMediaDownloadStatus {
  readonly playerId: number;
  readonly allPlayersReady: boolean;
  readonly timerDurationMs: number | null;
}

export interface ExpectedMediaPlayerState {
  readonly role: PlayerRole;
  readonly gameStatus: PlayerGameStatus;
  readonly mediaDownloaded?: boolean;
}

interface MediaDownloadCommandCountExpectation {
  readonly actor?: ScenarioActor;
  readonly afterSequence: number;
  readonly expectedCount: number;
}

interface PlayerMediaDownloadedExpectation {
  readonly actor: ScenarioActor;
  readonly expected: boolean;
}

type MediaStatusRecord = EventRecord<readonly [MediaDownloadStatusBroadcastData]>;
type MediaDownloadFlowCompletionMode = "finish" | "abort";

/**
 * Scenario helper for the Media Download client-contract suite. It exposes
 * small causal actions/assertions and leaves each test responsible for the
 * business sequence it is proving.
 */
export class MediaDownloadFlow {
  private completionMode: MediaDownloadFlowCompletionMode | undefined;
  private completionPromise: Promise<void> | undefined;
  private currentQuestionId: number | undefined;
  private expectedQuestionFiles: readonly PackageQuestionFileDTO[] = [];

  private constructor(
    private readonly setup: GameTestSetup,
    private readonly utils: SocketGameTestUtils,
    private readonly timerUtils: TestUtils,
    private readonly scenario: GameScenario,
    public readonly showman: ScenarioActor,
    private readonly players: readonly ScenarioActor[],
    private readonly spectators: readonly ScenarioActor[],
    private readonly includesMediaQuestionFiles: boolean,
    private readonly detachScenario: () => void
  ) {}

  public static async start(options: CreateMediaDownloadFlowOptions): Promise<MediaDownloadFlow> {
    let setup: GameTestSetup | undefined;
    let scenario: GameScenario | undefined;
    let detachScenario: (() => void) | undefined;

    try {
      const createdSetup = await options.utils.setupGameTestEnvironment(
        options.userRepo,
        options.harness.app,
        options.playerCount ?? 2,
        options.spectatorCount ?? 0,
        true,
        0,
        options.includeMediaQuestionFiles ?? true
      );
      setup = createdSetup;
      const timerUtils =
        options.testUtils ??
        new TestUtils(
          options.harness.app,
          options.userRepo,
          options.harness.serverUrl,
          options.utils
        );
      const createdScenario = new GameScenario(options.utils);
      scenario = createdScenario;
      const showman = createdScenario.addActor({
        label: "showman",
        socket: createdSetup.showmanSocket,
        userId: createdSetup.showmanUser.id,
        gameId: createdSetup.gameId
      });
      const players = createdSetup.playerSockets.map((socket, index) =>
        createdScenario.addActor({
          label: `player-${index + 1}`,
          socket,
          userId: createdSetup.playerUsers[index].id,
          gameId: createdSetup.gameId
        })
      );
      const spectators = createdSetup.spectatorSockets.map((socket, index) =>
        createdScenario.addActor({
          label: `spectator-${index + 1}`,
          socket,
          gameId: createdSetup.gameId
        })
      );

      detachScenario = options.utils.useScenario(createdScenario);
      return new MediaDownloadFlow(
        createdSetup,
        options.utils,
        timerUtils,
        createdScenario,
        showman,
        players,
        spectators,
        options.includeMediaQuestionFiles ?? true,
        detachScenario
      );
    } catch (error) {
      const failures = [toError(error)];

      if (scenario) {
        try {
          await scenario.abort();
        } catch (cleanupError) {
          failures.push(toError(cleanupError));
        }
      }

      try {
        detachScenario?.();
      } catch (cleanupError) {
        failures.push(toError(cleanupError));
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

  private get gameId(): string {
    return this.setup.gameId;
  }

  public get allRecipients(): readonly ScenarioActor[] {
    return [this.showman, ...this.players, ...this.spectators];
  }

  public get allPlayers(): readonly ScenarioActor[] {
    return [...this.players];
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

  public async startGame(): Promise<void> {
    await this.utils.startGame(this.setup.showmanSocket);
  }

  public async pickMediaQuestion(): Promise<number> {
    await this.startGame();
    const questionId = await this.utils.getFirstAvailableQuestionId(this.gameId);
    this.currentQuestionId = questionId;
    const question = await container.resolve(PackageStore).getQuestion(this.gameId, questionId);
    expect(question?.id).toBe(questionId);
    this.expectedQuestionFiles = question?.questionFiles ?? [];
    assertMediaFixtureFiles(this.expectedQuestionFiles, this.includesMediaQuestionFiles);
    const afterQuestionPick = this.mark();
    const questionPickProbe = this.scenario.createAcceptedActionProbe({
      gameId: this.gameId,
      actionType: GameActionType.QUESTION_PICK
    });
    const questionData = this.waitForQuestionData(this.allRecipients, afterQuestionPick);
    const accepted = questionPickProbe.waitForCount(1);

    this.showman.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

    await Promise.all([accepted, questionData]);
    await this.waitForActionsComplete();
    // Receiving valid links must not hide a skipped readiness barrier.
    await this.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
    await this.expectActiveTimerDuration(MEDIA_DOWNLOAD_TIMEOUT);
    for (const actor of this.allRecipients) {
      this.assertExactInboundEventCount(
        actor,
        SocketIOGameEvents.QUESTION_PICK,
        afterQuestionPick,
        0
      );
    }
    this.assertExactQuestionDataCount(this.allRecipients, afterQuestionPick, 1);

    return afterQuestionPick;
  }

  private waitForQuestionData(
    actors: readonly ScenarioActor[],
    afterSequence: number
  ): Promise<readonly EventRecord<readonly [GameQuestionDataEventPayload]>[]> {
    const questionId = this.requireCurrentQuestionId();
    return this.scenario.trackExpectation(
      this.scenario.assert
        .broadcast<readonly [GameQuestionDataEventPayload]>({
          actors,
          event: SocketIOGameEvents.QUESTION_DATA,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          afterSequence,
          predicate: ({ args: [payload] }) => payload.data.id === questionId
        })
        .then((records) => {
          records.forEach(({ actorLabel, args: [payload] }) => {
            assertMediaQuestionData(payload, questionId, this.expectedQuestionFiles);
            expect(payload.data.text).toBe("Simple question text");
            if (actorLabel === this.showman.label) {
              expect(payload.data).toHaveProperty("answerText", "Simple answer");
            } else {
              expect(payload.data).not.toHaveProperty("answerText");
            }
          });
          return records;
        }),
      `validated question data for actors ${actors.map((actor) => `"${actor.label}"`).join(", ")}`
    );
  }

  public assertNoAdditionalQuestionData(
    actors: readonly ScenarioActor[],
    afterSequence: number
  ): void {
    actors.forEach((actor) =>
      this.assertExactInboundEventCount(actor, SocketIOGameEvents.QUESTION_DATA, afterSequence, 0)
    );
  }

  public assertExactQuestionDataCount(
    actors: readonly ScenarioActor[],
    afterSequence: number,
    expectedCount: number
  ): void {
    actors.forEach((actor) =>
      this.assertExactInboundEventCount(
        actor,
        SocketIOGameEvents.QUESTION_DATA,
        afterSequence,
        expectedCount
      )
    );
  }

  public emitPlayerDownloaded(actor: ScenarioActor): void {
    actor.emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
  }

  public emitPlayerLeave(actor: ScenarioActor): void {
    actor.emit(SocketIOGameEvents.LEAVE);
  }

  public disconnectPlayer(actor: ScenarioActor): void {
    actor.disconnect();
  }

  public emitPlayerKick(actor: ScenarioActor): void {
    this.showman.emit(SocketIOGameEvents.PLAYER_KICKED, {
      playerId: this.requireActorUserId(actor)
    });
  }

  public emitPlayerRestriction(actor: ScenarioActor): void {
    this.showman.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
      playerId: this.requireActorUserId(actor),
      muted: false,
      restricted: true,
      banned: false
    } satisfies PlayerRestrictionInputData);
  }

  public createAcceptedActorActionProbe(
    actor: ScenarioActor,
    actionType: GameActionType
  ): AcceptedActionProbe {
    return this.scenario.createAcceptedActionProbe({
      gameId: this.gameId,
      actionType,
      playerId: this.requireActorUserId(actor),
      socketId: this.requireActorSocketId(actor)
    });
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

  public createAcceptedMediaTimeoutProbe(): AcceptedActionProbe {
    return this.scenario.createAcceptedActionProbe({
      gameId: this.gameId,
      actionType: GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED
    });
  }

  public submitStaleMediaTimeout(expirationTime: Date): Promise<GameActionResult> {
    const action: GameAction<TimerActionPayload> = {
      id: ValueUtils.generateUUID(),
      type: GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED,
      gameId: this.gameId,
      playerId: SYSTEM_PLAYER_ID,
      socketId: SYSTEM_SOCKET_ID,
      timestamp: new Date(),
      payload: {
        timerKey: timerKey(this.gameId),
        questionState: QuestionState.MEDIA_DOWNLOADING,
        expirationTime
      }
    };

    return container.resolve(GameActionExecutor).submitAction(action);
  }

  public async expireMediaDownloadTimer(): Promise<void> {
    await this.timerUtils.expireTimerAndWaitForAction(
      this.gameId,
      GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED
    );
  }

  public waitForActionsComplete(): Promise<void> {
    return this.scenario.assert.waitForActionsComplete({ gameId: this.gameId });
  }

  public expectQuestionState(expectedState: QuestionState): Promise<void> {
    return this.scenario.assert.questionState({ gameId: this.gameId, expectedState });
  }

  public expectActiveTimerDuration(expectedDurationMs: number): Promise<void> {
    return this.scenario.assert.activeTimerDuration({
      gameId: this.gameId,
      expectedDurationMs
    });
  }

  public expectNoActiveTimer(): Promise<void> {
    return this.scenario.assert.noActiveTimer({ gameId: this.gameId });
  }

  private expectPlayerMediaDownloaded(
    expectation: PlayerMediaDownloadedExpectation
  ): Promise<void> {
    return this.scenario.assert.playerMediaDownloaded({
      gameId: this.gameId,
      actor: expectation.actor,
      expected: expectation.expected
    });
  }

  public async expectMediaReadiness(
    expectations: readonly PlayerMediaDownloadedExpectation[]
  ): Promise<void> {
    await this.scenario.trackExpectation(
      Promise.all(
        expectations.map((expectation) => this.expectPlayerMediaDownloaded(expectation))
      ).then(() => undefined),
      `media readiness for actors ${expectations
        .map((expectation) => `"${expectation.actor.label}"`)
        .join(", ")}`
    );
  }

  public waitForMediaDownloadStatus(
    actor: ScenarioActor,
    afterSequence: number,
    expected: ExpectedMediaDownloadStatus
  ): Promise<MediaStatusRecord> {
    return this.scenario.trackExpectation(
      this.scenario.assert
        .inbound<readonly [MediaDownloadStatusBroadcastData]>({
          actor,
          event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          afterSequence,
          predicate: (eventRecord) => {
            const data = eventRecord.args[0];
            return (
              data.playerId === expected.playerId &&
              data.allPlayersReady === expected.allPlayersReady
            );
          }
        })
        .then((record) => {
          this.assertCompleteMediaDownloadStatus(record, expected);
          return record;
        }),
      `validated media download status for actor "${actor.label}"`
    );
  }

  public waitForMediaDownloadBroadcast(
    actors: readonly ScenarioActor[],
    afterSequence: number,
    expected: ExpectedMediaDownloadStatus
  ): Promise<readonly MediaStatusRecord[]> {
    return this.scenario.trackExpectation(
      this.scenario.assert
        .broadcast<readonly [MediaDownloadStatusBroadcastData]>({
          actors,
          event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          afterSequence,
          predicate: (record) => {
            const data = record.args[0];
            return (
              data.playerId === expected.playerId &&
              data.allPlayersReady === expected.allPlayersReady
            );
          }
        })
        .then((records) => {
          this.assertAllMediaStatuses(records, expected);
          return records;
        }),
      `validated media download broadcast for actors ${actors
        .map((actor) => `"${actor.label}"`)
        .join(", ")}`
    );
  }

  public waitForLeaveBroadcast(
    actors: readonly ScenarioActor[],
    afterSequence: number,
    actor: ScenarioActor
  ): Promise<readonly EventRecord<readonly [GameLeaveEventPayload]>[]> {
    const user = this.requireActorUserId(actor);
    return this.scenario.trackExpectation(
      this.scenario.assert
        .broadcast<readonly [GameLeaveEventPayload]>({
          actors,
          event: SocketIOGameEvents.LEAVE,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          afterSequence,
          predicate: ({ args: [payload] }) => payload.user === user
        })
        .then((records) => {
          records.forEach(({ args: [payload] }) => expect(payload).toEqual({ user }));
          return records;
        }),
      `validated leave broadcast for actor "${actor.label}"`
    );
  }

  public waitForKickBroadcast(
    actors: readonly ScenarioActor[],
    afterSequence: number,
    actor: ScenarioActor
  ): Promise<readonly EventRecord<readonly [PlayerKickBroadcastData]>[]> {
    const playerId = this.requireActorUserId(actor);
    return this.scenario.trackExpectation(
      this.scenario.assert
        .broadcast<readonly [PlayerKickBroadcastData]>({
          actors,
          event: SocketIOGameEvents.PLAYER_KICKED,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          afterSequence,
          predicate: ({ args: [payload] }) => payload.playerId === playerId
        })
        .then((records) => {
          records.forEach(({ args: [payload] }) => expect(payload).toEqual({ playerId }));
          return records;
        }),
      `validated kick broadcast for actor "${actor.label}"`
    );
  }

  public waitForRestrictionBroadcast(
    actors: readonly ScenarioActor[],
    afterSequence: number,
    actor: ScenarioActor
  ): Promise<readonly EventRecord<readonly [PlayerRestrictionBroadcastData]>[]> {
    const expected: PlayerRestrictionBroadcastData = {
      playerId: this.requireActorUserId(actor),
      muted: false,
      restricted: true,
      banned: false
    };
    return this.scenario.trackExpectation(
      this.scenario.assert
        .broadcast<readonly [PlayerRestrictionBroadcastData]>({
          actors,
          event: SocketIOGameEvents.PLAYER_RESTRICTED,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          afterSequence,
          predicate: ({ args: [payload] }) => payload.playerId === expected.playerId
        })
        .then((records) => {
          records.forEach(({ args: [payload] }) => expect(payload).toEqual(expected));
          return records;
        }),
      `validated restriction broadcast for actor "${actor.label}"`
    );
  }

  public waitForSpectatorRoleBroadcast(
    actors: readonly ScenarioActor[],
    afterSequence: number,
    actor: ScenarioActor
  ): Promise<readonly EventRecord<readonly [PlayerRoleChangeBroadcastData]>[]> {
    const playerId = this.requireActorUserId(actor);
    return this.scenario.trackExpectation(
      this.scenario.assert
        .broadcast<readonly [PlayerRoleChangeBroadcastData]>({
          actors,
          event: SocketIOGameEvents.PLAYER_ROLE_CHANGE,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          afterSequence,
          predicate: ({ args: [payload] }) => payload.playerId === playerId
        })
        .then((records) => {
          records.forEach(({ args: [payload] }) => {
            expect(payload.playerId).toBe(playerId);
            expect(payload.newRole).toBe(PlayerRole.SPECTATOR);
            expect(payload.players).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  meta: expect.objectContaining({ id: playerId }),
                  role: PlayerRole.SPECTATOR
                })
              ])
            );
          });
          return records;
        }),
      `validated spectator role broadcast for actor "${actor.label}"`
    );
  }

  /** Used only when concurrent actors make the final player identity unknown until drain. */
  public waitForAllPlayersReadyBroadcast(
    actors: readonly ScenarioActor[],
    afterSequence: number
  ): Promise<readonly MediaStatusRecord[]> {
    return this.scenario.assert.broadcast<readonly [MediaDownloadStatusBroadcastData]>({
      actors,
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
      afterSequence,
      predicate: (record) => record.args[0].allPlayersReady === true
    });
  }

  public mediaStatusHistory(
    actor: ScenarioActor,
    afterSequence: number
  ): readonly MediaStatusRecord[] {
    return this.scenario.assert.records<readonly [MediaDownloadStatusBroadcastData]>({
      actor,
      direction: "inbound",
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      afterSequence
    });
  }

  private assertCompleteMediaDownloadStatus(
    record: MediaStatusRecord,
    expected: ExpectedMediaDownloadStatus
  ): void {
    assertMediaDownloadStatus(
      record.args[0],
      expected.playerId,
      expected.allPlayersReady,
      expected.timerDurationMs
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
    this.scenario.assert.expectDirectedEventCount({
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

  public assertAcceptedActorActionCount(
    probe: AcceptedActionProbe,
    expectedCount: number,
    actionType: GameActionType,
    actor: ScenarioActor,
    socketId = this.requireActorSocketId(actor)
  ): ReturnType<AcceptedActionProbe["records"]> {
    const records = probe.records();
    expect(records).toHaveLength(expectedCount);

    for (const record of records) {
      expect(record.gameId).toBe(this.gameId);
      expect(record.actionType).toBe(actionType);
      expect(record.playerId).toBe(this.requireActorUserId(actor));
      expect(record.socketId).toBe(socketId);
    }

    return records;
  }

  public assertOutboundMediaDownloadCommands(
    expectation: MediaDownloadCommandCountExpectation
  ): void {
    this.scenario.assert.expectOutboundCommandCount({
      actor: expectation.actor,
      event: SocketIOGameEvents.MEDIA_DOWNLOADED,
      afterSequence: expectation.afterSequence,
      expectedCount: expectation.expectedCount
    });
  }

  public assertOutboundCommandCount(
    actor: ScenarioActor,
    event: string,
    afterSequence: number,
    expectedCount: number
  ): void {
    this.scenario.assert.expectOutboundCommandCount({
      actor,
      event,
      afterSequence,
      expectedCount
    });
  }

  public assertExactInboundEventCount(
    actor: ScenarioActor,
    event: string,
    afterSequence: number,
    expectedCount: number
  ): void {
    this.scenario.assert.expectDirectedEventCount({
      actor,
      direction: "inbound",
      event,
      afterSequence,
      expectedCount
    });
  }

  public assertInboundEventOrder(
    actor: ScenarioActor,
    afterSequence: number,
    events: readonly string[]
  ): void {
    const records = this.scenario.assert.records({
      actor,
      direction: "inbound",
      afterSequence
    });
    let previousSequence = afterSequence;

    for (const event of events) {
      const record = records.find(
        (candidate) => candidate.event === event && candidate.sequence > previousSequence
      );
      expect(record).toBeDefined();
      previousSequence = record!.sequence;
    }
  }

  public expectPlayerState(
    actor: ScenarioActor,
    expected: ExpectedMediaPlayerState
  ): Promise<void> {
    const userId = this.requireActorUserId(actor);
    const description = `player state for actor "${actor.label}"`;
    return this.scenario.trackExpectation(
      withTimeout(
        (async () => {
          const game = await this.utils.getGameFromGameService(this.gameId);
          const player = game.getPlayer(userId, { fetchDisconnected: true });

          expect(player).not.toBeNull();
          expect(player?.role).toBe(expected.role);
          expect(player?.gameStatus).toBe(expected.gameStatus);
          if (expected.mediaDownloaded !== undefined) {
            expect(Boolean(player?.mediaDownloaded)).toBe(expected.mediaDownloaded);
          }
        })(),
        TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
        description
      ),
      description
    );
  }

  public assertCriticalEventOrder(actor: ScenarioActor, afterSequence: number): void {
    const records = this.scenario.assert.records({ afterSequence });
    const mediaDownloaded = records.find(
      (record) =>
        record.actorLabel === actor.label &&
        record.direction === "outbound" &&
        record.event === SocketIOGameEvents.MEDIA_DOWNLOADED
    );
    const status = records.find(
      (record) =>
        record.actorLabel === actor.label &&
        record.direction === "inbound" &&
        record.event === SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
    );
    const questionData = records.find(
      (record) =>
        record.actorLabel === actor.label &&
        record.direction === "inbound" &&
        record.event === SocketIOGameEvents.QUESTION_DATA
    );

    expect(questionData).toBeDefined();
    expect(mediaDownloaded).toBeDefined();
    expect(status).toBeDefined();
    expect(questionData!.sequence).toBeLessThan(mediaDownloaded!.sequence);
    expect(mediaDownloaded!.sequence).toBeLessThan(status!.sequence);
  }

  public expectNoMediaDownloadStatus(
    actors: readonly ScenarioActor[],
    afterSequence: number,
    playerId?: number
  ): Promise<void> {
    return this.scenario.assert.noInboundMany<readonly [MediaDownloadStatusBroadcastData]>({
      actors,
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
      afterSequence,
      description: "media download status should remain quiet",
      ...(playerId === undefined
        ? {}
        : { predicate: ({ args: [status] }) => status.playerId === playerId })
    });
  }

  public expectNoReadinessCompletion(
    actors: readonly ScenarioActor[],
    afterSequence: number
  ): Promise<void> {
    return this.scenario.assert.noInboundMany<readonly [MediaDownloadStatusBroadcastData]>({
      actors,
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      afterSequence,
      durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
      predicate: ({ args: [status] }) => status.allPlayersReady,
      description: "readiness must not complete while an active player is waiting"
    });
  }

  public expectNoSocketErrors(
    actors: readonly ScenarioActor[],
    afterSequence: number
  ): Promise<void> {
    return this.scenario.assert.noInboundMany({
      actors,
      event: "error",
      durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
      afterSequence,
      description: "media download scenario should not emit socket errors"
    });
  }

  public finish(): Promise<void> {
    return this.complete("finish");
  }

  public abort(): Promise<void> {
    return this.complete("abort");
  }

  private complete(mode: MediaDownloadFlowCompletionMode): Promise<void> {
    if (this.completionPromise) {
      if (this.completionMode !== mode) {
        throw new Error(
          `Media download flow completion already started in ${this.completionMode} mode`
        );
      }

      return this.completionPromise;
    }

    this.completionMode = mode;
    this.completionPromise = this.completeInternal(mode);
    return this.completionPromise;
  }

  private async completeInternal(mode: MediaDownloadFlowCompletionMode): Promise<void> {
    const failures: Error[] = [];

    try {
      await (mode === "finish" ? this.scenario.finish() : this.scenario.abort());
    } catch (error) {
      failures.push(toError(error));
    }

    try {
      this.detachScenario();
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
        `Media download flow ${mode} failed: ${failures
          .map((failure) => failure.message)
          .join("; ")}`
      );
    }
  }

  private requireActorUserId(actor: ScenarioActor): number {
    if (actor.userId === undefined) {
      throw new Error(`Scenario actor "${actor.label}" does not have a userId`);
    }

    return actor.userId;
  }

  private requireCurrentQuestionId(): number {
    if (this.currentQuestionId === undefined) {
      throw new Error("Media question has not been picked");
    }

    return this.currentQuestionId;
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

  if (scenarioFailure) {
    try {
      await flow.abort();
    } catch (cleanupError) {
      const cleanupFailure = toError(cleanupError);
      throw new AggregateError(
        [scenarioFailure, cleanupFailure],
        `Media download scenario and cleanup both failed: ${scenarioFailure.message}; ${cleanupFailure.message}`
      );
    }

    throw scenarioFailure;
  }

  await flow.finish();
  return result as T;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
