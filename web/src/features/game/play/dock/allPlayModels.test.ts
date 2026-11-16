import { expect, it } from "vitest";
import { ALICE, BOB, SAM, SHOWMAN, player, question, session } from "@/game/fixtures";
import type { AllPlayData, GameState } from "@/game/protocol";
import type { ActionDockContext } from "./actionDockModel";
import { allPlayAnswerModel, allPlayReviewModel, allPlayStakeModel } from "./allPlayModels";

const entry = {
  playerId: ALICE,
  stake: null,
  answer: null,
  submitted: false,
  isCorrect: null,
  scoreChange: null,
};
const allPlay = (patch: Partial<AllPlayData> = {}): AllPlayData => ({
  mode: "stake",
  price: 100,
  maxStake: 150,
  priceMultiplier: null,
  questionId: 100,
  entries: [entry, { ...entry, playerId: BOB, stake: 50 }],
  ...patch,
});
const image = {
  order: 0,
  displayTime: null,
  file: { type: "image", md5: "map", link: "/map" },
} as const;

function context(state: Partial<GameState>, myId = ALICE): ActionDockContext {
  const current = session({ currentQuestion: question(), allPlay: allPlay(), ...state }, [
    player(ALICE, "player", { score: 500 }),
    player(BOB, "player"),
    player(SAM, "spectator"),
    player(SHOWMAN, "showman"),
  ]);
  return {
    session: current,
    myId,
    role: current.players.find((p) => p.meta.id === myId)!.role,
    value: 100,
    name: () => "",
    t: (key) => key,
    reason: (key) => key,
    sending: () => false,
    buzzer: { open: false, opensInMs: 0, lockLeftMs: 0 },
    secretTarget: null,
  };
}

it("allows a bounded stake only for an unstaked participant", () => {
  expect(allPlayStakeModel(context({ questionState: "bidding" })).action).toMatchObject({
    kind: "bid",
    range: { min: 1, max: 150 },
    allIn: 150,
  });
  expect(allPlayStakeModel(context({ questionState: "bidding" }, BOB)).status).toBe(
    "dock.allPlay.stakeLocked",
  );
  expect(allPlayStakeModel(context({ questionState: "bidding" }, SAM)).action).toEqual({
    kind: "info",
    text: "dock.allPlay.stakeWatch",
  });
});

it.each([
  ["stake", "number", undefined, "dock.allPlay.answerNextStakeAuto"],
  ["stake", "text", undefined, "dock.allPlay.answerNextStake"],
  ["simple", "number", "none", "allPlay.ruleSimpleFree"],
  ["simple", "text", "subtract", "allPlay.ruleSimple"],
  ["noRisk", "number", undefined, "dock.allPlay.answerNextNoRiskAuto"],
  ["noRisk", "text", undefined, "dock.allPlay.answerNextNoRisk"],
] as const)("describes %s / %s scoring (%s)", (mode, answerType, wrongAnswerPenalty, next) => {
  const model = allPlayAnswerModel(
    context({
      questionState: "showing",
      currentQuestion: question(100, { answerType }),
      allPlay: allPlay({ mode, wrongAnswerPenalty }),
    }),
  );
  expect(model.next).toBe(next);
  expect(model.action).toEqual({
    kind: "timed-answer",
    event: "all-play-answer",
    numeric: answerType === "number",
  });
});

it.each([
  [null, true, "point.finalPictureUnavailable"],
  [[image], false, "point.pictureWaiting"],
  [[image], true, "point.prompt"],
] as const)("offers point input only with a ready target (%j, %s)", (files, ready, text) => {
  const ctx = context({
    questionState: "showing",
    currentQuestion: question(100, {
      answerType: "point",
      questionFiles: files ? [...files] : null,
    }),
  });
  expect(allPlayAnswerModel({ ...ctx, pointImageReady: ready }).action).toEqual({
    kind: "info",
    text,
  });
});

it("shows the select action, locks a submitted answer, and limits review controls to the host", () => {
  const ctx = context({
    questionState: "showing",
    currentQuestion: question(100, { answerType: "select" }),
    allPlay: allPlay({
      entries: [entry, { ...entry, playerId: BOB, submitted: true, isCorrect: true }],
    }),
  });
  expect(allPlayAnswerModel(ctx).action).toEqual({
    kind: "info",
    text: "dock.answering.pickOption",
  });
  expect(allPlayAnswerModel({ ...ctx, myId: BOB }).status).toBe("dock.final.answerLocked");
  expect(allPlayAnswerModel({ ...ctx, myId: SAM }).action).toEqual({
    kind: "info",
    text: "dock.allPlay.answerWatch",
  });
  expect(allPlayReviewModel({ ...ctx, role: "showman" })).toMatchObject({
    ringLabel: "1/2",
    action: { text: "dock.allPlay.reviewShowman" },
  });
  expect(allPlayReviewModel(ctx).action).toEqual({ kind: "info", text: "dock.final.reviewWait" });
});
