import { afterAll, afterEach, beforeAll, describe, it } from "@jest/globals";

import {
  GAME_QUESTION_ANSWER_TIME,
  MEDIA_DOWNLOAD_TIMEOUT,
  SYSTEM_PLAYER_ID
} from "domain/constants/game";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import {
  type CreateMediaDownloadFlowOptions,
  type ExpectedMediaDownloadStatus,
  MediaDownloadFlow,
  withMediaDownloadFlow
} from "tests/e2e/flows/media-download/MediaDownloadFlow";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { type ScenarioActor } from "tests/e2e/scenario/ScenarioActor";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

let harness: ServerTestHarness | undefined;

describe("Media Download client-contract departure and restriction scenarios", () => {
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

  it("transitions when the last non-ready player leaves", async () => {
    await withMediaDownloadFlow(createFlowOptions(), async (flow) => {
      const {
        readyPlayer,
        waitingPlayers: [leavingPlayer]
      } = await preparePartialReadiness(flow);
      const afterLeave = flow.mark();
      const leaveProbe = flow.createAcceptedActorActionProbe(leavingPlayer, GameActionType.LEAVE);
      const status = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterLeave,
        expectedStatus(SYSTEM_PLAYER_ID, true, GAME_QUESTION_ANSWER_TIME)
      );
      const leave = flow.waitForLeaveBroadcast(flow.allRecipients, afterLeave, leavingPlayer);
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterLeave);

      flow.emitPlayerLeave(leavingPlayer);

      await Promise.all([leaveProbe.waitForCount(1), status, leave, questionReveal]);
      await flow.waitForActionsComplete();

      assertAcceptedCommand(
        flow,
        leaveProbe,
        leavingPlayer,
        GameActionType.LEAVE,
        SocketIOGameEvents.LEAVE,
        afterLeave
      );
      assertExactInboundCounts(
        flow,
        flow.allRecipients,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        afterLeave,
        1
      );
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterLeave, 1);
      assertExactInboundCounts(flow, flow.allRecipients, SocketIOGameEvents.LEAVE, afterLeave, 1);
      flow.assertInboundEventOrder(flow.showman, afterLeave, [
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        SocketIOGameEvents.LEAVE
      ]);
      await expectPlayerDisconnected(flow, leavingPlayer, false);
      await flow.expectMediaReadiness([{ actor: readyPlayer, expected: true }]);
      await assertShowing(flow);
      await flow.expectNoSocketErrors(afterLeave);
    });
  });

  it("transitions when the last non-ready player disconnects", async () => {
    await withMediaDownloadFlow(createFlowOptions(), async (flow) => {
      const {
        readyPlayer,
        waitingPlayers: [disconnectingPlayer]
      } = await preparePartialReadiness(flow);
      const remainingRecipients = flow.allRecipients.filter(
        (actor) => actor !== disconnectingPlayer
      );
      const socketId = requireSocketId(disconnectingPlayer);
      const afterDisconnect = flow.mark();
      const disconnectProbe = flow.createAcceptedActorActionProbe(
        disconnectingPlayer,
        GameActionType.DISCONNECT
      );
      const status = flow.waitForMediaDownloadBroadcast(
        remainingRecipients,
        afterDisconnect,
        expectedStatus(SYSTEM_PLAYER_ID, true, GAME_QUESTION_ANSWER_TIME)
      );
      const leave = flow.waitForLeaveBroadcast(
        remainingRecipients,
        afterDisconnect,
        disconnectingPlayer
      );
      const questionReveal = flow.waitForQuestionReveal(remainingRecipients, afterDisconnect);

      flow.disconnectPlayer(disconnectingPlayer);

      await Promise.all([disconnectProbe.waitForCount(1), status, leave, questionReveal]);
      await flow.waitForActionsComplete();

      flow.assertOutboundCommandCount(
        disconnectingPlayer,
        SocketIOEvents.DISCONNECT,
        afterDisconnect,
        1
      );
      flow.assertAcceptedActorActionCount(
        disconnectProbe,
        1,
        GameActionType.DISCONNECT,
        disconnectingPlayer,
        socketId
      );
      assertExactInboundCounts(
        flow,
        remainingRecipients,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        afterDisconnect,
        1
      );
      flow.assertExactQuestionRevealCount(remainingRecipients, afterDisconnect, 1);
      assertExactInboundCounts(
        flow,
        remainingRecipients,
        SocketIOGameEvents.LEAVE,
        afterDisconnect,
        1
      );
      flow.assertInboundEventOrder(flow.showman, afterDisconnect, [
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        SocketIOGameEvents.LEAVE
      ]);
      await expectPlayerDisconnected(flow, disconnectingPlayer, false);
      await flow.expectMediaReadiness([{ actor: readyPlayer, expected: true }]);
      await assertShowing(flow);
      await flow.expectNoSocketErrors(afterDisconnect);
    });
  });

  it("transitions when the showman kicks the last non-ready player", async () => {
    await withMediaDownloadFlow(createFlowOptions(), async (flow) => {
      const {
        readyPlayer,
        waitingPlayers: [kickedPlayer]
      } = await preparePartialReadiness(flow);
      const afterKick = flow.mark();
      const kickProbe = flow.createAcceptedActorActionProbe(
        flow.showman,
        GameActionType.PLAYER_KICK
      );
      const status = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterKick,
        expectedStatus(SYSTEM_PLAYER_ID, true, GAME_QUESTION_ANSWER_TIME)
      );
      const kicked = flow.waitForKickBroadcast(flow.allRecipients, afterKick, kickedPlayer);
      const leave = flow.waitForLeaveBroadcast(flow.allRecipients, afterKick, kickedPlayer);
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterKick);

      flow.emitPlayerKick(kickedPlayer);

      await Promise.all([kickProbe.waitForCount(1), status, kicked, leave, questionReveal]);
      await flow.waitForActionsComplete();

      assertAcceptedCommand(
        flow,
        kickProbe,
        flow.showman,
        GameActionType.PLAYER_KICK,
        SocketIOGameEvents.PLAYER_KICKED,
        afterKick
      );
      for (const event of [
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        SocketIOGameEvents.PLAYER_KICKED,
        SocketIOGameEvents.LEAVE
      ]) {
        assertExactInboundCounts(flow, flow.allRecipients, event, afterKick, 1);
      }
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterKick, 1);
      flow.assertInboundEventOrder(flow.showman, afterKick, [
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        SocketIOGameEvents.PLAYER_KICKED,
        SocketIOGameEvents.LEAVE
      ]);
      await expectPlayerDisconnected(flow, kickedPlayer, false);
      await flow.expectMediaReadiness([{ actor: readyPlayer, expected: true }]);
      await assertShowing(flow);
      await flow.expectNoSocketErrors(afterKick);
    });
  });

  it("stays in media download when a non-ready player leaves but another is waiting", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 3 }), async (flow) => {
      const {
        readyPlayer,
        waitingPlayers: [leavingPlayer, remainingPlayer]
      } = await preparePartialReadiness(flow);
      const afterLeave = flow.mark();
      const leaveProbe = flow.createAcceptedActorActionProbe(leavingPlayer, GameActionType.LEAVE);
      const leave = flow.waitForLeaveBroadcast(flow.allRecipients, afterLeave, leavingPlayer);
      const noStatus = flow.expectNoMediaDownloadStatus(afterLeave);

      flow.emitPlayerLeave(leavingPlayer);

      await Promise.all([leaveProbe.waitForCount(1), leave, noStatus]);
      await flow.waitForActionsComplete();

      assertAcceptedCommand(
        flow,
        leaveProbe,
        leavingPlayer,
        GameActionType.LEAVE,
        SocketIOGameEvents.LEAVE,
        afterLeave
      );
      assertExactInboundCounts(flow, flow.allRecipients, SocketIOGameEvents.LEAVE, afterLeave, 1);
      assertExactInboundCounts(
        flow,
        flow.allRecipients,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        afterLeave,
        0
      );
      await expectPlayerDisconnected(flow, leavingPlayer, false);
      await flow.expectMediaReadiness([
        { actor: readyPlayer, expected: true },
        { actor: remainingPlayer, expected: false }
      ]);
      await assertMediaDownloading(flow);
      flow.assertNoQuestionReveal(flow.allRecipients, afterLeave);
      await flow.expectNoSocketErrors(afterLeave);
    });
  });

  it("transitions only after every remaining player becomes ready following a leave", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 3 }), async (flow) => {
      const {
        readyPlayer,
        waitingPlayers: [leavingPlayer, remainingPlayer]
      } = await preparePartialReadiness(flow);
      const afterLeave = flow.mark();
      const leaveProbe = flow.createAcceptedActorActionProbe(leavingPlayer, GameActionType.LEAVE);
      const leave = flow.waitForLeaveBroadcast(flow.allRecipients, afterLeave, leavingPlayer);
      const noStatus = flow.expectNoMediaDownloadStatus(afterLeave);

      flow.emitPlayerLeave(leavingPlayer);

      await Promise.all([leaveProbe.waitForCount(1), leave, noStatus]);
      await flow.waitForActionsComplete();
      assertAcceptedCommand(
        flow,
        leaveProbe,
        leavingPlayer,
        GameActionType.LEAVE,
        SocketIOGameEvents.LEAVE,
        afterLeave
      );
      await assertMediaDownloading(flow);
      flow.assertNoQuestionReveal(flow.allRecipients, afterLeave);

      const activeRecipients = flow.allRecipients.filter((actor) => actor !== leavingPlayer);
      const afterFinalDownload = flow.mark();
      const downloadProbe = flow.createAcceptedMediaDownloadProbe(remainingPlayer);
      const status = flow.waitForMediaDownloadBroadcast(
        activeRecipients,
        afterFinalDownload,
        expectedStatus(remainingPlayer.userId!, true, GAME_QUESTION_ANSWER_TIME)
      );
      const questionReveal = flow.waitForQuestionReveal(activeRecipients, afterFinalDownload);

      flow.emitPlayerDownloaded(remainingPlayer);

      await Promise.all([downloadProbe.waitForCount(1), status, questionReveal]);
      await flow.waitForActionsComplete();

      flow.assertOutboundMediaDownloadCommands({
        actor: remainingPlayer,
        afterSequence: afterFinalDownload,
        expectedCount: 1
      });
      flow.assertAcceptedMediaDownloadCount(downloadProbe, 1, remainingPlayer);
      assertExactInboundCounts(
        flow,
        activeRecipients,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        afterFinalDownload,
        1
      );
      flow.assertExactMediaStatusCount(leavingPlayer, afterFinalDownload, 0);
      flow.assertExactQuestionRevealCount(activeRecipients, afterFinalDownload, 1);
      flow.assertExactQuestionRevealCount([leavingPlayer], afterFinalDownload, 0);
      await flow.expectMediaReadiness([
        { actor: readyPlayer, expected: true },
        { actor: remainingPlayer, expected: true }
      ]);
      await assertShowing(flow);
      await flow.expectNoSocketErrors(afterFinalDownload);
    });
  });

  it("stays in media download when a ready player leaves and another is waiting", async () => {
    await withMediaDownloadFlow(createFlowOptions(), async (flow) => {
      const {
        readyPlayer,
        waitingPlayers: [waitingPlayer]
      } = await preparePartialReadiness(flow);
      const afterLeave = flow.mark();
      const leaveProbe = flow.createAcceptedActorActionProbe(readyPlayer, GameActionType.LEAVE);
      const leave = flow.waitForLeaveBroadcast(flow.allRecipients, afterLeave, readyPlayer);
      const noStatus = flow.expectNoMediaDownloadStatus(afterLeave);

      flow.emitPlayerLeave(readyPlayer);

      await Promise.all([leaveProbe.waitForCount(1), leave, noStatus]);
      await flow.waitForActionsComplete();

      assertAcceptedCommand(
        flow,
        leaveProbe,
        readyPlayer,
        GameActionType.LEAVE,
        SocketIOGameEvents.LEAVE,
        afterLeave
      );
      assertExactInboundCounts(
        flow,
        flow.allRecipients,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        afterLeave,
        0
      );
      await expectPlayerDisconnected(flow, readyPlayer, true);
      await flow.expectMediaReadiness([{ actor: waitingPlayer, expected: false }]);
      await assertMediaDownloading(flow);
      flow.assertNoQuestionReveal(flow.allRecipients, afterLeave);
      await flow.expectNoSocketErrors(afterLeave);
    });
  });

  it("continues safely when all players leave during media download", async () => {
    await withMediaDownloadFlow(createFlowOptions(), async (flow) => {
      await flow.pickMediaQuestion();
      await assertMediaDownloading(flow);

      const firstPlayer = flow.player(0);
      const secondPlayer = flow.player(1);
      const afterFirstLeave = flow.mark();
      const firstProbe = flow.createAcceptedActorActionProbe(firstPlayer, GameActionType.LEAVE);
      const firstLeave = flow.waitForLeaveBroadcast(
        flow.allRecipients,
        afterFirstLeave,
        firstPlayer
      );
      const noFirstStatus = flow.expectNoMediaDownloadStatus(afterFirstLeave);

      flow.emitPlayerLeave(firstPlayer);

      await Promise.all([firstProbe.waitForCount(1), firstLeave, noFirstStatus]);
      await flow.waitForActionsComplete();
      assertAcceptedCommand(
        flow,
        firstProbe,
        firstPlayer,
        GameActionType.LEAVE,
        SocketIOGameEvents.LEAVE,
        afterFirstLeave
      );
      await assertMediaDownloading(flow);

      const afterSecondLeave = flow.mark();
      const secondProbe = flow.createAcceptedActorActionProbe(secondPlayer, GameActionType.LEAVE);
      const remainingRecipients = flow.allRecipients.filter((actor) => actor !== firstPlayer);
      const secondLeave = flow.waitForLeaveBroadcast(
        remainingRecipients,
        afterSecondLeave,
        secondPlayer
      );
      const questionReveal = flow.waitForQuestionReveal(remainingRecipients, afterSecondLeave);

      flow.emitPlayerLeave(secondPlayer);

      await Promise.all([secondProbe.waitForCount(1), secondLeave, questionReveal]);
      await flow.waitForActionsComplete();

      assertAcceptedCommand(
        flow,
        secondProbe,
        secondPlayer,
        GameActionType.LEAVE,
        SocketIOGameEvents.LEAVE,
        afterSecondLeave
      );
      assertExactInboundCounts(
        flow,
        remainingRecipients,
        SocketIOGameEvents.LEAVE,
        afterSecondLeave,
        1
      );
      flow.assertExactInboundEventCount(firstPlayer, SocketIOGameEvents.LEAVE, afterSecondLeave, 0);
      flow.assertExactQuestionRevealCount(remainingRecipients, afterSecondLeave, 1);
      flow.assertExactQuestionRevealCount([firstPlayer], afterSecondLeave, 0);
      await expectPlayerDisconnected(flow, firstPlayer, false);
      await expectPlayerDisconnected(flow, secondPlayer, false);
      await assertShowing(flow);
      await flow.expectNoSocketErrors(afterSecondLeave);
    });
  });

  it("continues safely when the only player leaves during media download", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 1 }), async (flow) => {
      await flow.pickMediaQuestion();
      await assertMediaDownloading(flow);

      const onlyPlayer = flow.player(0);
      const afterLeave = flow.mark();
      const leaveProbe = flow.createAcceptedActorActionProbe(onlyPlayer, GameActionType.LEAVE);
      const leave = flow.waitForLeaveBroadcast(flow.allRecipients, afterLeave, onlyPlayer);
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterLeave);

      flow.emitPlayerLeave(onlyPlayer);

      await Promise.all([leaveProbe.waitForCount(1), leave, questionReveal]);
      await flow.waitForActionsComplete();

      assertAcceptedCommand(
        flow,
        leaveProbe,
        onlyPlayer,
        GameActionType.LEAVE,
        SocketIOGameEvents.LEAVE,
        afterLeave
      );
      assertExactInboundCounts(flow, flow.allRecipients, SocketIOGameEvents.LEAVE, afterLeave, 1);
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterLeave, 1);
      await expectPlayerDisconnected(flow, onlyPlayer, false);
      await assertShowing(flow);
      await flow.expectNoSocketErrors(afterLeave);
    });
  });

  it("transitions when the showman restricts the last non-ready player", async () => {
    await withMediaDownloadFlow(createFlowOptions(), async (flow) => {
      const {
        readyPlayer,
        waitingPlayers: [restrictedPlayer]
      } = await preparePartialReadiness(flow);
      const afterRestriction = flow.mark();
      const restrictionProbe = flow.createAcceptedActorActionProbe(
        flow.showman,
        GameActionType.PLAYER_RESTRICTION
      );
      const restriction = flow.waitForRestrictionBroadcast(
        flow.allRecipients,
        afterRestriction,
        restrictedPlayer
      );
      const roleChange = flow.waitForSpectatorRoleBroadcast(
        flow.allRecipients,
        afterRestriction,
        restrictedPlayer
      );
      const status = flow.waitForMediaDownloadBroadcast(
        flow.allRecipients,
        afterRestriction,
        expectedStatus(SYSTEM_PLAYER_ID, true, GAME_QUESTION_ANSWER_TIME)
      );
      const questionReveal = flow.waitForQuestionReveal(flow.allRecipients, afterRestriction);

      flow.emitPlayerRestriction(restrictedPlayer);

      await Promise.all([
        restrictionProbe.waitForCount(1),
        restriction,
        roleChange,
        status,
        questionReveal
      ]);
      await flow.waitForActionsComplete();

      assertAcceptedCommand(
        flow,
        restrictionProbe,
        flow.showman,
        GameActionType.PLAYER_RESTRICTION,
        SocketIOGameEvents.PLAYER_RESTRICTED,
        afterRestriction
      );
      for (const event of [
        SocketIOGameEvents.PLAYER_RESTRICTED,
        SocketIOGameEvents.PLAYER_ROLE_CHANGE,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
      ]) {
        assertExactInboundCounts(flow, flow.allRecipients, event, afterRestriction, 1);
      }
      flow.assertExactQuestionRevealCount(flow.allRecipients, afterRestriction, 1);
      flow.assertInboundEventOrder(flow.showman, afterRestriction, [
        SocketIOGameEvents.PLAYER_RESTRICTED,
        SocketIOGameEvents.PLAYER_ROLE_CHANGE,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
      ]);
      await flow.expectPlayerState(restrictedPlayer, {
        role: PlayerRole.SPECTATOR,
        gameStatus: PlayerGameStatus.IN_GAME,
        mediaDownloaded: false
      });
      await flow.expectMediaReadiness([{ actor: readyPlayer, expected: true }]);
      await assertShowing(flow);
      await flow.expectNoSocketErrors(afterRestriction);
    });
  });

  it("stays in media download when a restriction leaves another player waiting", async () => {
    await withMediaDownloadFlow(createFlowOptions({ playerCount: 3 }), async (flow) => {
      const {
        readyPlayer,
        waitingPlayers: [restrictedPlayer, remainingPlayer]
      } = await preparePartialReadiness(flow);
      const afterRestriction = flow.mark();
      const restrictionProbe = flow.createAcceptedActorActionProbe(
        flow.showman,
        GameActionType.PLAYER_RESTRICTION
      );
      const restriction = flow.waitForRestrictionBroadcast(
        flow.allRecipients,
        afterRestriction,
        restrictedPlayer
      );
      const roleChange = flow.waitForSpectatorRoleBroadcast(
        flow.allRecipients,
        afterRestriction,
        restrictedPlayer
      );
      const noStatus = flow.expectNoMediaDownloadStatus(afterRestriction);

      flow.emitPlayerRestriction(restrictedPlayer);

      await Promise.all([restrictionProbe.waitForCount(1), restriction, roleChange, noStatus]);
      await flow.waitForActionsComplete();

      assertAcceptedCommand(
        flow,
        restrictionProbe,
        flow.showman,
        GameActionType.PLAYER_RESTRICTION,
        SocketIOGameEvents.PLAYER_RESTRICTED,
        afterRestriction
      );
      assertExactInboundCounts(
        flow,
        flow.allRecipients,
        SocketIOGameEvents.PLAYER_RESTRICTED,
        afterRestriction,
        1
      );
      assertExactInboundCounts(
        flow,
        flow.allRecipients,
        SocketIOGameEvents.PLAYER_ROLE_CHANGE,
        afterRestriction,
        1
      );
      assertExactInboundCounts(
        flow,
        flow.allRecipients,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        afterRestriction,
        0
      );
      flow.assertInboundEventOrder(flow.showman, afterRestriction, [
        SocketIOGameEvents.PLAYER_RESTRICTED,
        SocketIOGameEvents.PLAYER_ROLE_CHANGE
      ]);
      await flow.expectPlayerState(restrictedPlayer, {
        role: PlayerRole.SPECTATOR,
        gameStatus: PlayerGameStatus.IN_GAME,
        mediaDownloaded: false
      });
      await flow.expectMediaReadiness([
        { actor: readyPlayer, expected: true },
        { actor: remainingPlayer, expected: false }
      ]);
      await assertMediaDownloading(flow);
      flow.assertNoQuestionReveal(flow.allRecipients, afterRestriction);
      await flow.expectNoSocketErrors(afterRestriction);
    });
  });
});

