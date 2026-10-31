import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { buildContentPlan } from "@/game/contentPlan";
import { ALICE, question, round, session, timer } from "@/game/fixtures";
import type { GameConnection } from "@/game/connection";
import { useGameStore } from "@/game/store";
import { GameContext } from "../GameContext";
import { FinalAnswerStage } from "./FinalStages";
import { GameActionDock } from "./GameActionDock";
import { PlayerChips } from "./PlayerChips";
import { useFinalContent } from "./useFinalContent";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("uses the paused snapshot timer on rejoin and resumes from the same step", () => {
  vi.useFakeTimers();
  const q = question(100, {
    text: "First",
    textOrder: 0,
    textItems: [{ order: 1, text: "Second" }],
  });
  const plan = buildContentPlan(q)!;
  const paused = session({
    currentRound: round("final"),
    questionState: "answering",
    isPaused: true,
    timer: { ...timer(75_000 + plan.totalMs), elapsedMs: 2_100 },
    finalRoundData: {
      phase: "answering",
      bids: {},
      answers: [],
      turnOrder: [ALICE],
      eliminatedThemes: [],
      questionData: { themeId: 10, themeName: "Final", question: q, contentPlan: plan },
    },
  });
  const hook = renderHook(({ game }) => useFinalContent(game), { initialProps: { game: paused } });
  expect(hook.result.current.playing).toBe(true);
  hook.rerender({ game: { ...paused, state: { ...paused.state, timer: null } } });
  expect(hook.result.current.playing).toBe(true);
  expect(hook.result.current.content?.frozenAtMs).toBe(0);
  hook.rerender({ game: paused });
  act(() => vi.advanceTimersByTime(5_000));
  expect(hook.result.current.playing).toBe(true);
  const resumed = {
    ...paused,
    state: {
      ...paused.state,
      isPaused: false,
      timer: { ...paused.state.timer!, resumedAt: new Date().toISOString() },
    },
  };
  hook.rerender({ game: resumed });
  act(() => vi.advanceTimersByTime(1_930));
  expect(hook.result.current.playing).toBe(false);
});

it("shows only the target image after a sequenced final, without replaying earlier media", () => {
  const q = question(100, {
    text: "Question",
    textOrder: 0,
    textItems: [],
    answerType: "point",
    pointImageOrder: 2,
    questionFiles: [
      { order: 1, displayTime: 3_000, file: { type: "video", md5: "video", link: "/video" } },
      { order: 2, displayTime: 5_000, file: { type: "image", md5: "target", link: "/target" } },
    ],
  });
  const plan = buildContentPlan({
    text: q.text,
    textOrder: q.textOrder,
    textItems: q.textItems,
    files: q.questionFiles,
  })!;
  const game = session({
    currentRound: round("final"),
    questionState: "answering",
    currentQuestion: q,
    timer: {
      ...timer(75_000 + plan.totalMs),
      elapsedMs: plan.totalMs,
      resumedAt: new Date().toISOString(),
    },
    finalRoundData: {
      phase: "answering",
      bids: { [ALICE]: 100 },
      answers: [],
      turnOrder: [ALICE],
      eliminatedThemes: [],
      questionData: { themeId: 10, themeName: "Final", question: q, contentPlan: plan },
    },
  });
  useGameStore.setState({ session: game, connection: "connected", pending: null });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: ALICE }}>
      <FinalAnswerStage />
    </GameContext.Provider>,
  );
  expect(screen.getByTestId("point-picker")).toBeInTheDocument();
  expect(screen.getByRole("img")).toHaveAttribute("src", "/target");
  expect(screen.queryByTestId("media-video")).toBeNull();
});

it.each([
  { order: 2, expected: "/second", other: "/first" },
  { order: undefined, expected: "/first", other: "/second" },
])("replaces only the targeted legacy final image (order $order)", ({ order, expected, other }) => {
  const q = question(100, {
    text: "",
    answerType: "point",
    pointImageOrder: order,
    questionFiles: [
      { order: 1, displayTime: null, file: { type: "image", md5: "first", link: "/first" } },
      { order: 2, displayTime: null, file: { type: "image", md5: "second", link: "/second" } },
    ],
  });
  const game = session({
    currentRound: round("final"),
    questionState: "answering",
    currentQuestion: q,
    finalRoundData: {
      phase: "answering",
      bids: { [ALICE]: 100 },
      answers: [],
      turnOrder: [ALICE],
      eliminatedThemes: [],
      questionData: { themeId: 10, themeName: "Final", question: q },
    },
  });
  useGameStore.setState({ session: game, connection: "connected", pending: null });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: ALICE }}>
      <FinalAnswerStage />
    </GameContext.Provider>,
  );
  expect(within(screen.getByTestId("point-picker")).getByRole("img")).toHaveAttribute(
    "src",
    expected,
  );
  expect(screen.getAllByRole("img").map((img) => img.getAttribute("src"))).toEqual(
    order == null ? [expected, other] : [other, expected],
  );
});

