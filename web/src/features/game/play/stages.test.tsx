import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameConnection } from "@/game/connection";
import { ALICE, BOB, SAM, SHOWMAN, question, round, session, timer } from "@/game/fixtures";
import type { GameSession } from "@/game/reducer";
import { useGameStore } from "@/game/store";

import { GameContext } from "../GameContext";
import { FinalAnswerStage, FinalReviewStage } from "./FinalStages";
import { QuestionStage } from "./QuestionStage";
import { AnswerReveal } from "./question/AnswerReveal";

function renderStage(s: GameSession, ui: ReactNode, myId = ALICE) {
  const emit = vi.fn((action: string) => useGameStore.getState().setPending(action));
  useGameStore.setState({ session: s, connection: "connected", pending: null });
  const connection = { emit, connected: true } as unknown as GameConnection;
  render(<GameContext.Provider value={{ connection, myId }}>{ui}</GameContext.Provider>);
  return emit;
}

it.each([SHOWMAN, ALICE, BOB, SAM])(
  "shows question loading rather than missing content during answering for role %s",
  (id) => {
    const game = session({
      currentRound: round(),
      questionState: "answering",
      currentQuestion: null,
      answeringPlayer: ALICE,
    });
    renderStage(game, <QuestionStage />, id);
    expect(screen.getAllByText("Waiting for question details.").length).toBeGreaterThan(0);
    expect(screen.queryByText("No question content")).toBeNull();
  },
);

it("shows the instruction openly to the showman and omits it from public reveal", () => {
  const game = session({
    currentRound: round(),
    questionState: "showing",
    currentQuestion: question(100, { questionComment: "Read slowly" }),
  });
  renderStage(game, <QuestionStage />, SHOWMAN);
  expect(screen.getByText("Read slowly")).toBeVisible();
  cleanup();
  renderStage(game, <QuestionStage />, ALICE);
  expect(screen.queryByText("Read slowly")).not.toBeInTheDocument();
  cleanup();
  renderStage(game, <QuestionStage />, SAM);
  expect(screen.queryByText("Read slowly")).not.toBeInTheDocument();
  cleanup();
  renderStage(game, <AnswerReveal />, ALICE);
  expect(screen.queryByText("Read slowly")).not.toBeInTheDocument();
});

it("shows final question instructions to the showman and not to a player", () => {
  const game = session({
    currentRound: round("final"),
    currentQuestion: question(100, { questionComment: "Final instruction" }),
  });
  renderStage(game, <FinalAnswerStage />, SHOWMAN);
  expect(screen.getByText("Final instruction")).toBeVisible();
  cleanup();
  renderStage(game, <FinalAnswerStage />, ALICE);
  expect(screen.queryByText("Final instruction")).not.toBeInTheDocument();
  cleanup();
  renderStage(game, <FinalAnswerStage />, SAM);
  expect(screen.queryByText("Final instruction")).not.toBeInTheDocument();
});

it("shows each final point submission and correct target only to the showman", () => {
  const q = question(100, {
    answerType: "point",
    answerPoint: { x: 0.7, y: 0.3 },
    answerDeviation: 0.1,
    questionFiles: [
      {
        order: 0,
        displayTime: null,
        file: { md5: "image", type: "image", link: "https://x/image" },
      },
    ],
  });
  const game = session({
    currentRound: round("final"),
    questionState: "reviewing",
    finalRoundData: {
      phase: "reviewing",
      bids: { [ALICE]: 100, [SAM]: 200 },
      turnOrder: [ALICE, SAM],
      eliminatedThemes: [],
      questionData: { themeId: 1, themeName: "Final", question: q },
      answers: [
        { id: "a", playerId: ALICE, answer: "0.200,0.400", submittedAt: "2026-01-01" },
        { id: "b", playerId: SAM, answer: "invalid", submittedAt: "2026-01-01" },
        { id: "c", playerId: BOB, answer: "", submittedAt: "2026-01-01" },
      ],
    },
  });
  renderStage(game, <FinalReviewStage />, SHOWMAN);
  const [first, second, third] = screen.getAllByTestId("final-answer");
  expect(within(first!).getByTestId("point-target")).toHaveStyle({
    left: "70%",
    top: "30%",
    width: "20%",
  });
  expect(within(first!).getByTestId("point-picked")).toHaveStyle({ left: "20%", top: "40%" });
  expect(within(first!).getByText(/Correct point: 70%.*30%.*Tolerance radius: 10%/)).toHaveClass(
    "sr-only",
  );
  expect(within(second!).queryByTestId("point-picked")).toBeNull();
  expect(within(third!).queryByTestId("point-picked")).toBeNull();
  expect(within(second!).getByText("“invalid”")).toBeVisible();
  cleanup();
  for (const role of [ALICE, SAM]) {
    renderStage(game, <FinalReviewStage />, role);
    expect(screen.queryByTestId("point-picker")).toBeNull();
    expect(screen.queryByText(/Correct point:/)).toBeNull();
    cleanup();
  }
});