async function preparePartialReadiness(flow: MediaDownloadFlow): Promise<{
  readonly readyPlayer: ScenarioActor;
  readonly waitingPlayers: readonly ScenarioActor[];
}> {
  await flow.pickMediaQuestion();
  await assertMediaDownloading(flow);

  const readyPlayer = flow.player(0);
  const waitingPlayers = flow.allPlayers.slice(1);
  const afterDownload = flow.mark();
  const probe = flow.createAcceptedMediaDownloadProbe(readyPlayer);
  const status = flow.waitForMediaDownloadBroadcast(
    flow.allRecipients,
    afterDownload,
    expectedStatus(readyPlayer.userId!, false, null)
  );

  flow.emitPlayerDownloaded(readyPlayer);

  await Promise.all([probe.waitForCount(1), status]);
  await flow.waitForActionsComplete();

  flow.assertOutboundMediaDownloadCommands({
    actor: readyPlayer,
    afterSequence: afterDownload,
    expectedCount: 1
  });
  flow.assertAcceptedMediaDownloadCount(probe, 1, readyPlayer);
  assertExactInboundCounts(
    flow,
    flow.allRecipients,
    SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
    afterDownload,
    1
  );
  flow.assertNoQuestionReveal(flow.allRecipients, afterDownload);
  await flow.expectMediaReadiness([
    { actor: readyPlayer, expected: true },
    ...waitingPlayers.map((actor) => ({ actor, expected: false }))
  ]);
  await assertMediaDownloading(flow);

  return { readyPlayer, waitingPlayers };
}

