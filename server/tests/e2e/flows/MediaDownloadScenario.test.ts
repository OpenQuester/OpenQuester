import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";

import {
  GAME_QUESTION_ANSWER_TIME,
  MEDIA_DOWNLOAD_TIMEOUT,
  SYSTEM_PLAYER_ID
} from "domain/constants/game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { User } from "infrastructure/database/models/User";
import {
  type CreateMediaDownloadFlowOptions,
  type ExpectedMediaDownloadStatus,
  MediaDownloadFlow,
  withMediaDownloadFlow
} from "tests/e2e/flows/media-download/MediaDownloadFlow";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

const DUPLICATE_MEDIA_DOWNLOAD_COMMANDS = 15;

let harness: ServerTestHarness | undefined;

describe("Media Download client-contract golden scenarios", () => {
  beforeAll(async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
  });

  afterEach(async () => {
    if (harness) {
      await harness.resetState();
    }
  });

  afterAll(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  it("transitions a single player immediately to showing", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 1 }), async (flow) => {
      const afterQuestionPick = await flow.pickMediaQuestion();
      await assertInitialMediaState(flow);

      const player = flow.player(0);
      const afterDownload = flow.mark();
      const probe = flow.createAcceptedMediaDownloadProbe(player);
      const status = expectedStatus(player.userId!, true, GAME_QUESTION_ANSWER_TIME);
      const statusBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterDownload,
        status
      );
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterDownload);

      flow.emitPlayerDownloaded(player);

      await Promise.all([probe.waitForCount(1), statusBroadcasts, questionReveal]);
      await flow.waitForActionsComplete();

      flow.assertOutboundMediaDownloadCommands({
        actor: player,
        afterSequence: afterDownload,
        expectedCount: 1
      });
      flow.assertAcceptedMediaDownloadCount(probe, 1, player);
      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterDownload, 1)
      );
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterDownload, 1);
      await flow.expectMediaReadiness([{ actor: player, expected: true }]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(GAME_QUESTION_ANSWER_TIME);
      flow.assertCriticalEventOrder(player, afterQuestionPick);
      await flow.expectNoSocketErrors(flow.allRecipients, afterDownload);
    });
  });

  it("keeps the media timer active while readiness is partial", async () => {
    await withMediaDownloadFlow(createFlowOptions(), async (flow) => {
      await flow.pickMediaQuestion();
      await assertInitialMediaState(flow);

      const downloadedPlayer = flow.player(0);
      const waitingPlayer = flow.player(1);
      const afterDownload = flow.mark();
      const probe = flow.createAcceptedMediaDownloadProbe(downloadedPlayer);
      const status = expectedStatus(downloadedPlayer.userId!, false, null);
      const statusBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterDownload,
        status
      );

      flow.emitPlayerDownloaded(downloadedPlayer);

      await Promise.all([probe.waitForCount(1), statusBroadcasts]);
      await flow.waitForActionsComplete();

      flow.assertOutboundMediaDownloadCommands({
        actor: downloadedPlayer,
        afterSequence: afterDownload,
        expectedCount: 1
      });
      flow.assertAcceptedMediaDownloadCount(probe, 1, downloadedPlayer);
      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterDownload, 1)
      );
      flow.assertNoQuestionReveal(flow.allRecipients, afterDownload);
      await flow.expectMediaReadiness([
        { actor: downloadedPlayer, expected: true },
        { actor: waitingPlayer, expected: false }
      ]);
      await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
      await flow.expectActiveTimerDuration(MEDIA_DOWNLOAD_TIMEOUT);
      await flow.expectNoSocketErrors(flow.allRecipients, afterDownload);
    });
  });

  it("handles concurrent two-player completion without assuming socket arrival order", async () => {
    await withMediaDownloadFlow(createFlowOptions({ spectatorCount: 1 }), async (flow) => {
      await flow.pickMediaQuestion();
      await assertInitialMediaState(flow);

      const firstPlayer = flow.player(0);
      const secondPlayer = flow.player(1);
      const afterDownloadBurst = flow.mark();
      const probe = flow.createAcceptedMediaDownloadProbe();
      const finalReadyBroadcasts = flow.waitForAllPlayersReadyBroadcast(
        flow.allRecipients,
        afterDownloadBurst
      );
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterDownloadBurst);

      flow.emitPlayerDownloaded(firstPlayer);
      flow.emitPlayerDownloaded(secondPlayer);

      await Promise.all([probe.waitForCount(2), finalReadyBroadcasts, questionReveal]);
      await flow.waitForActionsComplete();

      flow.assertOutboundMediaDownloadCommands({
        afterSequence: afterDownloadBurst,
        expectedCount: 2
      });
      const acceptedActions = flow.assertAcceptedMediaDownloadCount(probe, 2);
      expect(
        acceptedActions.map((action) => `${action.playerId}:${action.socketId}`).sort()
      ).toEqual(
        [
          `${firstPlayer.userId}:${firstPlayer.socketId}`,
          `${secondPlayer.userId}:${secondPlayer.socketId}`
        ].sort()
      );

      for (const recipient of flow.allRecipients) {
        const records = flow.mediaStatusHistory(recipient, afterDownloadBurst);
        const statuses = records.map((record) => record.args[0]);

        expect(statuses).toHaveLength(2);
        expect(statuses.map((status) => status.playerId).sort()).toEqual(
          [firstPlayer.userId, secondPlayer.userId].sort()
        );
        expect(statuses[0]).toMatchObject({
          mediaDownloaded: true,
          allPlayersReady: false,
          timer: null
        });
        expect(statuses[1].mediaDownloaded).toBe(true);
        expect(statuses[1].allPlayersReady).toBe(true);
        expect(statuses[1].timer?.durationMs).toBe(GAME_QUESTION_ANSWER_TIME);
      }
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterDownloadBurst, 1);

      await flow.expectMediaReadiness([
        { actor: firstPlayer, expected: true },
        { actor: secondPlayer, expected: true }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(GAME_QUESTION_ANSWER_TIME);
      await flow.expectNoSocketErrors(flow.allRecipients, afterDownloadBurst);
    });
  });

  it("settles 15 duplicate confirmations before the remaining player completes", async () => {
    await withMediaDownloadFlow(createFlowOptions(), async (flow) => {
      await flow.pickMediaQuestion();
      await assertInitialMediaState(flow);

      const duplicatePlayer = flow.player(0);
      const remainingPlayer = flow.player(1);
      const afterDuplicates = flow.mark();
      const duplicateProbe = flow.createAcceptedMediaDownloadProbe(duplicatePlayer);
      const firstPartialStatus = flow.waitForMediaDownloadStatus(
        flow.showman,
        afterDuplicates,
        expectedStatus(duplicatePlayer.userId!, false, null)
      );

      duplicatePlayer.emitMany({
        count: DUPLICATE_MEDIA_DOWNLOAD_COMMANDS,
        event: SocketIOGameEvents.MEDIA_DOWNLOADED
      });

      await Promise.all([
        duplicateProbe.waitForCount(DUPLICATE_MEDIA_DOWNLOAD_COMMANDS),
        firstPartialStatus
      ]);
      await flow.waitForActionsComplete();

      flow.assertOutboundMediaDownloadCommands({
        actor: duplicatePlayer,
        afterSequence: afterDuplicates,
        expectedCount: DUPLICATE_MEDIA_DOWNLOAD_COMMANDS
      });
      const duplicateActions = flow.assertAcceptedMediaDownloadCount(
        duplicateProbe,
        DUPLICATE_MEDIA_DOWNLOAD_COMMANDS,
        duplicatePlayer
      );
      expect(new Set(duplicateActions.map((action) => action.actionId)).size).toBe(
        DUPLICATE_MEDIA_DOWNLOAD_COMMANDS
      );
      flow.assertExactMediaStatusCount(
        flow.showman,
        afterDuplicates,
        DUPLICATE_MEDIA_DOWNLOAD_COMMANDS
      );
      const duplicateStatuses = flow.mediaStatusHistory(flow.showman, afterDuplicates);
      flow.assertAllMediaStatuses(
        duplicateStatuses,
        expectedStatus(duplicatePlayer.userId!, false, null)
      );
      expect(duplicateStatuses.some((record) => record.args[0].allPlayersReady)).toBe(false);
      expect(duplicateStatuses.some((record) => record.args[0].playerId === SYSTEM_PLAYER_ID)).toBe(
        false
      );
      flow.assertNoQuestionReveal(flow.allRecipients, afterDuplicates);
      await flow.expectMediaReadiness([
        { actor: duplicatePlayer, expected: true },
        { actor: remainingPlayer, expected: false }
      ]);
      await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
      await flow.expectActiveTimerDuration(MEDIA_DOWNLOAD_TIMEOUT);
      await flow.expectNoSocketErrors(flow.allRecipients, afterDuplicates);

      const afterRemainingDownload = flow.mark();
      const remainingProbe = flow.createAcceptedMediaDownloadProbe(remainingPlayer);
      const finalStatus = expectedStatus(remainingPlayer.userId!, true, GAME_QUESTION_ANSWER_TIME);
      const finalBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterRemainingDownload,
        finalStatus
      );
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterRemainingDownload);

      flow.emitPlayerDownloaded(remainingPlayer);

      await Promise.all([remainingProbe.waitForCount(1), finalBroadcasts, questionReveal]);
      await flow.waitForActionsComplete();

      flow.assertOutboundMediaDownloadCommands({
        actor: remainingPlayer,
        afterSequence: afterRemainingDownload,
        expectedCount: 1
      });
      flow.assertAcceptedMediaDownloadCount(remainingProbe, 1, remainingPlayer);
      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterRemainingDownload, 1)
      );
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterRemainingDownload, 1);
      await flow.expectMediaReadiness([
        { actor: duplicatePlayer, expected: true },
        { actor: remainingPlayer, expected: true }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(GAME_QUESTION_ANSWER_TIME);
      await flow.expectNoSocketErrors(flow.allRecipients, afterRemainingDownload);
    });
  });

  it("transitions partial readiness deterministically through media timer expiry", async () => {
    await withMediaDownloadFlow(createFlowOptions({ spectatorCount: 1 }), async (flow) => {
      await flow.pickMediaQuestion();
      await assertInitialMediaState(flow);

      const downloadedPlayer = flow.player(0);
      const waitingPlayer = flow.player(1);
      const afterPartial = flow.mark();
      const partialProbe = flow.createAcceptedMediaDownloadProbe(downloadedPlayer);
      const partialBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterPartial,
        expectedStatus(downloadedPlayer.userId!, false, null)
      );

      flow.emitPlayerDownloaded(downloadedPlayer);

      await Promise.all([partialProbe.waitForCount(1), partialBroadcasts]);
      await flow.waitForActionsComplete();
      flow.assertOutboundMediaDownloadCommands({
        actor: downloadedPlayer,
        afterSequence: afterPartial,
        expectedCount: 1
      });
      flow.assertAcceptedMediaDownloadCount(partialProbe, 1, downloadedPlayer);
      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterPartial, 1)
      );
      flow.assertNoQuestionReveal(flow.allRecipients, afterPartial);
      await flow.expectMediaReadiness([
        { actor: downloadedPlayer, expected: true },
        { actor: waitingPlayer, expected: false }
      ]);
      await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
      await flow.expectActiveTimerDuration(MEDIA_DOWNLOAD_TIMEOUT);
      await flow.expectNoSocketErrors(flow.allRecipients, afterPartial);

      const afterTimerExpiry = flow.mark();
      const timeoutStatus = expectedStatus(SYSTEM_PLAYER_ID, true, GAME_QUESTION_ANSWER_TIME);
      const timeoutBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterTimerExpiry,
        timeoutStatus
      );
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterTimerExpiry);

      await Promise.all([flow.expireMediaDownloadTimer(), timeoutBroadcasts, questionReveal]);
      await flow.waitForActionsComplete();

      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterTimerExpiry, 1)
      );
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterTimerExpiry, 1);
      await flow.expectMediaReadiness([
        { actor: downloadedPlayer, expected: true },
        { actor: waitingPlayer, expected: true }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(GAME_QUESTION_ANSWER_TIME);
      await flow.expectNoSocketErrors(flow.allRecipients, afterTimerExpiry);
    });
  });

  it("forces every player ready when the media timer expires with zero ready", async () => {
    await withMediaDownloadFlow(createFlowOptions(), async (flow) => {
      await flow.pickMediaQuestion();
      await assertInitialMediaState(flow);

      const afterTimerExpiry = flow.mark();
      const timeoutBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterTimerExpiry,
        expectedStatus(SYSTEM_PLAYER_ID, true, GAME_QUESTION_ANSWER_TIME)
      );
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterTimerExpiry);

      await Promise.all([flow.expireMediaDownloadTimer(), timeoutBroadcasts, questionReveal]);
      await flow.waitForActionsComplete();

      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterTimerExpiry, 1)
      );
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterTimerExpiry, 1);
      await flow.expectMediaReadiness([
        { actor: flow.player(0), expected: true },
        { actor: flow.player(1), expected: true }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(GAME_QUESTION_ANSWER_TIME);
      await flow.expectNoSocketErrors(flow.allRecipients, afterTimerExpiry);
    });
  });

  it("ignores a stale media timeout after early completion", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 1 }), async (flow) => {
      await flow.pickMediaQuestion();
      await assertInitialMediaState(flow);

      const player = flow.player(0);
      const staleExpirationTime = new Date();
      const afterDownload = flow.mark();
      const downloadProbe = flow.createAcceptedMediaDownloadProbe(player);
      const finalBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterDownload,
        expectedStatus(player.userId!, true, GAME_QUESTION_ANSWER_TIME)
      );
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterDownload);

      flow.emitPlayerDownloaded(player);

      await Promise.all([downloadProbe.waitForCount(1), finalBroadcasts, questionReveal]);
      await flow.waitForActionsComplete();
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterDownload, 1);

      const afterCompletion = flow.mark();
      const timeoutProbe = flow.createAcceptedMediaTimeoutProbe();
      const noSystemStatus = flow.expectNoMediaDownloadStatus(
        flow.allRecipients,
        afterCompletion,
        SYSTEM_PLAYER_ID
      );
      const result = await flow.submitStaleMediaTimeout(staleExpirationTime);

      expect(result.success).toBe(true);
      await timeoutProbe.waitForCount(1);
      await flow.waitForActionsComplete();
      await noSystemStatus;

      expect(timeoutProbe.records()).toHaveLength(1);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(GAME_QUESTION_ANSWER_TIME);
      await flow.expectNoSocketErrors(flow.allRecipients, afterCompletion);
    });
  });

  it("ignores media readiness outside the media-downloading phase", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 1 }), async (flow) => {
      await flow.startGame();
      await flow.expectQuestionState(QuestionState.CHOOSING);
      await flow.expectNoActiveTimer();

      const player = flow.player(0);
      const afterDownload = flow.mark();
      const probe = flow.createAcceptedMediaDownloadProbe(player);
      const noStatus = flow.expectNoMediaDownloadStatus(flow.allRecipients, afterDownload);

      flow.emitPlayerDownloaded(player);

      await probe.waitForCount(1);
      await flow.waitForActionsComplete();
      await noStatus;

      flow.assertOutboundMediaDownloadCommands({
        actor: player,
        afterSequence: afterDownload,
        expectedCount: 1
      });
      flow.assertAcceptedMediaDownloadCount(probe, 1, player);
      await flow.expectMediaReadiness([{ actor: player, expected: false }]);
      await flow.expectQuestionState(QuestionState.CHOOSING);
      await flow.expectNoActiveTimer();
      await flow.expectNoSocketErrors(flow.allRecipients, afterDownload);
    });
  });

  it("auto-reveals a question without media and does not require an acknowledgement", async () => {
    await withMediaDownloadFlow(
      createFlowOptions({ playerCount: 1, includeMediaQuestionFiles: false }),
      async (flow) => {
        const afterQuestionPick = await flow.pickMediaQuestion();
        flow.assertExactQuestionRevealCount(flow.allRecipients, afterQuestionPick, 1);
        flow.assertOutboundMediaDownloadCommands({
          afterSequence: afterQuestionPick,
          expectedCount: 0
        });
        await flow.expectQuestionState(QuestionState.SHOWING);
        await flow.expectActiveTimerDuration(GAME_QUESTION_ANSWER_TIME);
        await flow.expectNoSocketErrors(flow.allRecipients, afterQuestionPick);
      }
    );
  });
});

function createFlowOptions(
  options: Pick<
    CreateMediaDownloadFlowOptions,
    "playerCount" | "spectatorCount" | "includeMediaQuestionFiles"
  > = {}
): CreateMediaDownloadFlowOptions {
  const currentHarness = requireHarness();

  return {
    harness: currentHarness,
    utils: new SocketGameTestUtils(currentHarness.serverUrl),
    userRepo: currentHarness.dataSource.getRepository(User),
    ...options
  };
}

function requireHarness(): ServerTestHarness {
  if (!harness) {
    throw new Error("ServerTestHarness was not started");
  }

  return harness;
}

async function assertInitialMediaState(flow: MediaDownloadFlow): Promise<void> {
  await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
  await flow.expectActiveTimerDuration(MEDIA_DOWNLOAD_TIMEOUT);
}

function expectedStatus(
  playerId: number,
  allPlayersReady: boolean,
  timerDurationMs: number | null
): ExpectedMediaDownloadStatus {
  return {
    playerId,
    allPlayersReady,
    timerDurationMs
  };
}
