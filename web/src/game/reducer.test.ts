import { describe, expect, it } from "vitest";

import {
  ALICE,
  BOB,
  choosing,
  player,
  question,
  round,
  session,
  SHOWMAN,
  snapshot,
  timer,
} from "./fixtures";
import type { ServerEvent } from "./protocol";
import { isStarted, reduce, type GameSession } from "./reducer";
import { phaseOf } from "./selectors";

const run = (s: GameSession, ...events: ServerEvent[]) => events.reduce(reduce, s);

describe("reducer: lobby", () => {
  it("adds joining players and marks leavers offline", () => {
    let s = session();
    s = reduce(s, { type: "join", payload: player(9, "player") });
    expect(s.players.map((p) => p.meta.id)).toContain(9);
    s = reduce(s, { type: "user-leave", payload: { user: 9 } });
    expect(s.players.find((p) => p.meta.id === 9)?.status).toBe("disconnected");
    s = reduce(s, { type: "join", payload: player(9, "player") });
    expect(s.players.filter((p) => p.meta.id === 9)).toHaveLength(1);
    expect(s.players.find((p) => p.meta.id === 9)?.status).toBe("in-game");
  });

  it("tracks readiness and starts with the first picker", () => {
    let s = session();
    s = reduce(s, {
      type: "player-ready",
      payload: { playerId: ALICE, isReady: true, readyPlayers: [ALICE] },
    });
    expect(s.state.readyPlayers).toEqual([ALICE]);
    expect(isStarted(s)).toBe(false);
    s = reduce(s, { type: "start", payload: { currentRound: round(), currentTurnPlayerId: BOB } });
    expect(isStarted(s)).toBe(true);
    expect(phaseOf(s)).toBe("choosing");
    expect(s.state.currentTurnPlayerId).toBe(BOB);
  });

  it("removes kicked players", () => {
    const s = reduce(session(), { type: "player-kicked", payload: { playerId: BOB } });
    expect(s.players.some((p) => p.meta.id === BOB)).toBe(false);
  });
});

