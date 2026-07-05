import { type Repository } from "typeorm";

import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { type QuestionState } from "domain/types/dto/game/state/QuestionState";
import { type MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { User } from "infrastructure/database/models/User";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { ScenarioAssertions } from "tests/e2e/scenario/ScenarioAssertions";
import { type ScenarioActor } from "tests/e2e/scenario/ScenarioActor";
import { SocketGameScenarioDriver } from "tests/e2e/scenario/SocketGameScenarioDriver";
import { type GameTestSetup, SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const GAME_NAMESPACE = "/game";

export interface MediaDownloadFlowOptions {
  readonly harness: ServerTestHarness;
  readonly utils: SocketGameTestUtils;
  readonly userRepo: Repository<User>;
  readonly playerCount: number;
  readonly spectatorCount?: number;
}

export interface MediaDownloadStatusExpectation {
  readonly playerId: number | undefined;
  readonly allPlayersReady: boolean;
}

export interface MediaDownloadCommandCountExpectation {
  readonly actor?: ScenarioActor;
  readonly afterSequence: number;
  readonly expectedCount: number;
}

/**
 * Scenario helper for Media Download client-perspective E2E tests.
 *
 * The helper keeps individual test cases focused on business intent while the
 * scenario/journal/driver layer still proves commands, broadcasts, actions, and
 * persisted game state.
 */
export class MediaDownloadFlow {
  private constructor(
    private readonly setup: GameTestSetup,
    private readonly utils: SocketGameTestUtils,
    public readonly scenario: GameScenario,
    public readonly showman: ScenarioActor,
    public readonly players: readonly ScenarioActor[],
    public readonly spectators: readonly ScenarioActor[]
  ) {}

  public static async start(options: MediaDownloadFlowOptions): Promise<MediaDownloadFlow> {
    const setup = await options.utils.setupGameTestEnvironment(
      options.userRepo,
      options.harness.app,
      options.playerCount,
      options.spectatorCount ?? 0
    );
    const scenario = new GameScenario(new SocketGameScenarioDriver(options.utils));
    const showman = scenario.addActor({
      label: "showman",
      socket: setup.showmanSocket,
      namespace: GAME_NAMESPACE,
      userId: setup.showmanUser.id,
      gameId: setup.gameId
    });
    const players = setup.playerSockets.map((socket, index) =>
      scenario.addActor({
        label: `player-${index + 1}`,
        socket,
        namespace: GAME_NAMESPACE,
        userId: setup.playerUsers[index].id,
        gameId: setup.gameId
      })
    );
    const spectators = setup.spectatorSockets.map((socket, index) =>
      scenario.addActor({
        label: `spectator-${index + 1}`,
        socket,
        namespace: GAME_NAMESPACE,
        gameId: setup.gameId
      })
    );

    return new MediaDownloadFlow(setup, options.utils, scenario, showman, players, spectators);
  }

  public get gameId(): string {
    return this.setup.gameId;
  }

  public get assert(): ScenarioAssertions {
    return this.scenario.assert;
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
    const questionPickSubmitted = this.waitForSubmittedActions(1, GameActionType.QUESTION_PICK);
    const questionDataReceived = Promise.all(
      this.players.map((player) =>
        this.assert.inbound({
          actor: player,
          event: SocketIOGameEvents.QUESTION_DATA,
          timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
          afterSequence: afterQuestionPick
        })
      )
    );

    this.showman.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

    await questionPickSubmitted;
    await questionDataReceived;
    await this.waitForActionsComplete();
  }

  public emitPlayerDownloaded(actor: ScenarioActor): void {
    actor.emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
  }

  public emitAllPlayersDownloaded(): void {
    this.players.forEach((player) => this.emitPlayerDownloaded(player));
  }

  public emitDuplicateDownloads(actor: ScenarioActor, count: number): void {
    actor.emitMany({
      count,
      event: SocketIOGameEvents.MEDIA_DOWNLOADED
    });
  }

  public waitForSubmittedMediaDownloads(expectedCount: number): Promise<void> {
    return this.waitForSubmittedActions(expectedCount, GameActionType.MEDIA_DOWNLOADED);
  }

  public waitForSubmittedActions(
    expectedCount: number,
    actionType?: GameActionType
  ): Promise<void> {
    return this.assert.waitForSubmittedActions({
      gameId: this.gameId,
      expectedCount,
      actionType
    });
  }

  public waitForActionsComplete(): Promise<void> {
    return this.assert.waitForActionsComplete({ gameId: this.gameId });
  }

  public expectQuestionState(expectedState: QuestionState): Promise<void> {
    return this.assert.questionState({
      gameId: this.gameId,
      expectedState
    });
  }

  public expectMediaDownloadStatus(
    actor: ScenarioActor,
    afterSequence: number,
    expected: MediaDownloadStatusExpectation
  ): Promise<unknown> {
    return this.assert.inbound<[MediaDownloadStatusBroadcastData]>({
      actor,
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
      afterSequence,
      predicate: (record) => {
        const data = record.args[0];
        return data.playerId === expected.playerId && data.allPlayersReady === expected.allPlayersReady;
      }
    });
  }

  public expectMediaDownloadBroadcast(
    actors: readonly ScenarioActor[],
    afterSequence: number,
    expected: MediaDownloadStatusExpectation
  ): Promise<readonly unknown[]> {
    return this.assert.broadcast<[MediaDownloadStatusBroadcastData]>({
      actors,
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
      afterSequence,
      predicate: (record) => {
        const data = record.args[0];
        return data.playerId === expected.playerId && data.allPlayersReady === expected.allPlayersReady;
      }
    });
  }

  public expectOutboundMediaDownloadCommands(
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
    this.scenario.dispose();
    await this.utils.cleanupGameClients(this.setup);
  }
}
