import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameConnection } from "@/game/connection";
import { ALICE, question, round, session, timer } from "@/game/fixtures";
import type { GameSession } from "@/game/reducer";
import { useGameStore } from "@/game/store";

import { GameContext } from "../GameContext";
import { FinalAnswerStage } from "./FinalStages";
import { QuestionStage } from "./QuestionStage";

function renderStage(s: GameSession, ui: ReactNode, myId = ALICE) {
  const emit = vi.fn();
  useGameStore.setState({ session: s, connection: "connected", pending: null });
  const connection = { emit, connected: true } as unknown as GameConnection;
  render(<GameContext.Provider value={{ connection, myId }}>{ui}</GameContext.Provider>);
  return emit;
}

describe("final answer stage", () => {
  beforeEach(() => {
    useGameStore.setState({ session: null, pending: null });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["image", "audio", "video"] as const)(
    "shows a %s-only final question instead of 'no content'",
    (type) => {
      renderStage(
        session({
          currentRound: round("final"),
          questionState: "answering",
          timer: timer(),
          currentQuestion: question(100, {
            text: null,
            questionFiles: [
              {
                order: 0,
                displayTime: null,
                file: { md5: "0123456789abcdef0123456789abcdef", type, link: "https://x/i" },
              },
            ],
          }),
        }),
        <FinalAnswerStage />,
      );

      expect(screen.getByTestId("media-frame")).toBeInTheDocument();
      expect(screen.queryByTestId("question-text")).toBeNull();
      const media =
        type === "image" ? screen.getByRole("img") : screen.getByTestId(`media-${type}`);
      expect(media).toHaveAttribute("src", "https://x/i");
      if (type === "image") fireEvent.load(media);
      else {
        fireEvent.canPlay(media);
        expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
      }
    },
  );

  it("uses the final-round snapshot question and preserves its text alongside media", () => {
    renderStage(
      session({
        currentRound: round("final"),
        questionState: "answering",
        currentQuestion: question(100, { text: "Stale question" }),
        finalRoundData: {
          phase: "answering",
          turnOrder: [ALICE],
          bids: {},
          answers: [],
          eliminatedThemes: [],
          questionData: {
            themeId: 10,
            themeName: "Final theme",
            question: question(200, {
              text: "Final question",
              questionFiles: [
                {
                  order: 0,
                  displayTime: null,
                  file: { md5: "final-picture", type: "image", link: "https://x/final-picture" },
                },
              ],
            }),
          },
        },
      }),
      <FinalAnswerStage />,
    );
    expect(screen.getByTestId("question-text")).toHaveTextContent("Final question");
    expect(screen.queryByText("Stale question")).toBeNull();
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://x/final-picture");
  });

  it.each(["audio", "video"] as const)("pauses and resumes final %s with the game", (type) => {
    const initial = session({
      currentRound: round("final"),
      questionState: "answering",
      isPaused: true,
      currentQuestion: question(100, {
        questionFiles: [
          {
            order: 0,
            displayTime: null,
            file: { md5: "final-media", type, link: "https://x/final" },
          },
        ],
      }),
    });
    renderStage(initial, <FinalAnswerStage />);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    expect(screen.getByTestId("question-text")).toHaveTextContent("Q?");
    act(() =>
      useGameStore.setState({
        session: { ...initial, state: { ...initial.state, isPaused: false } },
      }),
    );
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    act(() => useGameStore.setState({ session: initial }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
  });
});

const choice = (extra = {}) =>
  question(100, {
    type: "choice",
    showDelay: 0,
    answers: [
      { order: 0, text: "Shark", file: null },
      {
        order: 1,
        text: null,
        file: { md5: "0123456789abcdef0123456789abcdef", type: "image", link: "https://x/p" },
      },
    ],
    ...extra,
  });

describe("choice options", () => {
  beforeEach(() => useGameStore.setState({ session: null, pending: null }));
  afterEach(() => vi.useRealTimers());

  it("sends the option number for a picture-only option", async () => {
    const emit = renderStage(
      session({
        currentRound: round(),
        questionState: "answering",
        answeringPlayer: ALICE,
        currentQuestion: choice(),
        timer: timer(),
      }),
      <QuestionStage />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Option 2" }));

    expect(emit).toHaveBeenCalledWith("answer-submitted", { answerText: "2" });
  });

  it("keeps delayed options hidden while the game is paused", () => {
    vi.useFakeTimers();
    renderStage(
      session({
        currentRound: round(),
        questionState: "showing",
        isPaused: true,
        currentQuestion: choice({ showDelay: 1_000 }),
        timer: timer(),
      }),
      <QuestionStage />,
    );

    act(() => vi.advanceTimersByTime(5_000));

    expect(screen.queryByRole("list", { name: "Answer options" })).toBeNull();
  });
});
