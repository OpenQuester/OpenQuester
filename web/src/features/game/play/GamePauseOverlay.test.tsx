import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { useSettings } from "@/features/settings/settingsStore";
import type { GameConnection } from "@/game/connection";
import { ALICE, choosing, question, SAM, SHOWMAN, snapshot } from "@/game/fixtures";
import type { GameSession } from "@/game/reducer";
import { useGameStore } from "@/game/store";
import { i18n } from "@/i18n/index";
import { GameContext } from "../GameContext";
import { GameScreen } from "./GameScreen";

vi.mock("@/features/stats/QuestionReporting", () => ({
  ReportQuestionDialog: () => null,
  ReportQuestionButton: () => null,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  void i18n.changeLanguage("en");
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
  const sendChat = vi.fn();
  const connection = { emit, sendChat, connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId }}>
      <GameScreen />
    </GameContext.Provider>,
  );
  return { emit, sendChat };
}

function pause() {
  act(() => useGameStore.getState().dispatch({ type: "game-pause", payload: { timer: null } }));
}

function resume() {
  act(() => useGameStore.getState().dispatch({ type: "game-unpause", payload: { timer: null } }));
}

it.each([SHOWMAN, ALICE, SAM])(
  "shows an informational pause overlay and role-specific dock message to role %s",
  (myId) => {
    setup(myId);
    const overlay = within(screen.getByTestId("pause-overlay"));
    expect(overlay.getByRole("heading", { name: "Game paused" })).toBeVisible();
    expect(overlay.getByRole("status")).toHaveTextContent("Game paused");
    expect(overlay.queryByRole("button")).not.toBeInTheDocument();
    expect(overlay.queryByText("Waiting for the showman to continue the game.") !== null).toBe(
      myId !== SHOWMAN,
    );
    expect(
      within(screen.getByTestId("dock")).queryByText(
        "Waiting for the showman to continue the game.",
      ) !== null,
    ).toBe(myId !== SHOWMAN);
    expect(screen.queryByText("Timers are stopped.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Resume.*to continue/)).not.toBeInTheDocument();
    expect(screen.getByTestId("game-stage")).toHaveAttribute("inert");
    expect(screen.queryByTestId("paused-banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
);

it("stays paused after the interlude duration, Escape and backdrop clicks", () => {
  vi.useFakeTimers();
  setup();
  act(() => vi.advanceTimersByTime(5000));
  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.click(screen.getByTestId("pause-overlay"));
  expect(screen.getByTestId("pause-overlay")).toBeVisible();
});

it("shares pending, retry and reconnect state across all Resume buttons", async () => {
  const { emit } = setup();
  const stage = screen.getByTestId("game-stage").firstElementChild;
  await userEvent.click(screen.getByTestId("host-tools"));
  const buttons = screen.getAllByRole("button", { name: "Resume" });
  expect(buttons).toHaveLength(2);
  for (const button of buttons) {
    await userEvent.click(button);
    expect(emit).toHaveBeenLastCalledWith("game-unpause");
    expect(screen.getByTestId("pause-overlay")).toBeVisible();
    for (const other of buttons) expect(other).toBeDisabled();
    // A server rejection or request timeout clears pending without unpausing.
    act(() => useGameStore.getState().setPending(null));
    for (const other of buttons) expect(other).toBeEnabled();
  }
  expect(emit).toHaveBeenCalledTimes(2);
  act(() => useGameStore.setState({ connection: "reconnecting" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Connection lost");
  for (const button of buttons) {
    expect(button).toBeDisabled();
    await userEvent.click(button);
  }
  expect(emit).toHaveBeenCalledTimes(2);
  const session = useGameStore.getState().session!;
  act(() => {
    useGameStore.getState().dispatch({ type: "game-data", payload: snapshot(session.state) });
    useGameStore.setState({ connection: "connected" });
  });
  expect(screen.getByTestId("pause-overlay")).toBeVisible();
  resume();
  expect(screen.queryByTestId("pause-overlay")).not.toBeInTheDocument();
  expect(screen.getByTestId("game-stage")).not.toHaveAttribute("inert");
  expect(screen.getByTestId("game-stage").firstElementChild).toBe(stage);
});

it("keeps board editing mounted but blocks editing and round progression until resume", async () => {
  const { emit } = setup(SHOWMAN, { isPaused: false }, true);
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
  for (const id of ["board-edit", "skip-round"]) {
    expect(host.getByTestId(id)).toBeDisabled();
    expect(host.getByTestId(id)).toHaveAttribute("title", "The game is paused");
    await userEvent.click(host.getByTestId(id));
  }
  expect(emit).not.toHaveBeenCalled();
  expect(useGameStore.getState().boardEdit).toBe(true);
  expect(screen.getByTestId("game-stage")).toHaveAttribute("inert");
  resume();
  expect(screen.getByTestId("game-stage").firstElementChild).toBe(stage);
  expect(screen.getByTestId("board-edit")).toBeEnabled();
  expect(screen.getByTestId("board-edit")).toHaveAttribute("aria-pressed", "true");
  expect(host.getByTestId("skip-round")).toBeEnabled();
});

it.each([
  ["showing", "Skip this question"],
  ["showing_answer", "Skip the answer"],
] as const)(
  "blocks progression in %s but permits undo and join settings",
  async (questionState, label) => {
    const { emit } = setup(SHOWMAN, {
      questionState,
      currentQuestion: question(),
      answeredPlayers: [{ player: ALICE, result: -100, score: -100, answerType: "wrong" }],
    });
    await userEvent.click(screen.getByTestId("host-tools"));
    const skip = screen.getByRole("button", { name: label });
    expect(skip).toBeDisabled();
    await userEvent.click(skip);
    expect(emit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("undo-ruling"));
    expect(emit).toHaveBeenLastCalledWith("answer-result-undo");
    fireEvent.change(screen.getByLabelText("Who can join"), { target: { value: "closed" } });
    expect(emit).toHaveBeenLastCalledWith("game-join-mode-change", { joinMode: "closed" });
  },
);

it("keeps chat and its shortcut available while gameplay shortcuts do nothing", async () => {
  const { emit, sendChat } = setup(ALICE);
  fireEvent.keyDown(window, { key: " ", code: "Space" });
  fireEvent.keyDown(window, { key: "1" });
  expect(emit).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "t" });
  await userEvent.type(screen.getByLabelText("Message"), "Ready when you are");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(sendChat).toHaveBeenCalledWith("Ready when you are");
  expect(screen.getByTestId("pause-overlay")).toBeVisible();
});

it.each([
  ["uk", "Гра на паузі", "Чекаємо, поки ведучий продовжить гру."],
  ["ru", "Игра на паузе", "Ждём, пока ведущий продолжит игру."],
])("localizes the pause screen in %s", async (language, title, waiting) => {
  await i18n.changeLanguage(language);
  setup(ALICE);
  const overlay = within(screen.getByTestId("pause-overlay"));
  expect(overlay.getByRole("heading", { name: title })).toBeVisible();
  expect(overlay.getByText(waiting)).toBeVisible();
  expect(screen.getByTestId("dock")).toHaveTextContent(waiting);
});