it("replaces only the first occurrence of duplicate legacy images", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const image = {
      order: 0,
      displayTime: null,
      file: { type: "image" as const, md5: "same", link: "/same" },
    };
    const q = question(100, {
      text: "",
      answerType: "point",
      questionFiles: [{ ...image }, { ...image }],
    });
    const game = session({
      currentRound: round("final"),
      questionState: "answering",
      currentQuestion: q,
      finalRoundData: {
        phase: "answering",
        bids: { [ALICE]: 100 },
        answers: [],
        turnOrder: [ALICE],
        eliminatedThemes: [],
        questionData: { themeId: 10, themeName: "Final", question: q },
      },
    });
    useGameStore.setState({ session: game, connection: "connected", pending: null });
    const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
    render(
      <GameContext.Provider value={{ connection, myId: ALICE }}>
        <FinalAnswerStage />
      </GameContext.Provider>,
    );
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getAllByTestId("point-picker")).toHaveLength(1);
    expect(consoleError.mock.calls.some(([message]) => String(message).includes("same key"))).toBe(
      false,
    );
  } finally {
    consoleError.mockRestore();
  }
});

it("explains when the final started after a media readiness timeout", () => {
  const q = question(100, { text: "Final" });
  const game = session({
    currentRound: round("final"),
    questionState: "answering",
    currentQuestion: q,
    finalRoundData: {
      phase: "answering",
      bids: {},
      answers: [],
      turnOrder: [ALICE],
      eliminatedThemes: [],
      questionData: {
        themeId: 10,
        themeName: "Final",
        question: q,
        mediaPreparationTimedOut: true,
      },
    },
  });
  useGameStore.setState({ session: game, connection: "connected", pending: null });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: ALICE }}>
      <FinalAnswerStage />
    </GameContext.Provider>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("could not load the media in time");
});

it("plays the final timeline before enabling answers", () => {
  vi.useFakeTimers();
  const q = question(100, {
    text: "First",
    textOrder: 0,
    textItems: [{ order: 1, text: "Second" }],
  });
  const plan = buildContentPlan(q)!;
  const game = session({
    currentRound: round("final"),
    questionState: "answering",
    currentQuestion: q,
    timer: timer(75_000 + plan.totalMs),
    finalRoundData: {
      phase: "answering",
      bids: { [ALICE]: 100 },
      answers: [],
      turnOrder: [ALICE],
      eliminatedThemes: [],
      questionData: { themeId: 10, themeName: "Final", question: q, contentPlan: plan },
    },
  });
  useGameStore.setState({ session: game, connection: "connected", pending: null });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: ALICE }}>
      <FinalAnswerStage />
      <GameActionDock />
      <PlayerChips />
    </GameContext.Provider>,
  );
  expect(screen.getByTestId("question-text")).toHaveTextContent("First");
  expect(screen.getAllByTestId("player-chip")[0]).toHaveTextContent("waiting");
  expect(screen.queryByTestId("final-submit")).toBeNull();
  act(() => vi.advanceTimersByTime(2_030));
  expect(screen.getByTestId("question-text")).toHaveTextContent("Second");
  expect(screen.queryByTestId("final-submit")).toBeNull();
  const pausedTimer = { ...game.state.timer!, elapsedMs: 2_030 };
  act(() =>
    useGameStore.setState({
      session: { ...game, state: { ...game.state, isPaused: true, timer: pausedTimer } },
    }),
  );
  act(() => vi.advanceTimersByTime(5_000));
  expect(screen.getAllByTestId("player-chip")[0]).toHaveTextContent("waiting");
  act(() =>
    useGameStore.setState({
      session: {
        ...game,
        state: { ...game.state, timer: { ...pausedTimer, resumedAt: new Date().toISOString() } },
      },
    }),
  );
  act(() => vi.advanceTimersByTime(2_030));
  expect(screen.getByTestId("final-submit")).toBeInTheDocument();
  expect(screen.getAllByTestId("player-chip")[0]).toHaveTextContent("answering");
});
