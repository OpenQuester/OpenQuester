import { describe, expect, it } from "vitest";

import { remainingMs } from "@/lib/timer";

import { ALICE, BOB, choosing, question, round, SAM, session, SHOWMAN, timer } from "./fixtures";
import { reduce } from "./reducer";
import {
  buzzerLockLeft,
  buzzerOpensIn,
  roundTimeLeft,
  canBuzz,
  canPick,
  initials,
  phaseOf,
  questionValue,
  standings,
  wrongCostsPoints,
} from "./selectors";

const showing = (extra = {}) =>
  session({
    currentRound: round(),
    questionState: "showing",
    currentQuestion: question(100),
    timer: timer(),
    ...extra,
  });

describe("canBuzz: one reason per unavailable buzzer", () => {
  it("lets an eligible player buzz while showing", () => {
    expect(canBuzz(showing(), ALICE)).toEqual({ ok: true });
  });

  it.each([
    ["showman", SHOWMAN, showing(), "wrong_role"],
    ["spectator", SAM, showing(), "wrong_role"],
    ["paused", ALICE, showing({ isPaused: true }), "paused"],
    ["media loading", ALICE, showing({ questionState: "media_downloading" }), "waiting_for_media"],
    ["choosing", ALICE, choosing(), "wrong_phase"],
    ["joined late", ALICE, showing({ questionEligiblePlayers: [BOB] }), "not_eligible"],
    [
      "already answered",
      ALICE,
      showing({
        answeredPlayers: [{ player: ALICE, result: -100, score: -100, answerType: "wrong" }],
      }),
      "already_done",
    ],
    ["passed", ALICE, showing({ skippedPlayers: [ALICE] }), "skipped"],
    [
      "someone else answering",
      ALICE,
      showing({ questionState: "answering", answeringPlayer: BOB }),
      "not_your_turn",
    ],
  ] as const)("%s → %s", (_label, id, s, reason) => {
    expect(canBuzz(s, id)).toEqual({ ok: false, reason });
  });

  it("reports a lost connection", () => {
    expect(canBuzz(showing(), ALICE, false)).toEqual({ ok: false, reason: "connection_lost" });
  });
});

describe("canPick", () => {
  const cell = { id: 100, order: 0, price: 100, isPlayed: false };
  it("allows the turn player and the showman", () => {
    expect(canPick(choosing(), ALICE, cell).ok).toBe(true);
    expect(canPick(choosing(), SHOWMAN, cell).ok).toBe(true);
  });
  it("explains why others cannot", () => {
    expect(canPick(choosing(), BOB, cell)).toEqual({ ok: false, reason: "not_your_turn" });
    expect(canPick(choosing(), SAM, cell)).toEqual({ ok: false, reason: "wrong_role" });
    expect(canPick(choosing(), ALICE, { ...cell, isPlayed: true })).toEqual({
      ok: false,
      reason: "already_done",
    });
  });
});

describe("phaseOf", () => {
  it("covers lobby, board and finish", () => {
    expect(phaseOf(session())).toBe("lobby");
    expect(phaseOf(choosing())).toBe("choosing");
    expect(phaseOf(reduce(choosing(), { type: "game-finished", payload: true }))).toBe("finished");
  });
});

describe("questionValue", () => {
  it("uses the price, the no-risk multiplier and the stake bid", () => {
    expect(questionValue(showing())).toBe(100);
    const noRisk = showing({
      currentQuestion: question(100, { type: "noRisk", priceMultiplier: 2 }),
    });
    expect(questionValue(noRisk)).toBe(200);
    expect(wrongCostsPoints(noRisk)).toBe(false);
    const stake = showing({
      currentQuestion: question(100, { type: "stake" }),
      stakeQuestionData: {
        pickerPlayerId: ALICE,
        questionId: 100,
        maxPrice: null,
        bids: {},
        passedPlayers: [],
        biddingOrder: [ALICE],
        currentBidderIndex: 0,
        highestBid: 450,
        winnerPlayerId: ALICE,
        biddingPhase: false,
      },
    });
    expect(questionValue(stake)).toBe(450);
  });
});

