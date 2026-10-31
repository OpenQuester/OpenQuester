import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ALICE, BOB, question, round, session, snapshot } from "./fixtures";
import { reduce, sessionFromSnapshot } from "./reducer";
import { questionOutcomes } from "./questionFeedback";
import { createGameStore } from "./store";
import { GameContext } from "@/features/game/GameContext";
import { PlayerChips } from "@/features/game/play/PlayerChips";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("uses judgments and zero/pass outcomes, and removes an undone result", () => {
  let game = session({
    currentRound: round(),
    currentQuestion: question(),
    questionState: "showing",
    skippedPlayers: [BOB],
  });
  game = reduce(game, {
    type: "answer-result",
    payload: {
      answerResult: { player: ALICE, result: -100, score: -100, answerType: "wrong" },
      timer: null,
    },
  });
  expect(game.questionFeedback?.current).toEqual({ [ALICE]: "wrong", [BOB]: "neutral" });
  game = reduce(game, { type: "score-changed", payload: { playerId: BOB, newScore: 500 } });
  expect(game.questionFeedback?.current[BOB]).toBe("neutral");
  game = reduce(game, {
    type: "answer-result-undo",
    payload: { playerId: ALICE, newScore: 0, revertedResult: -100, canAnswerAgain: true },
  });
  expect(game.questionFeedback?.current[ALICE]).toBeUndefined();
  expect(
    questionOutcomes({
      ...game.state,
      allPlay: {
        mode: "noRisk",
        questionId: 100,
        price: 100,
        maxStake: null,
        priceMultiplier: null,
        entries: [
          {
            playerId: ALICE,
            stake: null,
            answer: "wrong",
            submitted: true,
            isCorrect: false,
            scoreChange: 0,
          },
          {
            playerId: BOB,
            stake: null,
            answer: "correct",
            submitted: true,
            isCorrect: true,
            scoreChange: 100,
          },
        ],
      },
    }),
  ).toEqual({ [ALICE]: "neutral", [BOB]: "correct" });
});

it("keeps results on the board until 15 seconds after finish, including unrelated events", () => {
  vi.useFakeTimers();
  const store = createGameStore();
  store.setState({
    session: session({
      currentRound: round(),
      currentQuestion: question(),
      questionState: "showing",
    }),
  });
  render(
    <GameContext.Provider
      value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
    >
      <PlayerChips />
    </GameContext.Provider>,
  );
  const dispatch = store.getState().dispatch;
  act(() =>
    dispatch({
      type: "answer-result",
      payload: {
        answerResult: { player: ALICE, result: 100, score: 100, answerType: "correct" },
        timer: null,
      },
    }),
  );
  const card = screen.getAllByTestId("player-chip")[0]!.querySelector(".player-card")!;
  expect(card).toHaveAttribute("data-outcome", "correct");
  act(() =>
    dispatch({
      type: "question-finish",
      payload: { answerText: "Answer", answerFiles: null, nextTurnPlayerId: ALICE },
    }),
  );
  act(() => dispatch({ type: "answer-show-end", payload: {} }));
  act(() => vi.advanceTimersByTime(14_999));
  act(() => dispatch({ type: "score-changed", payload: { playerId: ALICE, newScore: 500 } }));
  expect(card).toHaveAttribute("data-outcome", "correct");
  act(() => vi.advanceTimersByTime(1));
  expect(card).not.toHaveAttribute("data-outcome");
});

it("adds a point summary only at public reveal and deduplicates repeats and current snapshots", () => {
  let game = session({
    currentRound: round(),
    currentQuestion: question(100, { answerType: "point" }),
    questionState: "showing",
    answeredPlayers: [
      { player: ALICE, result: 100, score: 100, answerType: "correct", answerText: "0.5,0.5" },
    ],
  });
  expect(game.chat).toHaveLength(0);
  const payload = {
    answerText: "Center",
    answerFiles: null,
    nextTurnPlayerId: ALICE,
    answerPoint: { x: 0.5, y: 0.5 },
    answerPointImage: "/point.png",
  };
  game = reduce(game, { type: "question-finish", payload });
  game = reduce(game, { type: "question-finish", payload });
  expect(game.chat).toHaveLength(1);
  expect(game.chat[0]?.system?.params.players).toBe("user2 (+100)");
  const rejoined = sessionFromSnapshot("ABCD", snapshot(game.state));
  expect(rejoined.chat).toHaveLength(1);
  expect(rejoined.chat[0]?.uuid).toBe(game.chat[0]?.uuid);
  const deadline = game.questionFeedback?.expiresAt;
  game = reduce(game, {
    type: "answer-result-undo",
    payload: { playerId: ALICE, newScore: 0, revertedResult: 100, canAnswerAgain: false },
  });
  expect(game.questionFeedback?.current).toEqual({});
  expect(game.questionFeedback?.previous[ALICE]).toBeUndefined();
  expect(game.questionFeedback?.expiresAt).toBe(deadline);
  expect(game.chat).toHaveLength(1);
  expect(game.chat[0]?.system?.params.players).toBe("");
});
