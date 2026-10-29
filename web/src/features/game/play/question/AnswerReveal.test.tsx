import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameContext } from "@/features/game/GameContext";
import { ALICE, question, round, session } from "@/game/fixtures";
import { createGameStore } from "@/game/store";
import { AnswerReveal } from "./AnswerReveal";
import { newQuestion, toUploadQuestion } from "@/features/package-editor/packageDraft";
import { playableNumericQuestion } from "@/features/package-editor/numericAnswer";

afterEach(cleanup);

it("shows the projected numeric answer from a rejoined reveal snapshot without old aliases", () => {
  const question = playableNumericQuestion(
    toUploadQuestion(
      newQuestion(100, {
        answerType: "number",
        answerNumber: 0,
        answerText: "Old answer",
        rightAnswers: ["Old alias"],
      }),
      0,
      false,
    ),
  );
  const store = createGameStore();
  store.setState({
    session: session({
      currentRound: round(),
      questionState: "showing_answer",
      currentQuestion: null,
      answerShowData: {
        answerText: question.answerText ?? null,
        rightAnswers: question.rightAnswers ?? null,
        answerFiles: null,
        nextTurnPlayerId: ALICE,
      },
    }),
  });
  render(
    <GameContext.Provider
      value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
    >
      <AnswerReveal />
    </GameContext.Provider>,
  );
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.queryByText(/Old answer|Old alias/)).not.toBeInTheDocument();
});

it.each(["0", "A different response"])(
  "shows actual player text %s separately from the authored answer after rejoin",
  (text) => {
    const store = createGameStore();
    store.setState({
      session: session({
        currentRound: round(),
        questionState: "showing_answer",
        currentQuestion: null,
        answerShowData: {
          answerText: "Canonical",
          answerFiles: null,
          nextTurnPlayerId: ALICE,
          answerResult: {
            player: ALICE,
            answerType: "correct",
            result: 0,
            score: 100,
            answerText: text,
          },
        },
      }),
    });
    render(
      <GameContext.Provider
        value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
      >
        <AnswerReveal />
      </GameContext.Provider>,
    );
    expect(screen.getByText("Canonical")).toBeInTheDocument();
    expect(screen.getByTestId("submitted-answer")).toHaveTextContent(text);
    expect(screen.getByTestId("submitted-answer")).toHaveTextContent("user2");
    expect(screen.getByText(/answers correctly/)).toBeInTheDocument();
  },
);

it("does not fabricate a submitted answer for oral and legacy results", () => {
  const store = createGameStore();
  store.setState({
    session: session({
      currentRound: round(),
      questionState: "showing_answer",
      answerShowData: {
        answerText: "Canonical",
        answerFiles: null,
        nextTurnPlayerId: ALICE,
        answerResult: { player: ALICE, answerType: "correct", result: 100, score: 100 },
      },
    }),
  });
  render(
    <GameContext.Provider
      value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
    >
      <AnswerReveal />
    </GameContext.Provider>,
  );
  expect(screen.queryByTestId("submitted-answer")).toBeNull();
});

it("shows a judged attempt from a rejoined forced reveal and removes it after undo", () => {
  const store = createGameStore();
  store.setState({
    session: session({
      currentRound: round(),
      questionState: "showing_answer",
      currentQuestion: null,
      answeredPlayers: [
        {
          player: ALICE,
          answerType: "wrong",
          result: -100,
          score: -100,
          answerText: "wrong but real",
        },
      ],
      answerShowData: { answerText: "Canonical", answerFiles: null, nextTurnPlayerId: ALICE },
    }),
  });
  render(
    <GameContext.Provider
      value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
    >
      <AnswerReveal />
    </GameContext.Provider>,
  );
  expect(screen.getByTestId("submitted-answer")).toHaveTextContent("wrong but real");
  act(() =>
    store.getState().dispatch({
      type: "answer-result-undo",
      payload: { playerId: ALICE, revertedResult: -100, newScore: 0, canAnswerAgain: false },
    }),
  );
  expect(screen.queryByTestId("submitted-answer")).toBeNull();
});

describe("point answer reveal", () => {
  it("uses the labeled marker instead of raw coordinates, while keeping score and accessible details", () => {
    const store = createGameStore();
    store.setState({
      session: session({
        currentRound: round(),
        questionState: "showing_answer",
        currentQuestion: null,
        answerShowData: {
          answerText: "Center",
          answerFiles: null,
          nextTurnPlayerId: ALICE,
          answerPoint: { x: 0.5, y: 0.5 },
          answerPointImage: "/point.png",
          answerResult: {
            player: ALICE,
            answerType: "correct",
            result: 100,
            score: 100,
            answerText: "0.514,0.469",
          },
        },
      }),
    });
    render(
      <GameContext.Provider
        value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
      >
        <AnswerReveal />
      </GameContext.Provider>,
    );
    expect(screen.queryByTestId("submitted-answer")).toBeNull();
    expect(screen.getByTestId("point-answer-marker")).toHaveTextContent("user2");
    expect(screen.getByText(/answers correctly/)).toHaveTextContent("+100");
    expect(screen.getByText(/user2 selected/)).toHaveClass("sr-only");
  });

  it("retains a point answer when the marker cannot be displayed", () => {
    const store = createGameStore();
    store.setState({
      session: session({
        currentRound: round(),
        questionState: "showing_answer",
        currentQuestion: null,
        answerShowData: {
          answerText: null,
          answerFiles: null,
          nextTurnPlayerId: ALICE,
          answerPoint: { x: 0.5, y: 0.5 },
          answerPointImage: null,
          answerResult: {
            player: ALICE,
            answerType: "wrong",
            result: -100,
            score: -100,
            answerText: "0.514,0.469",
          },
        },
      }),
    });
    render(
      <GameContext.Provider
        value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
      >
        <AnswerReveal />
      </GameContext.Provider>,
    );
    expect(screen.getByTestId("submitted-answer")).toHaveTextContent("0.514,0.469");
  });
  it("restores the image and radius from a rejoined snapshot without a current question", () => {
    const store = createGameStore();
    store.setState({
      session: session({
        currentRound: round(),
        questionState: "showing_answer",
        currentQuestion: null,
        answerShowData: {
          answerText: "Center",
          answerFiles: null,
          nextTurnPlayerId: ALICE,
          answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
          answerDeviation: 0.1,
          answerPointImage: "/point.png",
        },
      }),
    });
    render(
      <GameContext.Provider
        value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
      >
        <AnswerReveal />
      </GameContext.Provider>,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/point.png");
    expect(screen.getByTestId("point-target")).toHaveStyle({
      left: "50%",
      top: "50%",
      width: "20%",
    });
    expect(screen.getByText("Center")).toBeInTheDocument();
  });

  it("uses the current question image when an older reveal payload has no image field", () => {
    const store = createGameStore();
    store.setState({
      session: session({
        currentRound: round(),
        questionState: "showing_answer",
        currentQuestion: question(100, {
          answerType: "point",
          questionFiles: [
            {
              order: 0,
              displayTime: null,
              file: { md5: "image", type: "image", link: "/legacy.png" },
            },
          ],
        }),
        answerShowData: {
          answerText: "Center",
          answerFiles: null,
          nextTurnPlayerId: ALICE,
          answerPoint: { x: 0.5, y: 0.5 },
          answerDeviation: 0.1,
        },
      }),
    });
    render(
      <GameContext.Provider
        value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
      >
        <AnswerReveal />
      </GameContext.Provider>,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/legacy.png");
    expect(screen.getByTestId("point-target")).toBeInTheDocument();
  });
});