function assertAcceptedCommand(
  flow: MediaDownloadFlow,
  probe: ReturnType<MediaDownloadFlow["createAcceptedActorActionProbe"]>,
  actor: ScenarioActor,
  actionType: GameActionType,
  event: string,
  afterSequence: number
): void {
  flow.assertOutboundCommandCount(actor, event, afterSequence, 1);
  flow.assertAcceptedActorActionCount(probe, 1, actionType, actor);
}

function assertExactInboundCounts(
  flow: MediaDownloadFlow,
  actors: readonly ScenarioActor[],
  event: string,
  afterSequence: number,
  expectedCount: number
): void {
  actors.forEach((actor) =>
    flow.assertExactInboundEventCount(actor, event, afterSequence, expectedCount)
  );
}

async function expectPlayerDisconnected(
  flow: MediaDownloadFlow,
  actor: ScenarioActor,
  mediaDownloaded: boolean
): Promise<void> {
  await flow.expectPlayerState(actor, {
    role: PlayerRole.PLAYER,
    gameStatus: PlayerGameStatus.DISCONNECTED,
    mediaDownloaded
  });
}

async function assertMediaDownloading(flow: MediaDownloadFlow): Promise<void> {
  await flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);
  await flow.expectActiveTimerDuration(MEDIA_DOWNLOAD_TIMEOUT);
}

async function assertShowing(flow: MediaDownloadFlow): Promise<void> {
  await flow.expectQuestionState(QuestionState.SHOWING);
  await flow.expectActiveTimerDuration(GAME_QUESTION_ANSWER_TIME);
}

function expectedStatus(
  playerId: number,
  allPlayersReady: boolean,
  timerDurationMs: number | null
): ExpectedMediaDownloadStatus {
  return { playerId, allPlayersReady, timerDurationMs };
}

function createFlowOptions(
  options: Pick<CreateMediaDownloadFlowOptions, "playerCount"> = {}
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

function requireSocketId(actor: ScenarioActor): string {
  if (!actor.socketId) {
    throw new Error(`Scenario actor "${actor.label}" does not have a socket id`);
  }

  return actor.socketId;
}
