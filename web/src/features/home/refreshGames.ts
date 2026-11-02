import type { QueryClient } from "@tanstack/react-query";
import type { GameListItem } from "@/api/types";

export const gamesKey = ["games"] as const;

/** Invalidate every catalogue variant without letting an older response restore stale data. */
export async function refreshGames(client: QueryClient, removedGameId?: string) {
  await client.cancelQueries({ queryKey: gamesKey });
  if (removedGameId) {
    const id = removedGameId.toUpperCase();
    client.setQueriesData<GameListItem[]>({ queryKey: gamesKey }, (games) =>
      games?.filter((game) => game.id.toUpperCase() !== id),
    );
  }
  await client.invalidateQueries({ queryKey: gamesKey, refetchType: "none" });
}
