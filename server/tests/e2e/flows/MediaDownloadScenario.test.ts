import { afterAll, beforeAll, describe, it } from "@jest/globals";
import { type Repository } from "typeorm";

import { GameActionType } from "domain/enums/GameActionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { User } from "infrastructure/database/models/User";
import { MediaDownloadFlow } from "tests/e2e/flows/media-download/MediaDownloadFlow";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

const DUPLICATE_MEDIA_DOWNLOAD_COMMANDS = 15;

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

  it("tracks media-download commands through actions, broadcasts, journal, and final state", async () => {
    const flow = await createFlow(2);

    try {
      await flow.pickMediaQuestion();

      const afterDownloadBurst = flow.mark();
      const mediaActionsSubmitted = flow.waitForSubmittedMediaDownloads(flow.players.length);
      const firstPlayerStatus = flow.expectMediaDownloadStatus(flow.showman, afterDownloadBurst, {
        playerId: flow.player(0).userId,
        allPlayersReady: false
      });
      const finalStatusBroadcasts = flow.expectMediaDownloadBroadcast(
        [flow.showman, ...flow.players],
        afterDownloadBurst,
        {
          playerId: flow.player(1).userId,
          allPlayersReady: true
        }
      );

      flow.emitAllPlayersDownloaded();

      await mediaActionsSubmitted;
      await firstPlayerStatus;
      await finalStatusBroadcasts;
      await flow.waitForActionsComplete();

      flow.expectOutboundMediaDownloadCommands({
        afterSequence: afterDownloadBurst,
        expectedCount: flow.players.length
      });

      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectNoSocketErrors(afterDownloadBurst);
    } finally {
      await flow.cleanup();
    }
  });

  it("keeps waiting when one player sends a duplicate media-download burst", async () => {
    const flow = await createFlow(2);

    try {
      await flow.pickMediaQuestion();

      const burstActor = flow.player(0);
      const afterDownloadBurst = flow.mark();
      const mediaActionsSubmitted = flow.waitForSubmittedActions(
        DUPLICATE_MEDIA_DOWNLOAD_COMMANDS,
        GameActionType.MEDIA_DOWNLOADED
      );
      const firstStatus = flow.expectMediaDownloadStatus(flow.showman, afterDownloadBurst, {
        playerId: burstActor.userId,
        allPlayersReady: false
      });

      flow.emitDuplicateDownloads(burstActor, DUPLICATE_MEDIA_DOWNLOAD_COMMANDS);

      await mediaActionsSubmitted;
      await firstStatus;
      await flow.waitForActionsComplete();

      flow.expectOutboundMediaDownloadCommands({
        actor: burstActor,
        afterSequence: afterDownloadBurst,
        expectedCount: DUPLICATE_MEDIA_DOWNLOAD_COMMANDS
      });

      await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
      await flow.expectNoSocketErrors(afterDownloadBurst);
    } finally {
      await flow.cleanup();
    }
  });
});

function createFlow(playerCount: number): Promise<MediaDownloadFlow> {
  return MediaDownloadFlow.start({
    harness,
    utils,
    userRepo,
    playerCount
  });
}
