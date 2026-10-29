import { expect, it } from "vitest";

import { ALICE, BOB, player, question, round, session } from "@/game/fixtures";
import type { StakeQuestionData } from "@/game/protocol";
import type { ActionDockContext } from "./actionDockModel";
import { stakeModel } from "./specialModels";

function auction({
  price = 100,
  score = 1000,
  cap = null,
  highest = null,
  bids = {},
  otherScore = 300,
  pending = false,
}: {
  price?: number | null;
  score?: number;
  cap?: number | null;
  highest?: number | null;
  bids?: StakeQuestionData["bids"];
  otherScore?: number;
  pending?: boolean;
} = {}) {
  const board = round();
  if (price == null) board.themes = [];
  const s = session(
    {
      currentRound: board,
      currentQuestion: price == null ? null : question(100, { type: "stake", price }),
      currentTurnPlayerId: ALICE,
      questionState: "bidding",
      stakeQuestionData: {
        pickerPlayerId: ALICE,
        questionId: 100,
        maxPrice: cap,
        bids,
        passedPlayers: [],
        biddingOrder: [ALICE, BOB],
        currentBidderIndex: 0,
        highestBid: highest,
        winnerPlayerId: null,
        biddingPhase: true,
      },
    },
    [player(ALICE, "player", { score }), player(BOB, "player", { score: otherScore })],
  );
  const ctx: ActionDockContext = {
    session: s,
    myId: ALICE,
    role: "player",
    value: 0,
    name: () => "",
    buzzer: { open: false, opensInMs: 0, lockLeftMs: 0 },
    secretTarget: null,
    t: (key: string) => key,
    reason: (key: string) => key,
    sending: () => pending,
  };
  return stakeModel(ctx).action;
}

it("derives normal, all-in and pass capabilities from auction rules", () => {
  expect(auction()).toMatchObject({ range: { min: 100, max: 1000 }, allIn: 1000, pass: false });
  expect(auction({ score: 1000, cap: 500 })).toMatchObject({
    range: { min: 100, max: 500 },
    allIn: null,
    pass: false,
  });
  expect(auction({ score: 50 })).toMatchObject({
    range: null,
    allIn: null,
    pass: false,
    unavailable: "bid.waitTimer",
  });
  expect(auction({ score: 1000, highest: 300, bids: { [BOB]: 300 } })).toMatchObject({
    range: null,
    allIn: 1000,
    pass: true,
    unavailable: "bid.afterAllIn",
  });
  expect(auction({ score: 250, highest: 300, bids: { [BOB]: 300 } })).toMatchObject({
    range: null,
    allIn: null,
    pass: true,
  });
  expect(auction({ price: null, highest: 300, bids: { [BOB]: 200 } })).toMatchObject({
    range: null,
    allIn: null,
    pass: true,
    unavailable: "bid.detailsUnavailable",
  });
  expect(auction({ score: 100, pending: true })).toMatchObject({
    range: { min: 100, max: 100 },
    pending: true,
  });
});

it("uses the server's separate all-in price rule for zero and legacy negative prices", () => {
  expect(auction({ price: 0, score: 0 })).toMatchObject({ range: null, allIn: null, pass: false });
  expect(auction({ price: -100, score: 0 })).toMatchObject({ range: null, allIn: 0, pass: false });
  expect(auction({ price: -100, score: -50 })).toMatchObject({
    range: null,
    allIn: -50,
    pass: false,
  });
});
