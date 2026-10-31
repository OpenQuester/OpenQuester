import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameContext } from "@/features/game/GameContext";
import { ALICE, BOB, player, round, SAM, session, SHOWMAN, snapshot } from "@/game/fixtures";
import type { AllPlayEntry } from "@/game/protocol";
import { reduce, sessionFromSnapshot, type GameSession } from "@/game/reducer";
import { createGameStore } from "@/game/store";
import { GameActionDock } from "./GameActionDock";
import { AnswerReveal } from "./question/AnswerReveal";

afterEach(cleanup);

const entry = (playerId: number, extra: Partial<AllPlayEntry> = {}): AllPlayEntry => ({
  playerId,
  stake: null,
  answer: "answer",
  submitted: true,
  isCorrect: false,
  scoreChange: 0,
  ...extra,
});

function revealSession(entries: AllPlayEntry[]): GameSession {
  return session({
    currentRound: round(),
    questionState: "showing_answer",
    allPlay: {
      mode: "noRisk",
      questionId: 100,
      price: 100,
      maxStake: null,
      priceMultiplier: null,
      entries,
    },
    answerShowData: {
      answerText: "Answer",
      answerFiles: null,
      nextTurnPlayerId: ALICE,
      answerResult: {
        player: BOB,
        answerType: "correct",
        result: 999,
        score: 999,
        answerText: "stale",
      },
    },
  });
}

function renderResult(s: GameSession) {
  const store = createGameStore();
  store.setState({ session: s, connection: "connected" });
  render(
    <GameContext.Provider
      value={{ store, myId: SAM, connection: { connected: true, emit: () => {} } }}
    >
      <AnswerReveal />
      <GameActionDock />
    </GameContext.Provider>,
  );
  return {
    stage: within(screen.getByTestId("answer-reveal")),
    dock: screen.getByTestId("dock-status"),
  };
}

describe("all-play reveal", () => {
  it("keeps automatic and manually accepted zero-point answers after events and rejoin", () => {
    const auto = entry(ALICE, { isCorrect: true, scoreChange: 0 });
    const pending = entry(BOB, { isCorrect: null, scoreChange: null });
    let live = session(
      {
        currentRound: round(),
        questionState: "reviewing",
        allPlay: {
          mode: "noRisk",
          questionId: 100,
          price: 0,
          maxStake: null,
          priceMultiplier: null,
          entries: [auto, pending],
        },
      },
      [
        player(SHOWMAN, "showman"),
        player(ALICE, "player", { score: -100 }),
        player(BOB, "player"),
        player(SAM, "spectator"),
      ],
    );
    live = reduce(live, {
      type: "all-play-review",
      payload: { playerId: BOB, isCorrect: true, scoreChange: 0, newScore: 0 },
    });
    live = reduce(live, {
      type: "question-finish",
      payload: { answerText: "42", answerFiles: null, nextTurnPlayerId: ALICE },
    });
    const rejoined = sessionFromSnapshot("ABCD", snapshot(live.state, live.players));
    const { stage, dock } = renderResult(rejoined);
    expect(stage.getByTestId("reveal-result")).toHaveTextContent(
      "Correct answers: user2 (0), user3 (0)",
    );
    expect(dock).toHaveTextContent("Correct: 2/2");
  });

  it("retains a single correct player without a name or fabricated score", () => {
    const { stage, dock } = renderResult(
      revealSession([entry(999, { isCorrect: true, scoreChange: null }), entry(BOB)]),
    );
    expect(stage.getByTestId("reveal-result")).toHaveTextContent("Correct answers: Player 999");
    expect(dock).toHaveTextContent("Correct: 1/2");
    expect(stage.queryByTestId("submitted-answer")).toBeNull();
    expect(stage.queryByText(/999\)/)).toBeNull();
  });

  it.each([
    [[entry(ALICE, { submitted: false, answer: null })], "No one submitted an answer."],
    [[entry(ALICE)], "No one answered correctly."],
    [[entry(ALICE, { isCorrect: null, scoreChange: null })], "Some answers have not been judged."],
  ])("distinguishes empty, wrong and unresolved answers", (entries, message) => {
    const { stage, dock } = renderResult(revealSession(entries));
    expect(stage.getByTestId("reveal-result")).toHaveTextContent(message);
    expect(dock).toHaveTextContent(message);
    expect(stage.queryByTestId("submitted-answer")).toBeNull();
  });

  it("shows accepted players while marking remaining submitted answers unresolved", () => {
    const { stage, dock } = renderResult(
      revealSession([
        entry(ALICE, { isCorrect: true, scoreChange: 100 }),
        entry(BOB, { isCorrect: null, scoreChange: null }),
      ]),
    );
    const message = "Correct answers: user2 (+100) Some answers have not been judged.";
    expect(stage.getByTestId("reveal-result")).toHaveTextContent(message);
    expect(dock).toHaveTextContent("Correct: 1/2 · Some answers have not been judged.");
  });
});
