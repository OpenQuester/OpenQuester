import { useQuery } from "@tanstack/react-query";

import { api, ApiError } from "@/api/client";
import type { GameListItem } from "@/api/types";

export function useGamePreview(gameId: string) {
  return useQuery({
    queryKey: ["game", gameId],
    queryFn: async (): Promise<GameListItem | null> => {
      const { data, response } = await api.GET("/v1/games/{gameId}", {
        params: { path: { gameId } },
      });
      if (response.status === 404 || response.status === 400) return null;
      if (!response.ok) throw new ApiError(response.statusText, response.status);
      return data as GameListItem;
    },
    retry: 1,
  });
}