describe("helpers", () => {
  it("ranks players by score", () => {
    let s = reduce(choosing(), {
      type: "score-changed",
      payload: { playerId: BOB, newScore: 500 },
    });
    s = reduce(s, { type: "score-changed", payload: { playerId: ALICE, newScore: 200 } });
    expect(standings(s).map((p) => p.meta.id)).toEqual([BOB, ALICE]);
  });

  it("makes initials", () => {
    expect(initials("Mira")).toBe("MI");
    expect(initials("Roma Ivanov")).toBe("RI");
    expect(initials("guest_001")).toBe("G0");
    expect(initials("  ")).toBe("?");
  });

  it("counts timers down from the last resume", () => {
    const now = Date.parse("2026-01-01T00:00:10Z");
    const t = {
      startedAt: "2026-01-01T00:00:00Z",
      resumedAt: "2026-01-01T00:00:05Z",
      durationMs: 20_000,
      elapsedMs: 4_000,
    };
    expect(remainingMs(t, false, now)).toBe(11_000);
    expect(remainingMs(t, true, now)).toBe(16_000);
    expect(remainingMs(null)).toBeNull();
  });
});

describe("buzzer timing", () => {
  const startedAgo = (ms: number) => ({
    startedAt: new Date(Date.now() - ms).toISOString(),
    durationMs: 30_000,
    elapsedMs: 0,
    resumedAt: null,
  });

  it("is closed until the SHOWING timer reaches the opening point", () => {
    const s = showing({ timer: startedAgo(1_000), buzzerOpensAtMs: 3_000 });
    expect(buzzerOpensIn(s)).toBeGreaterThan(1_500);
    expect(buzzerOpensIn(s)).toBeLessThanOrEqual(2_000);
    // An early press is still allowed: the server turns it into a false start
    expect(canBuzz(s, ALICE)).toEqual({ ok: true });
  });

  it("is open once the opening point has passed", () => {
    expect(buzzerOpensIn(showing({ timer: startedAgo(4_000), buzzerOpensAtMs: 3_000 }))).toBe(0);
    expect(buzzerOpensIn(showing({ timer: startedAgo(0), buzzerOpensAtMs: null }))).toBe(0);
  });

  it("is never early for a designated answerer", () => {
    const s = showing({ timer: startedAgo(0), buzzerOpensAtMs: 3_000, answeringPlayer: ALICE });
    expect(buzzerOpensIn(s)).toBe(0);
  });

  it("locks out a player after a false start", () => {
    const s = reduce(showing(), {
      type: "buzzer-false-start",
      payload: { playerId: ALICE, lockMs: 3_000 },
    });
    expect(buzzerLockLeft(s, ALICE)).toBeGreaterThan(2_500);
    expect(buzzerLockLeft(s, BOB)).toBe(0);
    expect(canBuzz(s, ALICE)).toEqual({ ok: false, reason: "false_start" });
    expect(canBuzz(s, BOB)).toEqual({ ok: true });
  });
});

describe("game rules", () => {
  it("makes a wrong buzzer answer free when the game has no penalty", () => {
    const s = showing({ currentQuestion: question(100) });
    expect(wrongCostsPoints(s)).toBe(true);
    expect(
      wrongCostsPoints({
        ...s,
        settings: { falseStart: true, buttonPressMode: "first_wins", wrongAnswerPenalty: "none" },
      }),
    ).toBe(false);
  });

  it("counts down a round with a time limit, not counting pauses", () => {
    const now = Date.now();
    const s = {
      ...showing({
        roundStartedAt: now - 12 * 60_000,
        roundPausedMs: 3 * 60_000,
      }),
      settings: {
        falseStart: true,
        buttonPressMode: "first_wins" as const,
        timers: { roundMs: 10 * 60_000 },
      },
    };
    expect(roundTimeLeft(s, now)).toBe(60_000);
    expect(roundTimeLeft({ ...s, settings: null }, now)).toBeNull();
  });
});
