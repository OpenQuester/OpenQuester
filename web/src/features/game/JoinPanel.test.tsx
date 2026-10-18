import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as Router from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GameListItem } from "@/api/types";

import { JoinPanel } from "./JoinPanel";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

const me = { id: 7, username: "sukui_" };

function privateGame(players: GameListItem["players"], hostId = 1): GameListItem {
  return {
    id: "ABCD",
    title: "Call game",
    isPrivate: true,
    maxPlayers: 8,
    createdBy: { id: hostId, username: "host" },
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    package: { title: "Pack" },
    players,
  } as unknown as GameListItem;
}

function renderPanel(game: GameListItem) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["me"], me);
  const onJoin = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <JoinPanel gameId="ABCD" game={game} loading={false} onJoin={onJoin} />
    </QueryClientProvider>,
  );
  return onJoin;
}

describe("JoinPanel password", () => {
  it("asks a newcomer for the private game's password", async () => {
    const onJoin = renderPanel(privateGame([]));

    expect(screen.getByLabelText("Game password")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Join as player" }));
    expect(onJoin).not.toHaveBeenCalled();
  });

  it.each([
    [
      "someone who kept a seat",
      privateGame([{ id: me.id, role: "player", slot: 0, status: "disconnected" } as never]),
    ],
    ["the host", privateGame([], me.id)],
  ])("doesn't ask %s, whom the server lets in anyway", async (_, game) => {
    const onJoin = renderPanel(game);

    expect(screen.queryByLabelText("Game password")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Join as player" }));
    expect(onJoin).toHaveBeenCalledWith({ role: "player", targetSlot: null, password: null });
  });
});