describe("reducer: regular question", () => {
  it("applies renamed board and join-mode broadcasts", () => {
    let s = choosing();
    const questionId = s.state.currentRound!.themes[0]!.questions[0]!.id;

    for (const isPlayed of [true, false]) {
      s = reduce(s, { type: "question-remove-restore", payload: { questionId, isPlayed } });
      expect(s.state.currentRound!.themes[0]!.questions[0]!.isPlayed).toBe(isPlayed);
    }

    for (const joinMode of ["closed", "spectators_only", "open"] as const) {
      s = reduce(s, { type: "game-join-mode-change", payload: { joinMode } });
      expect(s.state.joinMode).toBe(joinMode === "open" ? null : joinMode);
    }

    expect(phaseOf(s)).toBe("choosing");
  });

  it("runs pick → media → showing → answering → reveal → choosing", () => {
    let s = reduce(choosing(), {
      type: "question-data",
      payload: { data: question(100), timer: timer(10_000) },
    });
    expect(phaseOf(s)).toBe("media");
    expect(s.state.currentRound!.themes[0]!.questions[0]!.isPlayed).toBe(true);

    s = reduce(s, {
      type: "media-download-status",
      payload: { playerId: ALICE, mediaDownloaded: true, allPlayersReady: false, timer: null },
    });
    expect(phaseOf(s)).toBe("media");
    expect(s.players.find((p) => p.meta.id === ALICE)?.mediaDownloaded).toBe(true);

    s = reduce(s, {
      type: "media-download-status",
      payload: { playerId: BOB, mediaDownloaded: true, allPlayersReady: true, timer: timer() },
    });
    expect(phaseOf(s)).toBe("showing");

    s = reduce(s, { type: "question-answer", payload: { userId: ALICE, timer: timer(60_000) } });
    expect(phaseOf(s)).toBe("answering");
    expect(s.state.answeringPlayer).toBe(ALICE);

    s = reduce(s, { type: "answer-submitted", payload: { answerText: "Paris" } });
    expect(s.submittedAnswer).toBe("Paris");

    s = run(
      s,
      {
        type: "answer-result",
        payload: {
          answerResult: { player: ALICE, result: 100, score: 100, answerType: "correct" },
          timer: timer(3000),
        },
      },
      {
        type: "question-finish",
        payload: { answerFiles: null, answerText: "Paris", nextTurnPlayerId: ALICE },
      },
      { type: "answer-show-start", payload: {} },
    );
    expect(phaseOf(s)).toBe("reveal");
    expect(s.players.find((p) => p.meta.id === ALICE)?.score).toBe(100);
    expect(s.lastResult?.answerType).toBe("correct");
    expect(s.state.answerShowData?.answerText).toBe("Paris");

    s = reduce(s, { type: "answer-show-end", payload: {} });
    expect(phaseOf(s)).toBe("choosing");
    expect(s.state.currentQuestion).toBeNull();
    expect(s.state.answeredPlayers).toBeNull();
    expect(s.state.currentTurnPlayerId).toBe(ALICE);
  });

  it("reopens the buzzer after a wrong answer when others can still answer", () => {
    let s = run(
      choosing(),
      { type: "question-data", payload: { data: question(100), timer: timer() } },
      {
        type: "media-download-status",
        payload: { playerId: -1, mediaDownloaded: true, allPlayersReady: true, timer: timer() },
      },
      { type: "question-answer", payload: { userId: BOB, timer: timer() } },
      {
        type: "answer-result",
        payload: {
          answerResult: { player: BOB, result: -100, score: -100, answerType: "wrong" },
          timer: timer(),
        },
      },
    );
    expect(phaseOf(s)).toBe("showing");
    expect(s.state.answeredPlayers).toHaveLength(1);
    s = reduce(s, { type: "question-skip", payload: { playerId: ALICE } });
    expect(s.state.skippedPlayers).toEqual([ALICE]);
    s = reduce(s, { type: "question-unskip", payload: { playerId: ALICE } });
    expect(s.state.skippedPlayers).toEqual([]);
  });

  it.each(["correct", "wrong", "skip"] as const)(
    "removes an undone %s ruling from both the reveal and attempt history",
    (answerType) => {
      const previous = { player: BOB, result: -100, score: -100, answerType: "wrong" as const };
      const result = answerType === "correct" ? 100 : answerType === "wrong" ? -100 : 0;
      const undone = { player: ALICE, result, score: result, answerType };
      let s = session({
        currentRound: round(),
        currentQuestion: question(),
        questionState: "showing_answer",
        answeredPlayers: [previous, undone],
        answerShowData: {
          answerFiles: null,
          answerText: "Paris",
          nextTurnPlayerId: BOB,
          answerResult: { ...undone },
        },
      });
      s = { ...s, lastResult: { ...undone, key: 1 } };
      s = reduce(s, {
        type: "answer-result-undo",
        payload: { playerId: ALICE, revertedResult: result, newScore: 0, canAnswerAgain: false },
      });
      expect(s.state.answeredPlayers).toEqual([previous]);
      expect(s.state.answerShowData).toMatchObject({ answerText: "Paris" });
      expect(s.state.answerShowData?.answerResult).toBeUndefined();
      expect(s.lastResult).toBeNull();
      expect(s.players.find((p) => p.meta.id === ALICE)?.score).toBe(0);
      expect(phaseOf(s)).toBe("reveal");

      s = reduce(s, {
        type: "answer-result-undo",
        payload: { playerId: BOB, revertedResult: -100, newScore: 0, canAnswerAgain: false },
      });
      expect(s.state.answeredPlayers).toEqual([]);
    },
  );

  it("does not reopen single-answerer questions after a wrong answer", () => {
    const s = run(
      choosing(),
      {
        type: "question-data",
        payload: { data: question(100, { type: "noRisk" }), timer: timer() },
      },
      {
        type: "media-download-status",
        payload: { playerId: -1, mediaDownloaded: true, allPlayersReady: true, timer: timer() },
      },
      { type: "question-answer", payload: { userId: BOB, timer: timer() } },
      {
        type: "answer-result",
        payload: {
          answerResult: { player: BOB, result: 0, score: 0, answerType: "wrong" },
          timer: timer(),
        },
      },
    );
    expect(phaseOf(s)).toBe("answering");
  });

  it("keeps the snapshot phase when question data is re-sent after a rejoin", () => {
    let s = session({ currentRound: round(), questionState: "showing", timer: timer() });
    s = reduce(s, { type: "question-data", payload: { data: question(101), timer: timer() } });
    expect(phaseOf(s)).toBe("showing");
    expect(s.state.currentQuestion?.id).toBe(101);
  });

  it("keeps the question paused when it is re-sent while someone answers", () => {
    // Reloading mid-answer: the snapshot knows the question is frozen. The
    // re-sent question-data carries the answer timer, which must not restart
    // the media from the top.
    const plan = {
      steps: [{ startMs: 0, durationMs: 10_000, items: [] }],
      totalMs: 10_000,
    };
    let s = session({
      currentRound: round(),
      questionState: "answering",
      answeringPlayer: BOB,
      currentQuestion: question(101),
      questionContentPlan: plan,
      timer: timer(),
    });
    expect(s.content?.timer).toBeNull();
    s = reduce(s, {
      type: "question-data",
      payload: { data: question(101), timer: timer(), contentPlan: plan },
    });
    expect(phaseOf(s)).toBe("answering");
    expect(s.content?.kind).toBe("question");
    expect(s.content?.timer).toBeNull();
  });

  it("opens the buzzer early when the showman says so", () => {
    let s = session({
      currentRound: round(),
      questionState: "showing",
      timer: timer(),
      buzzerOpensAtMs: 8_000,
      buzzerLocks: { [String(ALICE)]: Date.now() + 3000 },
    });
    s = reduce(s, { type: "buzzer-open", payload: { buzzerOpensAtMs: 1200 } });
    expect(s.state.buzzerOpensAtMs).toBe(1200);
    expect(s.state.buzzerLocks).toBeNull();
  });

  it("goes straight to showing for a special question with no auction or transfer", () => {
    const s = reduce(choosing(), {
      type: "question-data",
      payload: { data: question(101, { type: "secret" }), timer: timer() },
    });
    expect(phaseOf(s)).toBe("showing");
  });

  it("pauses and resumes", () => {
    let s = reduce(choosing(), { type: "game-pause", payload: { timer: null } });
    expect(s.state.isPaused).toBe(true);
    s = reduce(s, { type: "game-unpause", payload: { timer: timer() } });
    expect(s.state.isPaused).toBe(false);
  });
});

