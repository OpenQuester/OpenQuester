import { expect, it } from "vitest";

import { ALICE, BOB, SAM, SHOWMAN, player, round, snapshot } from "@/game/fixtures";
import { sessionFromSnapshot } from "@/game/reducer";
import type { ActionDockContext } from "./actionDockModel";
import { finalAnswerModel, finalBidModel } from "./finalModels";

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
