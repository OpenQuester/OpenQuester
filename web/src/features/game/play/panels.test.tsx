import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type { GameConnection } from "@/game/connection";
import { ALICE, SHOWMAN, choosing } from "@/game/fixtures";
import { useGameStore } from "@/game/store";
import { GameContext } from "../GameContext";
import { GameBoard } from "./GameBoard";
import { PlayersBody } from "./PlayersPanel";

function renderPanel(view: ReactNode) {
  const emit = vi.fn();
  useGameStore.setState({ session: choosing(), boardEdit: false });
  const connection = { emit } as unknown as GameConnection;
  const rendered = render(
    <GameContext.Provider value={{ connection, myId: SHOWMAN }}>{view}</GameContext.Provider>,
  );
  return { ...rendered, emit };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("retains a player's score draft until the server changes that player's score", () => {
  const { emit } = renderPanel(<PlayersBody focusPlayer={ALICE} />);
  const score = screen.getByLabelText("Score");
  fireEvent.change(score, { target: { value: "-320" } });
  fireEvent.click(screen.getByTestId("admin-ban"));
  const updatePlayer = (score: number) => {
    const current = useGameStore.getState().session!;
    act(() =>
      useGameStore.setState({
        session: {
          ...current,
          state: { ...current.state, currentTurnPlayerId: 3 },
          players: current.players.map((p) =>
            p.meta.id === ALICE
              ? { ...p, score, restrictionData: { ...p.restrictionData, muted: true } }
              : p,
          ),
        },
      }),
    );
  };
  updatePlayer(0);
  expect(screen.getByLabelText("Score")).toBe(score);
  expect(score).toHaveValue("-320");
  expect(screen.getByTestId("admin-ban-confirm")).toBeInTheDocument();
  updatePlayer(875);
  expect(screen.getByLabelText("Score")).not.toBe(score);
  expect(screen.getByLabelText("Score")).toHaveValue("875");
  expect(screen.queryByTestId("admin-ban-confirm")).toBeNull();
  fireEvent.change(screen.getByLabelText("Score"), { target: { value: "-3 200" } });
  fireEvent.submit(screen.getByLabelText("Score").closest("form")!);
  expect(emit).toHaveBeenCalledExactlyOnceWith("score-changed", {
    playerId: ALICE,
    newScore: -3200,
  });
  expect(screen.queryByTestId("player-admin")).toBeNull();
  expect(useGameStore.getState().session!.players.find((p) => p.meta.id === ALICE)!.score).toBe(
    875,
  );
});

it("adapts an uneven board to its available width and disposes the resize observer", () => {
  let resize!: ResizeObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const { unmount } = renderPanel(<GameBoard />);
  const table = screen.getByRole("table");
  expect(observe).toHaveBeenCalledExactlyOnceWith(table);
  const setWidth = (width: number) =>
    act(() => resize([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver));
  setWidth(1200);
  expect(table).toHaveAttribute("data-layout", "table");
  expect(screen.getAllByRole("cell")).toHaveLength(4);
  setWidth(375);
  expect(table).toHaveAttribute("data-layout", "stacked");
  expect(screen.getAllByRole("cell")).toHaveLength(3);
  act(() => useGameStore.getState().setBoardEdit(true));
  expect(observe).toHaveBeenCalledTimes(1);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