describe("reducer: special questions", () => {
  it("runs a stake auction to the winner's answer", () => {
    let s = reduce(choosing(), {
      type: "stake-question-picked",
      payload: {
        pickerPlayerId: ALICE,
        questionId: 101,
        maxPrice: 1000,
        biddingOrder: [ALICE, BOB],
        timer: timer(),
      },
    });
    expect(phaseOf(s)).toBe("stake_bidding");
    s = reduce(s, {
      type: "stake-bid-submit",
      payload: {
        playerId: ALICE,
        bidAmount: 300,
        bidType: "normal",
        nextBidderId: BOB,
        timer: timer(),
      },
    });
    expect(s.state.stakeQuestionData?.highestBid).toBe(300);
    expect(s.state.currentTurnPlayerId).toBe(BOB);
    s = reduce(s, {
      type: "stake-bid-submit",
      payload: {
        playerId: BOB,
        bidAmount: null,
        bidType: "pass",
        isPhaseComplete: true,
        nextBidderId: null,
      },
    });
    expect(s.state.stakeQuestionData?.passedPlayers).toEqual([BOB]);
    s = run(
      s,
      { type: "stake-question-winner", payload: { winnerPlayerId: ALICE, finalBid: 300 } },
      {
        type: "question-data",
        payload: { data: question(101, { type: "stake" }), timer: timer() },
      },
    );
    expect(phaseOf(s)).toBe("answering");
    expect(s.state.answeringPlayer).toBe(ALICE);
  });

  it("hands a secret question to the chosen player", () => {
    let s = reduce(choosing(), {
      type: "secret-question-picked",
      payload: { pickerPlayerId: ALICE, transferType: "any", questionId: 101 },
    });
    expect(phaseOf(s)).toBe("secret_transfer");
    s = run(
      s,
      {
        type: "secret-question-transfer",
        payload: { fromPlayerId: ALICE, toPlayerId: BOB, questionId: 101 },
      },
      {
        type: "question-data",
        payload: { data: question(101, { type: "secret" }), timer: timer() },
      },
    );
    expect(phaseOf(s)).toBe("answering");
    expect(s.state.answeringPlayer).toBe(BOB);
  });

  it("lets the receiver pick the price of a customPrice secret question", () => {
    let s = reduce(choosing(), {
      type: "secret-question-picked",
      payload: { pickerPlayerId: ALICE, transferType: "any", questionId: 101 },
    });
    s = reduce(s, {
      type: "secret-question-transfer",
      payload: {
        fromPlayerId: ALICE,
        toPlayerId: BOB,
        questionId: 101,
        allowedPrices: [100, 300],
        timer: timer(30_000),
      },
    });
    expect(phaseOf(s)).toBe("secret_transfer");
    expect(s.state.secretQuestionData?.priceSelection).toEqual({
      playerId: BOB,
      allowedPrices: [100, 300],
    });
    expect(s.state.timer?.durationMs).toBe(30_000);

    s = run(
      s,
      { type: "secret-question-price", payload: { playerId: BOB, price: 300, questionId: 101 } },
      {
        type: "question-data",
        payload: { data: question(101, { type: "secret", price: 300 }), timer: timer() },
      },
    );
    expect(phaseOf(s)).toBe("answering");
    expect(s.state.answeringPlayer).toBe(BOB);
    expect(s.state.currentQuestion?.price).toBe(300);
  });
});

