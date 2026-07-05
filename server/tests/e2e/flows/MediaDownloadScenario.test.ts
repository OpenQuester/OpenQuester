import { afterAll, beforeAll, describe, it } from "@jest/globals";
import { type Repository } from "typeorm";

import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { type MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { User } from "infrastructure/database/models/User";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { type ScenarioActor } from "tests/e2e/scenario/ScenarioActor";
import { SocketGameScenarioDriver } from "tests/e2e/scenario/SocketGameScenarioDriver";
import { type GameTestSetup, SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const GAME_NAMESPACE = "/game";

describe("Media download scenario POC", () => {
  let harness: ServerTestHarness;
  let utils: SocketGameTestUtils;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    utils = new SocketGameTestUtils(harness.serverUrl);
    userRepo = harness.dataSource.getRepository(User);
  });

  afterAll(async () => {
    await harness.stop();
  });

  it("tracks burst media-download commands through journal, actions, broadcasts, and final state", async () => {
    const context = await createMediaDownloadScenario({ harness, utils, userRepo, playerCount: 2 });

    try {
      await pickMediaQuestion(context);

      const afterDownloadBurst = context.scenario.mark();
      const mediaActionsSubmitted = context.scenario.assert.waitForSubmittedActions({
        gameId: context.setup.gameId,
        expectedCount: context.players.length,
        actionType: GameActionType.MEDIA_DOWNLOADED
      });
      const firstPlayerStatus = expectMediaDownloadStatus(
        context.scenario,
        context.showman,
        afterDownloadBurst,
        {
          playerId: context.players[0].userId,
          allPlayersReady: false
        }
      );
      const finalStatusBroadcasts = context.scenario.assert.broadcast<[MediaDownloadStatusBroadcastData]>({
        actors: [context.showman, ...context.players],
        event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
        afterSequence: afterDownloadBurst,
        predicate: (record) => {
          const data = record.args[0];
          return data.playerId === context.players[1].userId && data.allPlayersReady;
        }
      });

      context.players.forEach((player) => player.emit(SocketIOGameEvents.MEDIA_DOWNLOADED));

      await mediaActionsSubmitted;
      await firstPlayerStatus;
      await finalStatusBroadcasts;
      await context.scenario.assert.waitForActionsComplete({ gameId: context.setup.gameId });

      context.scenario.assert.expectOutboundCommandCount({
        event: SocketIOGameEvents.MEDIA_DOWNLOADED,
        afterSequence: afterDownloadBurst,
        expectedCount: context.players.length
      });

      await context.scenario.assert.questionState({
        gameId: context.setup.gameId,
        expectedState: QuestionState.SHOWING
      });

      await expectNoSocketErrors(context.scenario, afterDownloadBurst);
    } finally {
      await cleanupMediaDownloadScenario(context);
    }
  });

  it("keeps waiting when one player sends a duplicate media-download burst", async () => {
    const context = await createMediaDownloadScenario({ harness, utils, userRepo, playerCount: 2 });

    try {
      await pickMediaQuestion(context);

      const burstActor = context.players[0];
      const afterDownloadBurst = context.scenario.mark();
      const mediaActionsSubmitted = context.scenario.assert.waitForSubmittedActions({
        gameId: context.setup.gameId,
        expectedCount: 15,
        actionType: GameActionType.MEDIA_DOWNLOADED
      });
      const firstStatus = expectMediaDownloadStatus(
        context.scenario,
        context.showman,
        afterDownloadBurst,
        {
          playerId: burstActor.userId,
          allPlayersReady: false
        }
      );

      burstActor.emitMany({
        count: 15,
        event: SocketIOGameEvents.MEDIA_DOWNLOADED
      });

      await mediaActionsSubmitted;
      await firstStatus;
      await context.scenario.assert.waitForActionsComplete({ gameId: context.setup.gameId });

      context.scenario.assert.expectOutboundCommandCount({
        actor: burstActor,
        event: SocketIOGameEvents.MEDIA_DOWNLOADED,
        afterSequence: afterDownloadBurst,
        expectedCount: 15
      });

      await context.scenario.assert.questionState({
        gameId: context.setup.gameId,
        expectedState: QuestionState.MEDIA_DOWNLOADING
      });

      await expectNoSocketErrors(context.scenario, afterDownloadBurst);
    } finally {
      await cleanupMediaDownloadScenario(context);
    }
  });
});

interface CreateMediaDownloadScenarioOptions {
  readonly harness: ServerTestHarness;
  readonly utils: SocketGameTestUtils;
  readonly userRepo: Repository<User>;
  readonly playerCount: number;
}

interface MediaDownloadScenarioContext {
  readonly setup: GameTestSetup;
  readonly utils: SocketGameTestUtils;
  readonly scenario: GameScenario;
  readonly showman: ScenarioActor;
  readonly players: readonly ScenarioActor[];
}

async function createMediaDownloadScenario(
  options: CreateMediaDownloadScenarioOptions
): Promise<MediaDownloadScenarioContext> {
  const setup = await options.utils.setupGameTestEnvironment(
    options.userRepo,
    options.harness.app,
    options.playerCount,
    0
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

  return { setup, utils: options.utils, scenario, showman, players };
}

async function cleanupMediaDownloadScenario(context: MediaDownloadScenarioContext): Promise<void> {
  context.scenario.dispose();
  await context.utils.cleanupGameClients(context.setup);
}

async function pickMediaQuestion(context: MediaDownloadScenarioContext): Promise<void> {
  await context.utils.startGame(context.setup.showmanSocket);
  const questionId = await context.utils.getFirstAvailableQuestionId(context.setup.gameId);

  const afterQuestionPick = context.scenario.mark();
  const questionPickSubmitted = context.scenario.assert.waitForSubmittedActions({
    gameId: context.setup.gameId,
    expectedCount: 1,
    actionType: GameActionType.QUESTION_PICK
  });
  const questionDataReceived = Promise.all(
    context.players.map((player) =>
      context.scenario.assert.inbound({
        actor: player,
        event: SocketIOGameEvents.QUESTION_DATA,
        timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
        afterSequence: afterQuestionPick
      })
    )
  );

  context.showman.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

  await questionPickSubmitted;
  await questionDataReceived;
  await context.scenario.assert.waitForActionsComplete({ gameId: context.setup.gameId });
  await context.scenario.assert.questionState({
    gameId: context.setup.gameId,
    expectedState: QuestionState.MEDIA_DOWNLOADING
  });
}

function expectMediaDownloadStatus(
  scenario: GameScenario,
  actor: ScenarioActor,
  afterSequence: number,
  expected: {
    readonly playerId: number | undefined;
    readonly allPlayersReady: boolean;
  }
): Promise<unknown> {
  return scenario.assert.inbound<[MediaDownloadStatusBroadcastData]>({
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

function expectNoSocketErrors(scenario: GameScenario, afterSequence: number): Promise<void> {
  return scenario.assert.noInbound({
    event: "error",
    durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
    afterSequence,
    description: "media download scenario should not emit socket errors"
  });
}
