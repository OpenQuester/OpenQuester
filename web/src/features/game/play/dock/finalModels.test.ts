import { expect, it } from "vitest";

import { ALICE, BOB, SAM, SHOWMAN, player, question, round, snapshot } from "@/game/fixtures";
import { sessionFromSnapshot } from "@/game/reducer";
import type { ActionDockContext } from "./actionDockModel";
import {
  finalAnswerModel,
  finalBidModel,
  finalEliminationModel,
  finalReviewModel,
} from "./finalModels";

function context(myId = ALICE, ownAmount?: number, score = 100): ActionDockContext {
  const session = sessionFromSnapshot(
    "game",
    snapshot(
      {
        currentRound: round("final"),
        questionState: "bidding",
        finalRoundData: {
          phase: "bidding",
          turnOrder: [ALICE, BOB],
          submittedBidPlayerIds: [ALICE, BOB],
          bids: ownAmount === undefined ? {} : { [ALICE]: ownAmount },
          answers: [],
          eliminatedThemes: [],
        },
      },
      [
        player(ALICE, "player", { score }),
        player(BOB, "player"),
        player(SHOWMAN, "showman"),
        player(SAM, "spectator"),
      ],
    ),
  );
  return {
    session,
    myId,
    role: session.players.find((p) => p.meta.id === myId)!.role,
    value: 0,
    name: () => "",
    buzzer: { open: false, opensInMs: 0, lockLeftMs: 0 },
    secretTarget: null,
    t: (key, values) => `${key}:${JSON.stringify(values ?? {})}`,
    reason: (key) => key,
    sending: () => false,
  };
}

it("locks the restored bid form before the private amount arrives", () => {
  const ctx = context();
  expect(finalBidModel(ctx)).toMatchObject({
    status: "dock.final.bidSubmitted:{}",
    action: { kind: "info", text: 'dock.final.waitOthers:{"done":2,"total":2}' },
  });
  expect(finalAnswerModel(ctx).status).toBe('dock.final.typeAnswer:{"amount":"—"}');
});

it.each([100, 0, -100])("shows the accepted amount even for automatic bids (score %s)", (score) => {
  expect(finalBidModel(context(ALICE, 1, score))).toMatchObject({
    status: 'dock.final.bidLocked:{"amount":"1"}',
    action: { kind: "info" },
  });
});

it.each([SHOWMAN, SAM])("counts hidden submissions for observer %s", (id) => {
  expect(finalBidModel(context(id))).toMatchObject({
    status: 'dock.final.bidsIn:{"done":2,"total":2}',
    action: { kind: "info" },
  });
  expect(finalAnswerModel(context(id)).status).toBe('dock.final.answersIn:{"done":0,"total":2}');
});

it("allows only the active player to eliminate and describes the turn to observers", () => {
  const ctx = context();
  ctx.session.state.currentTurnPlayerId = ALICE;
  ctx.name = () => "Alice";
  expect(finalEliminationModel(ctx)).toMatchObject({
    status: "dock.final.elimYou:{}",
    action: { text: "dock.final.elimInfo:{}" },
  });
  expect(finalEliminationModel({ ...ctx, myId: BOB })).toMatchObject({
    statusPlayer: { key: "dock.final.elimOther", name: "Alice" },
    action: { text: "not_your_turn" },
  });
  expect(finalEliminationModel({ ...ctx, myId: SHOWMAN, role: "showman" })).toMatchObject({
    statusPlayer: { key: "dock.final.elimShowman", name: "Alice" },
    action: { text: "dock.final.elimInfo:{}" },
  });
});

it("opens a final stake only for an eligible player with a positive score", () => {
  const ctx = context();
  ctx.session.state.finalRoundData!.submittedBidPlayerIds = [BOB];
  expect(finalBidModel(ctx).action).toMatchObject({
    kind: "bid",
    range: { min: 1, max: 100 },
    allIn: 100,
  });
  expect(finalAnswerModel(ctx).action).toMatchObject({ text: "not_eligible" });
  ctx.session.players.find((p) => p.meta.id === ALICE)!.score = 0;
  expect(finalBidModel(ctx).action).toMatchObject({ text: "not_eligible" });
  ctx.session.state.questionEligiblePlayers = [BOB];
  expect(finalBidModel(ctx).status).toBe("dock.final.sitOut:{}");
});

it("offers each final answer format, then locks the submitted input", () => {
  const ctx = context(ALICE, 100);
  ctx.session.state.currentQuestion = question(100, { answerType: "select" });
  expect(finalAnswerModel(ctx).action).toEqual({
    kind: "info",
    text: "dock.answering.pickOption:{}",
  });
  ctx.session.state.currentQuestion = question(100, { answerType: "point" });
  expect(finalAnswerModel(ctx).status).toBe("point.finalPictureUnavailable:{}");
  ctx.session.state.currentQuestion.questionFiles = [
    { order: 0, displayTime: null, file: { type: "image", md5: "map", link: "/map" } },
  ];
  expect(finalAnswerModel(ctx).action).toEqual({ kind: "info", text: "point.prompt:{}" });
  ctx.session.finalSubmitted = [ALICE];
  expect(finalAnswerModel(ctx).status).toBe("dock.final.answerLocked:{}");
  expect(finalReviewModel(ctx).action).toEqual({ kind: "info", text: "dock.final.reviewWait:{}" });
  expect(finalReviewModel({ ...ctx, role: "showman" }).action).toEqual({
    kind: "info",
    text: "dock.final.reviewShowman:{}",
  });
});