describe("final answer stage", () => {
  beforeEach(() => {
    useGameStore.setState({ session: null, pending: null });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("sends a final point once and keeps other media mounted across perspectives", () => {
    const image = { md5: "same-image", type: "image" as const, link: "https://x/image" };
    const video = { md5: "video", type: "video" as const, link: "https://x/video" };
    const q = question(100, {
      answerType: "point",
      questionFiles: [
        { order: 0, displayTime: null, file: image },
        { order: 1, displayTime: null, file: video },
        { order: 2, displayTime: null, file: image },
      ],
    });
    const s = session({
      currentRound: round("final"),
      questionState: "answering",
      currentQuestion: q,
      timer: timer(),
      finalRoundData: {
        phase: "answering",
        bids: { [ALICE]: 100 },
        answers: [],
        turnOrder: [ALICE],
        eliminatedThemes: [],
        questionData: { themeId: 10, themeName: "Final", question: q },
      },
    });
    const emit = vi.fn((action: string) => useGameStore.getState().setPending(action));
    const connection = { emit, connected: true } as unknown as GameConnection;
    useGameStore.setState({ session: s, connection: "connected", pending: null });
    const ui = (myId: number) => (
      <GameContext.Provider value={{ connection, myId }}>
        <FinalAnswerStage />
      </GameContext.Provider>
    );
    const { rerender } = render(ui(ALICE));
    const media = screen.getByTestId("media-video");
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByTestId("point-picker")).toBeInTheDocument();
    rerender(ui(SHOWMAN));
    expect(screen.queryByTestId("point-picker")).toBeNull();
    expect(screen.getByTestId("media-video")).toBe(media);
    rerender(ui(ALICE));
    expect(screen.getByTestId("media-video")).toBe(media);
    fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
    expect(emit).toHaveBeenCalledExactlyOnceWith("final-answer-submit", {
      answerText: "0.500,0.500",
    });
    fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
    expect(emit).toHaveBeenCalledTimes(1);
    act(() => useGameStore.getState().setPending(null));
    act(() => useGameStore.setState({ session: { ...s, state: { ...s.state, isPaused: true } } }));
    fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
    expect(emit).toHaveBeenCalledTimes(1);
    act(() => useGameStore.setState({ session: s, connection: "reconnecting" }));
    fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
    expect(emit).toHaveBeenCalledTimes(1);
  });

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

  it("disables only the option with an authoritative wrong ruling and restores it after undo", async () => {
    const game = session({
      currentRound: round(),
      questionState: "answering",
      answeringPlayer: ALICE,
      currentQuestion: choice(),
      answeredPlayers: [
        { player: SAM, result: 0, score: 0, answerType: "wrong", choiceOrder: 0 },
        { player: SHOWMAN, result: 0, score: 0, answerType: "skip", choiceOrder: 1 },
      ],
    });
    const emit = renderStage(game, <QuestionStage />);
    expect(screen.getByRole("button", { name: "Shark, Wrong" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Option 2" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Shark, Wrong" }));
    expect(emit).not.toHaveBeenCalled();
    act(() =>
      useGameStore.setState({
        session: { ...game, state: { ...game.state, answeredPlayers: [] } },
      }),
    );
    expect(screen.getByRole("button", { name: "Shark" })).toBeEnabled();
  });

  it("falls back to the legacy command when option orders are duplicated", async () => {
    const emit = renderStage(
      session({
        currentRound: round(),
        questionState: "answering",
        answeringPlayer: ALICE,
        currentQuestion: choice({
          answers: [
            { order: 0, text: "Shark", file: null },
            { order: 0, text: "Whale", file: null },
          ],
        }),
      }),
      <QuestionStage />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Whale" }));
    expect(emit).toHaveBeenCalledWith("answer-submitted", { answerText: "Whale" });
  });

  it("releases pending choice and stage timers when leaving the question", () => {
    vi.useFakeTimers();
    renderStage(
      session({
        currentRound: round(),
        questionState: "showing",
        currentQuestion: choice({ showDelay: 5000 }),
        timer: timer(),
      }),
      <QuestionStage />,
    );
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByRole("list", { name: "Answer options" })).toBeNull();
  });

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

    expect(emit).toHaveBeenCalledWith("answer-submitted", { answerText: "2", choiceOrder: 1 });
  });

  it("keeps choices visible but prevents submission while paused or reconnecting", async () => {
    const s = session({
      currentRound: round(),
      questionState: "answering",
      answeringPlayer: ALICE,
      currentQuestion: choice(),
    });
    const emit = renderStage(s, <QuestionStage />);
    const option = screen.getByRole("button", { name: "Option 2" });
    act(() => useGameStore.setState({ session: { ...s, state: { ...s.state, isPaused: true } } }));
    await userEvent.click(option);
    expect(emit).not.toHaveBeenCalled();
    act(() => useGameStore.setState({ session: s, connection: "reconnecting" }));
    await userEvent.click(option);
    expect(emit).not.toHaveBeenCalled();
    act(() => useGameStore.setState({ connection: "connected" }));
    await userEvent.click(option);
    expect(emit).toHaveBeenCalledExactlyOnceWith("answer-submitted", {
      answerText: "2",
      choiceOrder: 1,
    });
  });

  it("keeps a picture-only answer distinct from numeric and prefixed text options", async () => {
    const emit = renderStage(
      session({
        currentRound: round(),
        questionState: "answering",
        answeringPlayer: ALICE,
        currentQuestion: choice({
          answers: [
            { order: 2, text: " #2 ", file: null },
            { order: 1, text: null, file: { md5: "picture", type: "image", link: "https://x/p" } },
            { order: 0, text: " 2 ", file: null },
          ],
        }),
        timer: timer(),
      }),
      <QuestionStage />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Option 2" }));
    expect(emit).toHaveBeenCalledWith("answer-submitted", { answerText: "##2", choiceOrder: 1 });
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

  it("waits for the prepared content and option delay when false starts are disabled", () => {
    vi.useFakeTimers();
    const questionTimer = timer();
    const plan = (durationMs: number) => ({
      totalMs: durationMs,
      steps: [
        {
          startMs: 0,
          durationMs,
          items: [{ kind: "text" as const, order: 0, placement: "screen" as const, durationMs }],
        },
      ],
    });
    renderStage(
      session({
        currentRound: round(),
        questionState: "media_downloading",
        currentQuestion: choice({ showDelay: 1000 }),
        buzzerOpensAtMs: 0,
        questionContentPlan: plan(500),
        timer: questionTimer,
      }),
      <QuestionStage />,
    );
    // Media preparation replaces the estimated plan with the actual duration.
    act(() =>
      useGameStore.getState().dispatch({
        type: "media-download-status",
        payload: {
          playerId: -1,
          mediaDownloaded: true,
          allPlayersReady: true,
          timer: questionTimer,
          buzzerOpensAtMs: 0,
          contentPlan: plan(4000),
        },
      }),
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("list", { name: "Answer options" })).toBeNull();
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.queryByRole("list", { name: "Answer options" })).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("list", { name: "Answer options" })).toBeInTheDocument();
  });

  it("resumes the remaining reveal delay after a pause in the middle of the countdown", () => {
    vi.useFakeTimers();
    const questionTimer = timer();
    renderStage(
      session({
        currentRound: round(),
        questionState: "showing",
        currentQuestion: choice({ showDelay: 1000 }),
        timer: questionTimer,
      }),
      <QuestionStage />,
    );
    act(() => vi.advanceTimersByTime(400));
    const pausedTimer = { ...questionTimer, elapsedMs: 400 };
    act(() =>
      useGameStore.getState().dispatch({ type: "game-pause", payload: { timer: pausedTimer } }),
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("list", { name: "Answer options" })).toBeNull();
    act(() =>
      useGameStore.getState().dispatch({
        type: "game-unpause",
        payload: { timer: { ...pausedTimer, resumedAt: new Date().toISOString() } },
      }),
    );
    act(() => vi.advanceTimersByTime(599));
    expect(screen.queryByRole("list", { name: "Answer options" })).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("list", { name: "Answer options" })).toBeInTheDocument();
  });

  it.each([0, 1500])(
    "keeps revealed options visible through answering remounts (buzzer=%s)",
    (buzzerOpensAtMs) => {
      vi.useFakeTimers();
      const questionTimer = timer();
      renderStage(
        session({
          currentRound: round(),
          questionState: "showing",
          buzzerOpensAtMs,
          currentQuestion: choice({ showDelay: 1000 }),
          timer: questionTimer,
        }),
        <QuestionStage />,
      );
      const revealAt = buzzerOpensAtMs || 1000;
      act(() => vi.advanceTimersByTime(revealAt));
      expect(screen.getByRole("list", { name: "Answer options" })).toBeInTheDocument();
      act(() =>
        useGameStore.getState().dispatch({
          type: "question-answer",
          payload: { userId: ALICE, timer: timer(60_000) },
        }),
      );
      expect(screen.getByRole("list", { name: "Answer options" })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(200));
      act(() =>
        useGameStore.getState().dispatch({
          type: "answer-result",
          payload: {
            answerResult: { player: ALICE, result: -100, score: -100, answerType: "wrong" },
            timer: { ...questionTimer, elapsedMs: revealAt, resumedAt: new Date().toISOString() },
          },
        }),
      );
      expect(screen.getByRole("list", { name: "Answer options" })).toBeInTheDocument();
    },
  );

  it("unlocks a failed picture submission for retry and locks an accepted answer", async () => {
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
    emit.mockImplementation(() => useGameStore.getState().setPending("answer-submitted"));
    const picture = screen.getByRole("button", { name: "Option 2" });
    await userEvent.click(picture);
    expect(picture).toBeDisabled();
    expect(screen.getByRole("button", { name: "Shark" })).toBeDisabled();
    // The connection clears pending when a send is rejected or times out.
    act(() => useGameStore.getState().setPending(null));
    expect(picture).toBeEnabled();
    await userEvent.click(picture);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith("answer-submitted", { answerText: "2", choiceOrder: 1 });
    act(() =>
      useGameStore.getState().dispatch({ type: "answer-submitted", payload: { answerText: "2" } }),
    );
    expect(useGameStore.getState().pending).toBeNull();
    expect(picture).toBeDisabled();
  });
});