describe("reducer: final round", () => {
  const final = () =>
    session({
      currentRound: round("final"),
      questionState: "theme_elimination",
      currentTurnPlayerId: ALICE,
      finalRoundData: {
        phase: "theme_elimination",
        turnOrder: [ALICE, BOB],
        bids: {},
        answers: [],
        eliminatedThemes: [],
      },
    });

  it("eliminates themes, collects bids and answers, then reviews", () => {
    let s = reduce(final(), {
      type: "theme-eliminate",
      payload: { themeId: 10, eliminatedBy: ALICE, nextPlayerId: BOB },
    });
    expect(s.state.finalRoundData?.eliminatedThemes).toEqual([10]);
    expect(s.state.currentTurnPlayerId).toBe(BOB);

    s = reduce(s, {
      type: "final-phase-complete",
      payload: { phase: "theme_elimination", nextPhase: "bidding", timer: timer() },
    });
    expect(phaseOf(s)).toBe("final_bidding");
    s = reduce(s, { type: "final-bid-submit", payload: { playerId: ALICE, bidAmount: 50 } });
    expect(s.state.finalRoundData?.bids[String(ALICE)]).toBe(50);

    s = run(
      s,
      {
        type: "final-question-data",
        payload: { questionData: { themeId: 11, themeName: "Science", question: question(110) } },
      },
      {
        type: "final-phase-complete",
        payload: { phase: "bidding", nextPhase: "answering", timer: timer() },
      },
    );
    expect(phaseOf(s)).toBe("final_answering");
    s = run(
      s,
      { type: "final-answer-submit", payload: { playerId: ALICE } },
      { type: "final-auto-loss", payload: { playerId: BOB, reason: "empty_answer" } },
    );
    expect(s.finalSubmitted).toEqual([ALICE, BOB]);

    s = reduce(s, {
      type: "final-submit-end",
      payload: {
        phase: "answering",
        nextPhase: "reviewing",
        allReviews: [
          {
            playerId: ALICE,
            answerId: "a",
            answerText: "Tungsten",
            scoreChange: 0,
            answerType: "pending",
            isCorrect: null,
          },
          {
            playerId: BOB,
            answerId: "b",
            answerText: "",
            scoreChange: -10,
            answerType: "auto_loss",
            isCorrect: false,
          },
        ],
      },
    });
    expect(phaseOf(s)).toBe("final_reviewing");
    expect(s.state.finalRoundData?.answers).toHaveLength(2);

    s = reduce(s, {
      type: "final-answer-review",
      payload: { answerId: "a", playerId: ALICE, isCorrect: true, scoreChange: 50 },
    });
    expect(s.players.find((p) => p.meta.id === ALICE)?.score).toBe(50);
    s = run(
      s,
      {
        type: "question-finish",
        payload: { answerFiles: null, answerText: "Tungsten", nextTurnPlayerId: null },
      },
      { type: "game-finished", payload: true },
    );
    expect(phaseOf(s)).toBe("finished");
    expect(s.state.answerShowData?.answerText).toBe("Tungsten");
  });
});

describe("reducer: snapshots and housekeeping", () => {
  it("replaces everything with a fresh snapshot", () => {
    const s = reduce(choosing(), { type: "game-data", payload: snapshot() });
    expect(isStarted(s)).toBe(false);
  });

  it("applies scores, roles and chat without duplicates", () => {
    let s = reduce(choosing(), {
      type: "score-changed",
      payload: { playerId: BOB, newScore: 700 },
    });
    expect(s.players.find((p) => p.meta.id === BOB)?.score).toBe(700);
    const msg = { uuid: "1", timestamp: "", user: SHOWMAN, message: "hi" };
    s = run(s, { type: "chat-message", payload: msg }, { type: "chat-message", payload: msg });
    expect(s.chat).toHaveLength(1);
    s = reduce(s, {
      type: "player-role-change",
      payload: { playerId: BOB, newRole: "spectator", players: [player(BOB, "spectator")] },
    });
    expect(s.players).toHaveLength(1);
  });

  it("returns the same object for events that change nothing", () => {
    const s = choosing();
    expect(
      reduce(s, { type: "final-bid-submit", payload: { playerId: ALICE, bidAmount: 1 } }),
    ).toBe(s);
  });
});

describe("reducer: servers that do not announce the first picker", () => {
  it("lets players try to pick until the turn is known", () => {
    let s = reduce(session(), { type: "start", payload: { currentRound: round() } });
    expect(s.turnUnknown).toBe(true);
    s = reduce(s, {
      type: "question-finish",
      payload: { answerFiles: null, answerText: "x", nextTurnPlayerId: BOB },
    });
    expect(s.turnUnknown).toBe(false);
    expect(s.state.currentTurnPlayerId).toBe(BOB);
  });
});
