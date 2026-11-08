import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";

import {
  CONTENT_IMAGE_TIME,
  GAME_QUESTION_ANSWER_TIME,
  MEDIA_DOWNLOAD_TIMEOUT,
  SYSTEM_PLAYER_ID
} from "domain/constants/game";
import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { timerKey } from "domain/constants/redisKeys";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionContentItemKind } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { User } from "infrastructure/database/models/User";
import { RedisConfig } from "shared/config/RedisConfig";
import {
  type CreateMediaDownloadFlowOptions,
  type ExpectedMediaDownloadStatus,
  MediaDownloadFlow,
  withMediaDownloadFlow
} from "tests/e2e/flows/media-download/MediaDownloadFlow";
import { IMAGE_QUESTION_TIMER_MS } from "tests/e2e/flows/media-download/MediaDownloadAssertions";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { TEST_MEDIA_FILE_MD5 } from "tests/utils/PackageUtils";
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

  it("plans the question content and keeps only reported lengths of its own files", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 1 }), async (flow) => {
      await flow.pickMediaQuestion();

      const player = flow.player(0);
      const afterDownload = flow.mark();
      const statusRecord = flow.waitForMediaDownloadStatus(
        flow.showman,
        afterDownload,
        expectedStatus(SYSTEM_PLAYER_ID, true, IMAGE_QUESTION_TIMER_MS)
      );

      flow.emitPlayerDownloaded(player, {
        mediaDurations: [
          { md5: TEST_MEDIA_FILE_MD5, durationMs: 7_000 },
          { md5: "not-in-this-question", durationMs: 9_000 }
        ]
      });

      const status = (await statusRecord).args[0];
      await flow.waitForActionsComplete();

      // One image step: images use their default time, not a reported length.
      expect(status.contentPlan).toEqual({
        totalMs: CONTENT_IMAGE_TIME,
        steps: [
          {
            startMs: 0,
            durationMs: CONTENT_IMAGE_TIME,
            items: [
              {
                kind: QuestionContentItemKind.FILE,
                order: 0,
                placement: ContentPlacement.SCREEN,
                durationMs: CONTENT_IMAGE_TIME
              }
            ]
          }
        ]
      });
      const state = await flow.getGameState();
      expect(state?.questionContentPlan).toEqual(status.contentPlan);
      expect(state?.mediaDurations).toEqual({ [TEST_MEDIA_FILE_MD5]: 7_000 });
      await flow.expectActiveTimerDuration(IMAGE_QUESTION_TIMER_MS);
    });
  });

  it("shares the scheduled media start and preserves the lead across a pause", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 2 }), async (flow) => {
      await flow.pickMediaQuestion();
      const first = flow.player(0);
      const last = flow.player(1);
      const partial = flow.waitForMediaDownloadStatus(
        first,
        flow.mark(),
        expectedStatus(first.userId!, false, null)
      );
      flow.emitPlayerDownloaded(first);
      await partial;
      const ready = [first, last].map((player) =>
        flow.waitForMediaDownloadStatus(
          player,
          flow.mark(),
          expectedStatus(SYSTEM_PLAYER_ID, true, IMAGE_QUESTION_TIMER_MS)
        )
      );
      flow.emitPlayerDownloaded(last);
      const [firstStatus, lastStatus] = await Promise.all(ready);
      const timer = firstStatus.args[0].timer!;
      expect(lastStatus.args[0].timer).toEqual(timer);
      expect(new Date(timer.startedAt).getTime()).toBeGreaterThan(Date.now());
      expect(timer.elapsedMs).toBe(0);

      expect((await flow.setPaused(true)).timer?.elapsedMs).toBe(0);
      const state = await flow.getGameState();
      const remainingLead = new Date(timer.startedAt).getTime() - state!.pausedAt!;
      expect(remainingLead).toBeGreaterThan(0);

      const beforeResume = Date.now();
      const resumedTimer = (await flow.setPaused(false)).timer!;
      expect(resumedTimer.elapsedMs).toBe(0);
      expect(new Date(resumedTimer.resumedAt!).getTime()).toBeGreaterThanOrEqual(
        beforeResume + remainingLead
      );
      await flow.expectActiveTimerDuration(IMAGE_QUESTION_TIMER_MS);
    });
  });

  it("transitions when every player is ready even though the showman is not", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 1 }), async (flow) => {
      const afterQuestionPick = await flow.pickMediaQuestion();
      await assertInitialMediaState(flow);

      const player = flow.player(0);
      const afterDownload = flow.mark();
      const probe = flow.createAcceptedMediaDownloadProbe(player);
      const status = expectedStatus(SYSTEM_PLAYER_ID, true, IMAGE_QUESTION_TIMER_MS);
      const statusBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterDownload,
        status
      );

      flow.emitPlayerDownloaded(player);

      await Promise.all([probe.waitForCount(1), statusBroadcasts]);
      await flow.waitForActionsComplete();

      flow.assertOutboundMediaDownloadCommands({
        actor: player,
        afterSequence: afterDownload,
        expectedCount: 1
      });
      flow.assertAcceptedMediaDownloadCount(probe, 1, player);
      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterDownload, 2)
      );
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterDownload);
      await flow.expectMediaReadiness([
        { actor: player, expected: true },
        { actor: flow.showman, expected: false }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(IMAGE_QUESTION_TIMER_MS);
      flow.assertCriticalEventOrder(player, afterQuestionPick);
      await flow.expectNoSocketErrors(flow.allRecipients, afterDownload);

      // A slower showman may finish loading after players have already started showing.
      const afterLateAck = flow.mark();
      const lateProbe = flow.createAcceptedMediaDownloadProbe(flow.showman);
      const lateAccepted = lateProbe.waitForCount(1);
      flow.emitPlayerDownloaded(flow.showman);
      await lateAccepted;
      await flow.waitForActionsComplete();
      await flow.expectNoMediaDownloadStatus(flow.allRecipients, afterLateAck);

      flow.assertAcceptedMediaDownloadCount(lateProbe, 1, flow.showman);
      await flow.expectMediaReadiness([
        { actor: player, expected: true },
        { actor: flow.showman, expected: false }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(IMAGE_QUESTION_TIMER_MS);
      await flow.expectNoSocketErrors(flow.allRecipients, afterLateAck);
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
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterDownload);
      await flow.expectNoReadinessCompletion(flow.allRecipients, afterDownload);
      await flow.expectMediaReadiness([
        { actor: downloadedPlayer, expected: true },
        { actor: waitingPlayer, expected: false }
      ]);
      await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
      await flow.expectActiveTimerDuration(MEDIA_DOWNLOAD_TIMEOUT);
      await flow.expectNoSocketErrors(flow.allRecipients, afterDownload);
    });
  });

  it("handles concurrent two-player completion without waiting for a spectator", async () => {
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

      flow.emitPlayerDownloaded(firstPlayer);
      flow.emitPlayerDownloaded(secondPlayer);

      await Promise.all([probe.waitForCount(2), finalReadyBroadcasts]);
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

        expect(statuses).toHaveLength(3);
        expect(statuses.map((status) => status.playerId).sort()).toEqual(
          [firstPlayer.userId, secondPlayer.userId, SYSTEM_PLAYER_ID].sort()
        );
        expect(statuses[0]).toMatchObject({
          mediaDownloaded: true,
          allPlayersReady: false,
          timer: null
        });
        expect(statuses[1].mediaDownloaded).toBe(true);
        expect(statuses[1].allPlayersReady).toBe(true);
        expect(statuses[1].timer).toBeNull();
        expect(statuses[2].timer?.durationMs).toBe(IMAGE_QUESTION_TIMER_MS);
      }
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterDownloadBurst);

      await flow.expectMediaReadiness([
        { actor: firstPlayer, expected: true },
        { actor: secondPlayer, expected: true }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(IMAGE_QUESTION_TIMER_MS);
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
      const duplicateStatusesReceived = flow.collectMediaStatuses(
        flow.showman,
        DUPLICATE_MEDIA_DOWNLOAD_COMMANDS
      );

      duplicatePlayer.emitMany({
        count: DUPLICATE_MEDIA_DOWNLOAD_COMMANDS,
        event: SocketIOGameEvents.MEDIA_DOWNLOADED
      });

      await Promise.all([
        duplicateProbe.waitForCount(DUPLICATE_MEDIA_DOWNLOAD_COMMANDS),
        duplicateStatusesReceived.promise
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
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterDuplicates);
      await flow.expectNoReadinessCompletion(flow.allRecipients, afterDuplicates);
      await flow.expectMediaReadiness([
        { actor: duplicatePlayer, expected: true },
        { actor: remainingPlayer, expected: false }
      ]);
      await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
      await flow.expectActiveTimerDuration(MEDIA_DOWNLOAD_TIMEOUT);
      await flow.expectNoSocketErrors(flow.allRecipients, afterDuplicates);

      duplicateStatusesReceived.stop();
      const afterRemainingDownload = flow.mark();
      const remainingProbe = flow.createAcceptedMediaDownloadProbe(remainingPlayer);
      const finalStatus = expectedStatus(SYSTEM_PLAYER_ID, true, IMAGE_QUESTION_TIMER_MS);
      const finalBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterRemainingDownload,
        finalStatus
      );

      flow.emitPlayerDownloaded(remainingPlayer);

      await Promise.all([remainingProbe.waitForCount(1), finalBroadcasts]);
      await flow.waitForActionsComplete();

      flow.assertOutboundMediaDownloadCommands({
        actor: remainingPlayer,
        afterSequence: afterRemainingDownload,
        expectedCount: 1
      });
      flow.assertAcceptedMediaDownloadCount(remainingProbe, 1, remainingPlayer);
      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterRemainingDownload, 2)
      );
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterRemainingDownload);
      await flow.expectMediaReadiness([
        { actor: duplicatePlayer, expected: true },
        { actor: remainingPlayer, expected: true }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(IMAGE_QUESTION_TIMER_MS);
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
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterPartial);
      await flow.expectNoReadinessCompletion(flow.allRecipients, afterPartial);
      await flow.expectMediaReadiness([
        { actor: downloadedPlayer, expected: true },
        { actor: waitingPlayer, expected: false }
      ]);
      await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
      await flow.expectActiveTimerDuration(MEDIA_DOWNLOAD_TIMEOUT);
      await flow.expectNoSocketErrors(flow.allRecipients, afterPartial);

      const afterTimerExpiry = flow.mark();
      const timeoutStatus = expectedStatus(SYSTEM_PLAYER_ID, true, IMAGE_QUESTION_TIMER_MS);
      const timeoutBroadcasts = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterTimerExpiry,
        timeoutStatus
      );

      await Promise.all([flow.expireMediaDownloadTimer(), timeoutBroadcasts]);
      await flow.waitForActionsComplete();

      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterTimerExpiry, 2)
      );
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterTimerExpiry);
      await flow.expectMediaReadiness([
        { actor: downloadedPlayer, expected: true },
        { actor: waitingPlayer, expected: true }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(IMAGE_QUESTION_TIMER_MS);
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
        expectedStatus(SYSTEM_PLAYER_ID, true, IMAGE_QUESTION_TIMER_MS)
      );

      await Promise.all([flow.expireMediaDownloadTimer(), timeoutBroadcasts]);
      await flow.waitForActionsComplete();

      flow.allRecipients.forEach((recipient) =>
        flow.assertExactMediaStatusCount(recipient, afterTimerExpiry, 2)
      );
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterTimerExpiry);
      await flow.expectMediaReadiness([
        { actor: flow.player(0), expected: true },
        { actor: flow.player(1), expected: true }
      ]);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(IMAGE_QUESTION_TIMER_MS);
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
        expectedStatus(SYSTEM_PLAYER_ID, true, IMAGE_QUESTION_TIMER_MS)
      );

      flow.emitPlayerDownloaded(player);

      await Promise.all([downloadProbe.waitForCount(1), finalBroadcasts]);
      await flow.waitForActionsComplete();
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterDownload);

      const afterCompletion = flow.mark();
      const timeoutProbe = flow.createAcceptedMediaTimeoutProbe();
      const result = await flow.submitStaleMediaTimeout(staleExpirationTime);

      expect(result.success).toBe(true);
      await timeoutProbe.waitForCount(1);
      await flow.waitForActionsComplete();
      await flow.expectNoMediaDownloadStatus(flow.allRecipients, afterCompletion, SYSTEM_PLAYER_ID);

      expect(timeoutProbe.records()).toHaveLength(1);
      await flow.expectQuestionState(QuestionState.SHOWING);
      await flow.expectActiveTimerDuration(IMAGE_QUESTION_TIMER_MS);
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

      flow.emitPlayerDownloaded(player);

      await probe.waitForCount(1);
      await flow.waitForActionsComplete();
      await flow.expectNoMediaDownloadStatus(flow.allRecipients, afterDownload);

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

  it("releases a no-file question after the opening without client acknowledgements", async () => {
    await withMediaDownloadFlow(
      createFlowOptions({ playerCount: 1, includeMediaQuestionFiles: false }),
      async (flow) => {
        const afterQuestionPick = await flow.pickMediaQuestion();
        const before = await flow.getGameState();
        const probe = flow.createAcceptedMediaDownloadProbe(flow.player(0));
        const records = await flow.waitForMediaDownloadBroadcast(
          flow.allRecipients,
          afterQuestionPick,
          expectedStatus(SYSTEM_PLAYER_ID, true, GAME_QUESTION_ANSWER_TIME)
        );
        const timer = records[0].args[0].timer!;
        expect(new Date(timer.startedAt).getTime()).toBeGreaterThanOrEqual(
          new Date(before!.questionTransition!.timer.startedAt).getTime() + 1750
        );
        expect(records.every((record) => record.args[0].timer?.startedAt === timer.startedAt)).toBe(
          true
        );
        await flow.waitForActionsComplete();
        const beforeTtl = Date.now();
        const ttl = await RedisConfig.getClient().pttl(timerKey(flow.gameId));
        const expiresAt = new Date(timer.startedAt).getTime() + timer.durationMs;
        expect(ttl).toBeGreaterThanOrEqual(expiresAt - Date.now() - 50);
        expect(ttl).toBeLessThanOrEqual(expiresAt - beforeTtl + 50);
        flow.assertAcceptedMediaDownloadCount(probe, 0, flow.player(0));
        flow.assertExactQuestionDataCount(flow.allRecipients, afterQuestionPick, 1);
        flow.assertOutboundMediaDownloadCommands({
          afterSequence: afterQuestionPick,
          expectedCount: 0
        });
        flow.allRecipients.forEach((actor) =>
          flow.assertExactMediaStatusCount(actor, afterQuestionPick, 1)
        );
        await flow.expectQuestionState(QuestionState.SHOWING);
        await flow.expectActiveTimerDuration(GAME_QUESTION_ANSWER_TIME);
        flow.assertCriticalEventOrder(flow.player(0), afterQuestionPick);
        await flow.expectNoSocketErrors(flow.allRecipients, afterQuestionPick);
      }
    );
  });

  it("keeps waiting for players even when the showman is ready", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 1 }), async (flow) => {
      await flow.pickMediaQuestion();
      const afterAck = flow.mark();
      const probe = flow.createAcceptedMediaDownloadProbe(flow.showman);
      const accepted = probe.waitForCount(1);
      const status = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterAck,
        expectedStatus(flow.showman.userId!, false, null)
      );
      flow.emitPlayerDownloaded(flow.showman);
      await Promise.all([accepted, status]);
      await flow.waitForActionsComplete();
      await flow.expectNoReadinessCompletion(flow.allRecipients, afterAck);
      flow.assertAcceptedMediaDownloadCount(probe, 1, flow.showman);
      flow.assertOutboundMediaDownloadCommands({
        actor: flow.showman,
        afterSequence: afterAck,
        expectedCount: 1
      });
      flow.allRecipients.forEach((actor) => flow.assertExactMediaStatusCount(actor, afterAck, 1));
      await flow.expectMediaReadiness([
        { actor: flow.showman, expected: true },
        { actor: flow.player(0), expected: false }
      ]);
      await assertInitialMediaState(flow);
      flow.assertNoAdditionalQuestionData(flow.allRecipients, afterAck);
      await flow.expectNoSocketErrors(flow.allRecipients, afterAck);
    });
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
