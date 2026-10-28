import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { newQuestion } from "../packageDraft";
import { PlaytestSession } from "./PlaytestSession";
import { initialPreview, previewQuestion } from "./previewModel";
import { PreviewRuntime } from "./previewRuntime";

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
  fireEvent.keyDown(picker, { key: "Enter" });
  expect(command.mock.calls.filter(([action]) => action.type === "answer-submitted")).toHaveLength(
    1,
  );
  expect(screen.queryByText("Pick a point for the selected player")).not.toBeInTheDocument();
});

it("keeps all-play point cursors private to the selected perspective and preserves host fallback", () => {
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
  expect(screen.getByText("Pick a point for the selected player")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("View as"), { target: { value: "5" } });
  expect(screen.getByText("Pick a point for the selected player")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("View as"), { target: { value: "2" } });
  fireEvent.keyDown(screen.getByRole("button", { name: "Click where the answer is" }), {
    key: "Enter",
  });
  expect(command.mock.calls.filter(([action]) => action.type === "all-play-answer")).toHaveLength(
    2,
  );
  expect(screen.queryByText("Pick a point for the selected player")).not.toBeInTheDocument();
});

it("retains the prepared point and Continue flow for a final question", () => {
  pointPreview("final");
  expect(screen.getByText("Pick a point for the selected player")).toBeInTheDocument();
  const picker = screen.getByRole("button", { name: "Click where the answer is" });
  const next = screen.getByRole("button", { name: "Continue" });
  expect(next).toBeDisabled();
  fireEvent.keyDown(picker, { key: "Enter" });
  expect(next).toBeEnabled();
  fireEvent.click(next);
  expect(
    screen.getByText("This player has answered. Choose another test player."),
  ).toBeInTheDocument();
  expect(screen.queryByText("Pick a point for the selected player")).not.toBeInTheDocument();
});
