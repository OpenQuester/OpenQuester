import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { newQuestion } from "../packageDraft";
import { QuestionPlaytest } from "./QuestionPlaytest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("runs and pauses the question and reveal clocks and clears them on close", async () => {
  const q = newQuestion(100, {
    text: "Timed question",
    answerText: "Answer",
    showAnswerDuration: 2000,
  });
  const view = render(
    <QuestionPlaytest
      question={q}
      final={false}
      themeName="Theme"
      media={new Map()}
      canSave
      onFix={() => {}}
    />,
  );
  await screen.findByTestId("question-playtest");
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Ready to buzz");
  fireEvent.click(screen.getByRole("button", { name: /^Pause$/ }));
  await act(async () => {
    vi.advanceTimersByTime(30_000);
  });
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Paused");
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  await act(async () => {
    vi.advanceTimersByTime(23_000);
  });
  expect(screen.getByTestId("answer-reveal")).toHaveTextContent("Answer");
  await act(async () => {
    vi.advanceTimersByTime(2_000);
  });
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Game over");
  expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Restart" }));
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Choosing");
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("shows delayed choices only after advancing their real content clock", async () => {
  const q = newQuestion(100, {
    type: "choice",
    text: "Pick one",
    answerText: "Blue",
    showDelay: 3000,
    options: [
      { id: "a", text: "Blue", file: null },
      { id: "b", text: "Red", file: null },
    ],
  });
  render(
    <QuestionPlaytest
      question={q}
      final={false}
      themeName="Theme"
      media={new Map()}
      canSave
      onFix={() => {}}
    />,
  );
  await screen.findByTestId("question-playtest");
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.queryByRole("button", { name: "Blue" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  expect(screen.getByRole("button", { name: "Blue" })).toBeInTheDocument();
});
