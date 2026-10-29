import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { GameConnection } from "@/game/connection";
import { ALICE, question, round, session, SHOWMAN } from "@/game/fixtures";
import { reduce } from "@/game/reducer";
import { useGameStore } from "@/game/store";
import { GameContext } from "../../GameContext";
import { ShowmanPanel } from "./ShowmanPanel";

it.each([
  { type: "simple" as const, answerType: "number" as const },
  { type: "simple" as const, answerType: "point" as const },
  { type: "choice" as const, answerType: "text" as const },
])("shows the player must act, not that they speak out loud: %o", (q) => {
  const state = session({
    currentRound: round(),
    currentQuestion: question(100, q),
    questionState: "answering",
    answeringPlayer: ALICE,
  });
  useGameStore.setState({ session: state, connection: "connected", pending: null });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: SHOWMAN }}>
      <ShowmanPanel />
    </GameContext.Provider>,
  );
  expect(screen.getByText("The player must select, enter, or mark an answer.")).toBeVisible();
  expect(screen.queryByText("Answering out loud")).toBeNull();
  act(() =>
    useGameStore.setState({ session: { ...state, state: { ...state.state, isPaused: true } } }),
  );
  expect(screen.getByText("The player must select, enter, or mark an answer.")).toBeVisible();
  act(() =>
    useGameStore.setState({
      session: reduce(state, { type: "answer-submitted", payload: { answerText: null } }),
    }),
  );
  expect(screen.getByText("No answer text was sent.")).toBeVisible();
  act(() => useGameStore.setState({ session: state, connection: "reconnecting" }));
  expect(screen.queryByText("No answer text was sent.")).toBeNull();
  expect(screen.getByText("The player must select, enter, or mark an answer.")).toBeVisible();
});

it("still describes a free-text answer as spoken before submission", () => {
  const state = session({
    currentRound: round(),
    currentQuestion: question(100, { answerType: "text" }),
    questionState: "answering",
    answeringPlayer: ALICE,
  });
  useGameStore.setState({ session: state, connection: "connected", pending: null });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: SHOWMAN }}>
      <ShowmanPanel />
    </GameContext.Provider>,
  );
  expect(screen.getByText("Answering out loud")).toBeVisible();
});

it("does not claim the answer is spoken or absent while question data is loading", () => {
  const state = session({
    currentRound: round(),
    currentQuestion: null,
    questionState: "answering",
    answeringPlayer: ALICE,
  });
  useGameStore.setState({ session: state, connection: "connected", pending: null });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: SHOWMAN }}>
      <ShowmanPanel />
    </GameContext.Provider>,
  );
  expect(screen.getAllByText("Waiting for question details.").length).toBeGreaterThan(0);
  expect(screen.queryByText("Answering out loud")).toBeNull();
  expect(screen.queryByText("No answer text in the package")).toBeNull();
});
