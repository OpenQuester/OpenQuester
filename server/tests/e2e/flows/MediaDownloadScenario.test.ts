import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type Repository } from "typeorm";

import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { type MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { User } from "infrastructure/database/models/User";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { type ScenarioActor } from "tests/e2e/scenario/ScenarioActor";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
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
    const setup = await utils.setupGameTestEnvironment(userRepo, harness.app, 2, 0);
    const scenario = new GameScenario();

    try {
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

      await utils.startGame(setup.showmanSocket);
      const questionId = await utils.getFirstAvailableQuestionId(setup.gameId);

      const afterQuestionPick = scenario.mark();
      const questionPickSubmitted = utils.waitForSubmittedActions(
        setup.gameId,
        1,
        GameActionType.QUESTION_PICK
      );
      const questionDataReceived = Promise.all(
        players.map((player) =>
          scenario.expectEvent({
            actor: player,
            direction: "inbound",
            event: SocketIOGameEvents.QUESTION_DATA,
            timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
            afterSequence: afterQuestionPick
          })
        )
      );

      showman.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

      await questionPickSubmitted;
      await questionDataReceived;
      await utils.waitForActionsComplete(setup.gameId);

      const stateBeforeDownloads = await utils.getGameState(setup.gameId);
      expect(stateBeforeDownloads?.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);

      const afterDownloadBurst = scenario.mark();
      const mediaActionsSubmitted = utils.waitForSubmittedActions(
        setup.gameId,
        players.length,
        GameActionType.MEDIA_DOWNLOADED
      );
      const firstPlayerStatus = expectMediaDownloadStatus(scenario, showman, afterDownloadBurst, {
        playerId: players[0].userId,
        allPlayersReady: false
      });
      const finalStatusBroadcasts = Promise.all(
        [showman, ...players].map((actor) =>
          expectMediaDownloadStatus(scenario, actor, afterDownloadBurst, {
            playerId: players[1].userId,
            allPlayersReady: true
          })
        )
      );

      players.forEach((player) => player.emit(SocketIOGameEvents.MEDIA_DOWNLOADED));

      await mediaActionsSubmitted;
      await firstPlayerStatus;
      await finalStatusBroadcasts;
      await utils.waitForActionsComplete(setup.gameId);

      const outboundDownloadCommands = scenario.eventHistory().filter(
        (record) =>
          record.direction === "outbound" &&
          record.event === SocketIOGameEvents.MEDIA_DOWNLOADED &&
          record.sequence > afterDownloadBurst
      );
      expect(outboundDownloadCommands).toHaveLength(players.length);

      const stateAfterDownloads = await utils.getGameState(setup.gameId);
      expect(stateAfterDownloads?.questionState).toBe(QuestionState.SHOWING);

      await scenario.expectNoEvent({
        direction: "inbound",
        event: "error",
        durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
        afterSequence: afterDownloadBurst,
        description: "media download burst should not emit socket errors"
      });
    } finally {
      scenario.dispose();
      await utils.cleanupGameClients(setup);
    }
  });
});

function expectMediaDownloadStatus(
  scenario: GameScenario,
  actor: ScenarioActor,
  afterSequence: number,
  expected: {
    readonly playerId: number | undefined;
    readonly allPlayersReady: boolean;
  }
): Promise<unknown> {
  return scenario.expectEvent<[MediaDownloadStatusBroadcastData]>({
    actor,
    direction: "inbound",
    event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
    timeoutMs: TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    afterSequence,
    predicate: (record) => {
      const data = record.args[0];
      return data.playerId === expected.playerId && data.allPlayersReady === expected.allPlayersReady;
    }
  });
}
