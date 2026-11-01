import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GameConnection } from "@/game/connection";
import { choosing, SHOWMAN } from "@/game/fixtures";
import { useGameStore } from "@/game/store";
import { i18n } from "@/i18n";
import { GameContext } from "../../GameContext";
import { logLine } from "../chat/logLine";
import { fullGameSettings, gameSettingsChange } from "./gameRulesDraft";
import { HostGameRules } from "./HostGameRules";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => cleanup());

function renderRules() {
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: SHOWMAN }}>
      <HostGameRules />
    </GameContext.Provider>,
  );
  return connection.emit as ReturnType<typeof vi.fn>;
}

it("sends only the rules and timers the showman changed", () => {
  useGameStore.setState({
    session: { ...choosing(), settings: { falseStart: true, buttonPressMode: "first_wins" } },
    connection: "connected",
    pending: null,
  });
  const emit = renderRules();
  const form = screen.getByTestId("host-rules");
  const save = within(form).getByRole("button", { name: "Save" });
  expect(save).toBeDisabled();

  fireEvent.click(within(form).getByRole("checkbox", { name: /False starts/ }));
  fireEvent.change(within(form).getByLabelText("Time to answer after pressing"), {
    target: { value: "30" },
  });
  fireEvent.click(save);

  expect(emit).toHaveBeenCalledWith("game-settings-change", {
    falseStart: false,
    timers: { answerSubmitMs: 30_000 },
  });
});

it("resets the draft when the server's rules change", () => {
  useGameStore.setState({ session: choosing(), connection: "connected", pending: null });
  renderRules();
  const checkbox = () => screen.getByRole("checkbox", { name: /Wrong answers cost points/ });
  fireEvent.click(checkbox());
  expect(checkbox()).not.toBeChecked();

  act(() =>
    useGameStore.getState().dispatch({
      type: "game-settings-change",
      payload: { settings: { ...fullGameSettings(null), falseStart: false } },
    }),
  );
  expect(checkbox()).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /False starts/ })).not.toBeChecked();
});

it("fills missing timers with the defaults and finds no change in an identical draft", () => {
  const current = fullGameSettings({ falseStart: false, buttonPressMode: "first_wins" });
  expect(current.timers.answerMs).toBe(20_500);
  expect(gameSettingsChange(current, { ...current, timers: { ...current.timers } })).toBeNull();
  expect(gameSettingsChange(current, { ...current, wrongAnswerPenalty: "none" })).toEqual({
    wrongAnswerPenalty: "none",
  });
});

it("describes a rules change in the chat log", () => {
  const line = logLine(
    i18n.t.bind(i18n),
    {
      action: "game-settings-change",
      params: { falseStart: false, roundMs: 600_000, answerMs: 10_000 },
    },
    "fallback",
  );
  expect(line).toBe(
    "changed the rules: False starts: off; Round time limit: 10 min; Time to press the buzzer: 10 sec.",
  );
});
