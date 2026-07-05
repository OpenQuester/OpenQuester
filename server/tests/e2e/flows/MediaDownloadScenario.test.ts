import { afterAll, beforeAll, describe, it } from "@jest/globals";

import { GameActionType } from "domain/enums/GameActionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { User } from "infrastructure/database/models/User";
import { MediaDownloadFlow } from "tests/e2e/flows/media-download/MediaDownloadFlow";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

const DUPLICATE_MEDIA_DOWNLOAD_COMMANDS = 15;

describe("Media download scenario POC", () => {
  let harness: ServerTestHarness;

  beforeAll(async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
  });

  afterAll(async () => {
    await harness.stop();
  });

  it("keeps waiting until every player downloads media", async () => {
    const flow = await createFlow(2);

    try {
      await flow.pickMediaQuestion();

      const player = flow.player(0);
      const afterDownload = flow.mark();
      const mediaActionSubmitted = flow.waitForSubmittedMediaDownloads(1);
      const status = flow.expectMediaDownloadStatus(flow.showman, afterDownload, {
        playerId: player.userId,
        allPlayersReady: false
      });

      flow.emitPlayerDownloaded(player);

      await mediaActionSubmitted;
      await status;
      await flow.waitForActionsComplete();

      flow.expectOutboundMediaDownloadCommands({
        actor: player,
        afterSequence: afterDownload,
        expectedCount: 1
      });

      await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
      await flow.expectNoSocketErrors(afterDownload);
    } finally {
      await flow.cleanup();
    }
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

  it("transitions after duplicate burst player and remaining player both download", async () => {
    const flow = await createFlow(2);

    try {
      await flow.pickMediaQuestion();

      const burstActor = flow.player(0);
      const remainingActor = flow.player(1);
      const afterDuplicateBurst = flow.mark();
      const duplicateActionsSubmitted = flow.waitForSubmittedActions(
        DUPLICATE_MEDIA_DOWNLOAD_COMMANDS,
        GameActionType.MEDIA_DOWNLOADED
      );
      const firstStatus = flow.expectMediaDownloadStatus(flow.showman, afterDuplicateBurst, {
        playerId: burstActor.userId,
        allPlayersReady: false
      });

      flow.emitDuplicateDownloads(burstActor, DUPLICATE_MEDIA_DOWNLOAD_COMMANDS);

      await duplicateActionsSubmitted;
      await firstStatus;
      await flow.waitForActionsComplete();
      await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);

      const afterRemainingDownload = flow.mark();
      const remainingActionSubmitted = flow.waitForSubmittedMediaDownloads(1);
      const finalStatusBroadcasts = flow.expectMediaDownloadBroadcast(
        [flow.showman, ...flow.players],
        afterRemainingDownload,
        {
          playerId: remainingActor.userId,
          allPlayersReady: true
        }
      );

      flow.emitPlayerDownloaded(remainingActor);

      await remainingActionSubmitted;
      await finalStatusBroadcasts;
      await flow.waitForActionsComplete();

      flow.expectOutboundMediaDownloadCommands({
        actor: remainingActor,
        afterSequence: afterRemainingDownload,
        expectedCount: 1
      });

      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectNoSocketErrors(afterDuplicateBurst);
    } finally {
      await flow.cleanup();
    }
  });
});

function createFlow(playerCount: number): Promise<MediaDownloadFlow> {
  const utils = new SocketGameTestUtils(harness.serverUrl);
  const userRepo = harness.dataSource.getRepository(User);

  return MediaDownloadFlow.start({
    harness,
    utils,
    userRepo,
    playerCount
  });
}
