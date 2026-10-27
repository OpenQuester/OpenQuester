import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { useSettings } from "@/features/settings/settingsStore";
import type { GameConnection } from "@/game/connection";
import { ALICE, choosing, question, SHOWMAN } from "@/game/fixtures";
import type { GameSession } from "@/game/reducer";
import { useGameStore } from "@/game/store";
import { GameContext } from "../GameContext";
import { GameScreen } from "./GameScreen";

vi.mock("@/features/stats/QuestionReporting", () => ({
  ReportQuestionDialog: () => null,
  ReportQuestionButton: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(myId = SHOWMAN, state: Partial<GameSession["state"]> = {}, boardEdit = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Element.prototype.scrollTo = vi.fn();
  useSettings.setState({ sound: false, pins: {} });
  const initial = choosing();
  useGameStore.setState({
    gameId: initial.gameId,
    session: { ...initial, state: { ...initial.state, isPaused: true, ...state } },
    connection: "connected",
    pending: null,
    boardEdit,
  });
  const emit = vi.fn((action: string) => useGameStore.getState().setPending(action));
  const connection = { emit, connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId }}>
      <GameScreen />
    </GameContext.Provider>,
  );
  return emit;
}

function pause() {
  act(() => useGameStore.getState().dispatch({ type: "game-pause", payload: { timer: null } }));
}

function resume() {
  act(() => useGameStore.getState().dispatch({ type: "game-unpause", payload: { timer: null } }));
}

it("keeps the game paused until resume is confirmed", async () => {
  const emit = setup();
  const stage = screen.getByTestId("game-stage").firstElementChild;
  await userEvent.click(screen.getByTestId("host-tools"));
  const buttons = screen.getAllByRole("button", { name: "Resume" });
  expect(buttons).toHaveLength(2);
  await userEvent.click(buttons[0]!);
  expect(emit).toHaveBeenCalledWith("game-unpause");
  expect(screen.getByTestId("pause-overlay")).toBeVisible();
  for (const button of buttons) expect(button).toBeDisabled();
  act(() => useGameStore.getState().setPending(null));
  for (const button of buttons) expect(button).toBeEnabled();
  act(() => useGameStore.setState({ connection: "reconnecting" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Connection lost");
  for (const button of buttons) expect(button).toBeDisabled();
  act(() => useGameStore.setState({ connection: "connected" }));
  resume();
  expect(screen.queryByTestId("pause-overlay")).not.toBeInTheDocument();
  expect(screen.getByTestId("game-stage")).not.toHaveAttribute("inert");
  expect(screen.getByTestId("game-stage").firstElementChild).toBe(stage);
});

it("keeps board editing mounted but blocks editing and round progression until resume", async () => {
  const emit = setup(SHOWMAN, { isPaused: false }, true);
  const stage = screen.getByTestId("game-stage").firstElementChild;
  await userEvent.click(screen.getByTestId("host-tools"));
  const host = within(screen.getByTestId("host-panel"));
  await userEvent.click(host.getByTestId("skip-round"));
  pause();
  const confirm = screen.getByTestId("skip-round-confirm");
  expect(confirm).toBeDisabled();
  await userEvent.click(confirm);
  expect(emit).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(host.getByTestId("board-edit")).toBeDisabled();
  expect(host.getByTestId("skip-round")).toBeDisabled();
  expect(useGameStore.getState().boardEdit).toBe(true);
  expect(screen.getByTestId("game-stage")).toHaveAttribute("inert");
  resume();
  expect(screen.getByTestId("game-stage").firstElementChild).toBe(stage);
  expect(screen.getByTestId("board-edit")).toBeEnabled();
  expect(screen.getByTestId("board-edit")).toHaveAttribute("aria-pressed", "true");
});

it.each([
  ["showing", "Skip this question"],
  ["showing_answer", "Skip the answer"],
] as const)("blocks progression in %s while paused", async (questionState, label) => {
  setup(SHOWMAN, {
    questionState,
    currentQuestion: question(),
    answeredPlayers: [{ player: ALICE, result: -100, score: -100, answerType: "wrong" }],
  });
  await userEvent.click(screen.getByTestId("host-tools"));
  expect(screen.getByRole("button", { name: label })).toBeDisabled();
});
