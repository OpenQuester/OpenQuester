import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameConnection } from "@/game/connection";
import { ALICE, BOB, question, round, SAM, session, SHOWMAN, timer } from "@/game/fixtures";
import type { GameSession } from "@/game/reducer";
import { useGameStore } from "@/game/store";

import { GameContext } from "../GameContext";
import { Dock } from "./Dock";

function renderDock(s: GameSession, myId: number) {
  const emit = vi.fn();
  useGameStore.setState({ session: s, connection: "connected", pending: null });
  const connection = { emit, connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId }}>
      <Dock />
    </GameContext.Provider>,
  );
  return emit;
}

const showing = (extra = {}) =>
  session({
    currentRound: round(),
    questionState: "showing",
    currentQuestion: question(100),
    timer: timer(),
    ...extra,
  });

describe("Dock", () => {
  beforeEach(() => useGameStore.setState({ session: null, pending: null }));

  it("gives an eligible player the buzzer and sends the buzz", async () => {
    const emit = renderDock(showing(), ALICE);
    expect(screen.getByTestId("dock-phase")).toHaveTextContent("Ready to buzz");
    await userEvent.click(screen.getByTestId("buzz"));
    expect(emit).toHaveBeenCalledWith("question-answer");
  });

  it("tells a spectator why they cannot buzz", () => {
    renderDock(showing(), SAM);
    expect(screen.queryByTestId("buzz")).toBeNull();
    expect(screen.getByTestId("dock-info")).toHaveTextContent("spectators can't buzz");
  });

  it("only offers Pass for questions that accept it before buzzing", async () => {
    const emit = renderDock(showing(), ALICE);
    await userEvent.click(
      screen.getByRole("button", { name: "Pass on this question" }),
    );
    expect(emit).toHaveBeenCalledWith("question-skip");

    act(() =>
      useGameStore.setState({
        session: showing({
          currentQuestion: question(100, { type: "noRisk" }),
          questionEligiblePlayers: [ALICE],
        }),
      }),
    );
    expect(screen.getByTestId("buzz")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pass on this question" })).toBeNull();
  });

  it.each(["noRisk", "secret", "stake"] as const)(
    "lets the answerer give up a %s point question",
    async (type) => {
      const emit = renderDock(
        showing({
          questionState: "answering",
          answeringPlayer: ALICE,
          currentQuestion: question(100, {
            type,
            answerType: "point",
            questionFiles: [
              {
                order: 0,
                displayTime: null,
                file: { md5: "image", type: "image", link: "https://x/map.png" },
              },
            ],
          }),
        }),
        ALICE,
      );
      const giveUp = screen.getByRole("button", { name: "Give up" });
      await userEvent.click(giveUp);
      expect(emit).toHaveBeenCalledExactlyOnceWith("question-skip");
      act(() => useGameStore.setState({ pending: { action: "question-skip", at: Date.now() } }));
      expect(giveUp).toBeDisabled();
    },
  );

  it("explains an already-used buzzer", () => {
    renderDock(
      showing({
        answeredPlayers: [{ player: ALICE, result: -100, score: -100, answerType: "wrong" }],
      }),
      ALICE,
    );
    expect(screen.getByTestId("dock-info")).toHaveTextContent("You already answered this one");
  });

  it("lets the showman judge with the question value", async () => {
    const emit = renderDock(showing({ questionState: "answering", answeringPlayer: BOB }), SHOWMAN);
    expect(screen.getByTestId("dock-status")).toHaveTextContent("user3 is answering — judge it");
    await userEvent.click(screen.getByTestId("judge-wrong"));
    expect(emit).toHaveBeenCalledWith("answer-result", { scoreResult: -100, answerType: "wrong" });
  });

  it("freezes actions while paused", () => {
    renderDock(showing({ isPaused: true }), ALICE);
    expect(screen.getByTestId("dock-phase")).toHaveTextContent("Paused");
    expect(screen.queryByTestId("buzz")).toBeNull();
  });
});
