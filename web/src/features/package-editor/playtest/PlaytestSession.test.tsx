import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { newQuestion } from "../packageDraft";
import { PlaytestSession } from "./PlaytestSession";
import { initialPreview, previewQuestion } from "./previewModel";
import { previewTimer, PreviewRuntime } from "./previewRuntime";
import { usePlaytestWait } from "./usePlaytestWait";
import { buildContentPlan } from "@/game/contentPlan";

afterEach(() => vi.restoreAllMocks());

function pointPreview(mode: "simple" | "everyone" | "final") {
  const draft = newQuestion(100, {
    type: mode === "everyone" ? "noRisk" : "simple",
    forEveryone: mode === "everyone",
    text: "Find the point",
    answerType: "point",
    answerPoint: { x: 0.5, y: 0.5 },
    questionFiles: [{ md5: "image", type: "image", displayTime: 1000 }],
  });
  const question = previewQuestion(
    draft,
    mode === "final",
    new Map([["image", "https://x/image.png"]]),
  );
  const names = {
    showman: "Host",
    players: ["P1", "P2", "P3"] as [string, string, string],
    spectator: "Watcher",
    round: "Round",
    final: "Final",
    theme: "Theme",
  };
  const initial = initialPreview(mode === "final", "Theme", question, names, () => 0);
  initial.state.currentQuestion = question;
  if (mode === "everyone") {
    initial.state.questionState = "showing";
    initial.state.allPlay = {
      mode: "noRisk",
      questionId: 100,
      price: 100,
      maxStake: null,
      priceMultiplier: null,
      entries: [2, 3, 4].map((playerId) => ({
        playerId,
        stake: null,
        answer: null,
        submitted: false,
        isCorrect: null,
        scoreChange: null,
      })),
    };
  } else if (mode === "final") {
    initial.state.questionState = "answering";
    initial.state.finalRoundData = {
      phase: "answering",
      bids: { 2: 100, 3: 100, 4: 100 },
      answers: [],
      turnOrder: [2, 3, 4],
      eliminatedThemes: [],
      questionData: { themeId: 12, themeName: "Theme", question },
    };
  } else {
    initial.state.questionState = "answering";
    initial.state.answeringPlayer = 2;
  }
  const command = vi.spyOn(PreviewRuntime.prototype, "command");
  render(
    <PlaytestSession
      initial={initial}
      question={question}
      credits={{ authors: [], sources: [] }}
      legacy={false}
      onRestart={() => {}}
    />,
  );
  return command;
}

it("uses one real point control for a normal answer and sends one command", () => {
  const command = pointPreview("simple");
  const picker = screen.getByRole("button", { name: "Click where the answer is" });
  expect(screen.getAllByTestId("point-picker")).toHaveLength(1);
  expect(
    screen.getAllByRole("img").filter((img) => img.getAttribute("src") === "https://x/image.png"),
  ).toHaveLength(1);
  fireEvent.keyDown(picker, { key: "Enter" });
  expect(command.mock.calls.filter(([action]) => action.type === "answer-submitted")).toHaveLength(
    1,
  );
  expect(screen.queryByText("Pick a point for the selected player")).not.toBeInTheDocument();
});

it("keeps all-play point cursors private to the selected perspective and guides observers", () => {
  const command = pointPreview("everyone");
  const picker = screen.getByRole("button", { name: "Click where the answer is" });
  fireEvent.focus(picker);
  fireEvent.keyDown(picker, { key: "ArrowRight" });
  expect(picker.querySelector("span")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("View as"), { target: { value: "3" } });
  const next = screen.getByRole("button", { name: "Click where the answer is" });
  expect(next).not.toBe(picker);
  expect(next.querySelector("span")).toBeNull();
  fireEvent.keyDown(next, { key: "Enter" });
  expect(command.mock.calls.filter(([action]) => action.type === "all-play-answer")).toHaveLength(
    1,
  );
  fireEvent.change(screen.getByLabelText("View as"), { target: { value: "1" } });
  expect(screen.getByText("Switch View as to a player who can act.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("View as"), { target: { value: "5" } });
  expect(screen.getByText("Switch View as to a player who can act.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("View as"), { target: { value: "2" } });
  fireEvent.keyDown(screen.getByRole("button", { name: "Click where the answer is" }), {
    key: "Enter",
  });
  expect(command.mock.calls.filter(([action]) => action.type === "all-play-answer")).toHaveLength(
    2,
  );
  expect(screen.queryByText("Pick a point for the selected player")).not.toBeInTheDocument();
});

it("submits the selected player's final point through the actual control", () => {
  const command = pointPreview("final");
  const picker = screen.getByRole("button", { name: "Click where the answer is" });
  const next = screen.getByRole("button", { name: "Continue" });
  expect(next).toBeDisabled();
  fireEvent.keyDown(picker, { key: "Enter" });
  expect(command.mock.calls.filter(([action]) => action.type === "final-answer-submit")).toEqual([
    [{ type: "final-answer-submit", payload: { answerText: "0.500,0.500" } }],
  ]);
  expect(screen.getByText("Switch View as to a player who can act.")).toBeInTheDocument();
  expect(next).toBeDisabled();
});

it("updates Continue at natural content and buzzer boundaries, including pause and resume", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  try {
    const initial = pointPreviewSessionForClock();
    const { result, rerender, unmount } = renderHook(({ session }) => usePlaytestWait(session), {
      initialProps: { session: initial },
    });
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1030));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(470));
    const paused = {
      ...initial,
      state: { ...initial.state, isPaused: true, timer: previewTimer(10_000, 1500) },
    };
    rerender({ session: paused });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(10_000));
    const resumed = {
      ...paused,
      state: { ...paused.state, isPaused: false, timer: previewTimer(10_000, 1500) },
    };
    rerender({ session: resumed });
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1530));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe(false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

function pointPreviewSessionForClock() {
  const question = previewQuestion(newQuestion(100, { text: "Question" }), false, new Map());
  const initial = initialPreview(
    false,
    "Theme",
    question,
    {
      showman: "Host",
      players: ["P1", "P2", "P3"],
      spectator: "Watcher",
      round: "Round",
      final: "Final",
      theme: "Theme",
    },
    () => 0,
  );
  const timer = previewTimer(10_000);
  initial.state.questionState = "showing";
  initial.state.timer = timer;
  initial.state.buzzerOpensAtMs = 3500;
  const files = [1000, 2000].map((displayTime, order) => ({
    order,
    displayTime,
    file: { md5: String(order), type: "image" as const, link: "https://x/i" },
  }));
  initial.content = {
    kind: "question",
    plan: buildContentPlan({ files })!,
    timer,
    frozenAtMs: null,
  };
  return initial;
}
