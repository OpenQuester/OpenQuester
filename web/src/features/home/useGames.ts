import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import type { GameListItem } from "@/api/types";

export const gamesKey = ["games"] as const;

export function useGames(titlePrefix = "", options: { enabled?: boolean } = {}) {
  const prefix = titlePrefix.trim().toLowerCase();
  return useQuery({
    queryKey: [...gamesKey, prefix],
    queryFn: async ({ signal }) => {
      const result = await unwrap(
        api.GET("/v1/games", {
          params: {
            query: {
              limit: 50,
              offset: 0,
              sortBy: "createdAt",
              order: "desc",
              ...(prefix ? { titlePrefix: prefix } : {}),
            },
          },
          signal,
        }),
      );
      return result.data;
    },
    enabled: options.enabled,
    refetchInterval: 5000,
  });
}

export type GameStatus = "lobby" | "playing" | "finished";

export function gameStatus(g: GameListItem): GameStatus {
  if (g.finishedAt) return "finished";
  if (g.startedAt) return "playing";
  return "lobby";
}

/**
 * Players sitting in the game now. Someone who left keeps their seat for a
 * rejoin but is not counted: their place is free for anyone else.
 */
export function playerCount(g: GameListItem): number {
  return g.players.filter((p) => p.role === "player" && p.status !== "disconnected").length;
}

/** Accepts a bare code or any link ending in /games/<code>. */
export function parseGameCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromLink = trimmed.match(/games\/([A-Za-z0-9_-]+)/);
  const code = fromLink ? fromLink[1]! : trimmed;
  return /^[A-Za-z0-9_-]{2,64}$/.test(code) ? code.toUpperCase() : null;
}
