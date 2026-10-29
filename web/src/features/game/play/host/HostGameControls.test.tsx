import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { GameContext } from "../../GameContext";
import { round, session, SHOWMAN } from "@/game/fixtures";
import { useGameStore } from "@/game/store";
import type { GameConnection } from "@/game/connection";
import { HostGameControls } from "./HostGameControls";
import { useHostTools } from "./useHostTools";

function Controls() {
  return <HostGameControls tools={useHostTools()} />;
}

it.each([
  ["final", false],
  ["simple", true],
] as const)("offers skip during %s media only when supported", (type, visible) => {
  useGameStore.setState({
    session: session({ currentRound: round(type), questionState: "media_downloading" }),
    connection: "connected",
    pending: null,
  });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: SHOWMAN }}>
      <Controls />
    </GameContext.Provider>,
  );
  expect(!!screen.queryByRole("button", { name: "Skip this question" })).toBe(visible);
});