it("keeps a pending point answer through updates, allows failed-send retry and resets for the next question", () => {
  const first = session({
    currentRound: round(),
    questionState: "answering",
    answeringPlayer: ALICE,
    currentQuestion: question(100, {
      answerType: "point",
      questionFiles: [
        {
          order: 0,
          displayTime: null,
          file: { md5: "picture", type: "image", link: "https://x/p" },
        },
      ],
    }),
  });
  const emit = renderStage(first, <QuestionStage />);
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  act(() =>
    useGameStore.setState({ session: { ...first, state: { ...first.state, timer: timer() } } }),
  );
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(emit).toHaveBeenCalledOnce();
  expect(emit).toHaveBeenCalledWith("answer-submitted", { answerText: "0.500,0.500" });
  act(() => useGameStore.getState().setPending(null));
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(emit).toHaveBeenCalledTimes(2);
  act(() =>
    useGameStore
      .getState()
      .dispatch({ type: "answer-submitted", payload: { answerText: "0.500,0.500" } }),
  );
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(emit).toHaveBeenCalledTimes(2);
  act(() =>
    useGameStore.setState({
      session: {
        ...first,
        state: { ...first.state, currentQuestion: { ...first.state.currentQuestion!, id: 101 } },
      },
    }),
  );
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(emit).toHaveBeenCalledTimes(3);
});
