import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameConnection } from "@/game/connection";
import { ALICE, SHOWMAN, question, round, session, snapshot } from "@/game/fixtures";
import { reduce, type GameSession } from "@/game/reducer";
import { useGameStore } from "@/game/store";
import { GameContext } from "../../GameContext";
import { PlayerCard } from "./PlayerCard";

function setup(game: GameSession, myId = SHOWMAN) {
  const emit = vi.fn();
  const manage = vi.fn();
  useGameStore.setState({ session: game, pending: null, connection: "connected" });
  function Card() {
    const player = useGameStore((s) => s.session!.players.find((p) => p.meta.id === ALICE)!);
    return <PlayerCard player={player} onManage={manage} />;
  }
  render(
    <GameContext.Provider
      value={{ connection: { emit, connected: true } as unknown as GameConnection, myId }}
    >
      <Card />
    </GameContext.Provider>,
  );
  fireEvent.focus(screen.getByRole("button", { name: /user2/ }));
  return { emit, manage };
}

describe("player card score controls", () => {
  it("uses authoritative scores and current question value, clamps the total, and blocks pending actions", () => {
    const game = session({
      currentRound: round(),
      questionState: "showing",
      currentQuestion: question(100, { price: 600 }),
    });
    game.players.find((p) => p.meta.id === ALICE)!.score = 2_099_999_800;
    const { emit } = setup(game);
    fireEvent.click(screen.getByTestId("quick-score-add"));
    expect(emit).toHaveBeenLastCalledWith("score-changed", {
      playerId: ALICE,
      newScore: 2_100_000_000,
    });
    expect(useGameStore.getState().session!.players.find((p) => p.meta.id === ALICE)!.score).toBe(
      2_099_999_800,
    );
    act(() => useGameStore.setState({ pending: { action: "score-changed", at: Date.now() } }));
    expect(screen.getByTestId("quick-score-subtract")).toBeDisabled();
    act(() =>
      useGameStore.setState({
        pending: null,
        session: {
          ...game,
          players: game.players.map((p) =>
            p.meta.id === ALICE ? { ...p, score: -2_099_999_900 } : p,
          ),
        },
      }),
    );
    fireEvent.click(screen.getByTestId("quick-score-subtract"));
    expect(emit).toHaveBeenLastCalledWith("score-changed", {
      playerId: ALICE,
      newScore: -2_100_000_000,
    });
    act(() => useGameStore.setState({ connection: "reconnecting" }));
    expect(screen.getByTestId("quick-score-add")).toBeDisabled();
  });

  it("retains the finished question value on the board and forgets it on a fresh snapshot", () => {
    let game = session({
      currentRound: round(),
      questionState: "showing",
      currentQuestion: question(100, { type: "noRisk", price: 600, priceMultiplier: 2 }),
    });
    game = reduce(game, {
      type: "question-finish",
      payload: { answerText: "Answer", answerFiles: [], nextTurnPlayerId: ALICE },
    });
    game = reduce(game, { type: "answer-show-end", payload: {} });
    expect(game.lastQuestionValue).toBe(1200);
    const { emit } = setup(game);
    fireEvent.click(screen.getByTestId("quick-score-add"));
    expect(emit).toHaveBeenCalledWith("score-changed", { playerId: ALICE, newScore: 1200 });
    act(() =>
      useGameStore.setState({
        session: reduce(game, {
          type: "game-data",
          payload: snapshot({ currentRound: round(), questionState: "choosing" }),
        }),
      }),
    );
    expect(screen.getByTestId("quick-score-add")).toBeDisabled();
    expect(screen.getByText(/value is not available/)).toBeVisible();
  });

  it("shows player details without showman score controls for a player", () => {
    setup(session(), ALICE);
    expect(screen.getByRole("dialog", { name: "user2" })).toBeVisible();
    expect(screen.queryByTestId("quick-score-add")).not.toBeInTheDocument();
  });
});
