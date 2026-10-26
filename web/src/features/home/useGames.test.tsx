import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
});
const auth = vi.hoisted(() => ({ userId: 1 as number | null }));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/features/auth/useMe", () => ({
  useMe: () => ({ data: auth.userId === null ? null : { id: auth.userId } }),
}));

import { gamesKey, useGames } from "./useGames";
import { useHomePage } from "./useHomePage";

const clients: QueryClient[] = [];

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

function response(data: { id: string; title: string }[]) {
  return new Response(JSON.stringify({ data, pageInfo: { total: data.length } }), {
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.length = 0;
  fetchMock.mockReset();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  auth.userId = 1;
});

describe("game list queries", () => {
  it.each([false, true])(
    "combines server status and title filters before the page limit when authenticated=%s",
    async (authenticated) => {
      vi.useFakeTimers();
      auth.userId = authenticated ? 1 : null;
      const retained = {
        id: "MINE",
        title: "Retained game",
        players: [{ id: 1, role: "player" }],
      };
      const recentLobbies = Array.from({ length: 49 }, (_, index) => ({
        id: `RECENT${index}`,
        title: `Recent lobby ${index}`,
        players: [],
      }));
      const playing = {
        id: "OLDER",
        title: "Quiz playing beyond the first page",
        startedAt: "2026-10-25T12:00:00Z",
        players: [],
      };
      const lobby = { id: "LOBBY", title: "Quiz lobby", players: [] };
      fetchMock.mockImplementation(async (input) => {
        const status = new URL((input as Request).url).searchParams.get("status");
        if (status === "playing") return response([playing]);
        if (status === "lobby") return response([lobby]);
        return response([retained, ...recentLobbies]);
      });
      const { client, wrapper } = setup();
      const { result } = renderHook(() => useHomePage(), { wrapper });
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(result.current.visible).toHaveLength(50);
      expect(result.current.visible.some((game) => game.id === playing.id)).toBe(false);
      expect(fetchMock).toHaveBeenCalledOnce();

      act(() => result.current.setFilter("playing"));
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(result.current.visible.map((game) => game.id)).toEqual([playing.id]);
      act(() => result.current.changeSearch("  QuIz  "));
      await act(async () => vi.advanceTimersByTimeAsync(1000));
      // The debounce commits React state before the new query can notify its observer.
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(result.current.visible.map((game) => game.id)).toEqual([playing.id]);
      const combinedQuery = new URL((fetchMock.mock.calls[2]![0] as Request).url).searchParams;
      expect(Object.fromEntries(combinedQuery)).toEqual({
        limit: "50",
        offset: "0",
        sortBy: "createdAt",
        order: "desc",
        titlePrefix: "quiz",
        status: "playing",
      });
      expect(result.current.mine?.id).toBe(authenticated ? retained.id : undefined);

      act(() => result.current.setFilter("lobby"));
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(result.current.visible.map((game) => game.id)).toEqual([lobby.id]);
      act(() => result.current.setFilter("playing"));
      expect(result.current.visible.map((game) => game.id)).toEqual([playing.id]);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(client.getQueryData([...gamesKey, "quiz", "playing"])).toEqual([playing]);
      expect(client.getQueryData([...gamesKey, "quiz", "lobby"])).toEqual([lobby]);

      act(() => result.current.changeSearch(""));
      expect(result.current.filter).toBe("playing");
      expect(result.current.visible.map((game) => game.id)).toEqual([playing.id]);
      expect(result.current.mine?.id).toBe(authenticated ? retained.id : undefined);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      const requestsBeforeRefresh = fetchMock.mock.calls.length;
      await act(async () => client.invalidateQueries({ queryKey: gamesKey }));
      const refreshedQueries = fetchMock.mock.calls.slice(requestsBeforeRefresh).map(([input]) => {
        const query = new URL((input as Request).url).searchParams;
        return { prefix: query.get("titlePrefix"), status: query.get("status") };
      });
      const expectedRefreshes: { prefix: string | null; status: string | null }[] = [
        { prefix: null, status: "playing" },
      ];
      if (authenticated) expectedRefreshes.unshift({ prefix: null, status: null });
      expect(refreshedQueries).toEqual(expectedRefreshes);
    },
  );

  it.each([false, true])(
    "polls only the needed Home lists when authenticated=%s and restores the default list on clear",
    async (authenticated) => {
      vi.useFakeTimers();
      focusManager.setFocused(true);
      auth.userId = authenticated ? 1 : null;
      fetchMock.mockImplementation(async () => response([]));
      const { wrapper } = setup();
      const { result } = renderHook(() => useHomePage(), { wrapper });
      const requestedPrefixes = () =>
        fetchMock.mock.calls.map(([input]) => {
          const url = new URL((input as Request).url);
          return url.searchParams.get("titlePrefix") ?? "";
        });

      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(requestedPrefixes()).toEqual([""]);
      await act(async () => vi.advanceTimersByTimeAsync(5000));
      expect(requestedPrefixes()).toEqual(["", ""]);

      act(() => result.current.changeSearch("quiz"));
      expect(requestedPrefixes()).toEqual(["", ""]);
      await act(async () => vi.advanceTimersByTimeAsync(1100));
      expect(requestedPrefixes()).toEqual(["", "", "quiz"]);
      await act(async () => vi.advanceTimersByTimeAsync(5000));
      const expectedSearchPolls = authenticated ? ["", "quiz"] : ["quiz"];
      expect(requestedPrefixes().slice(3)).toEqual(expectedSearchPolls);

      const requestsBeforeClear = fetchMock.mock.calls.length;
      act(() => result.current.changeSearch(""));
      expect(result.current.hasSearch).toBe(false);
      expect(result.current.games.data).toEqual([]);
      await act(async () => vi.advanceTimersByTimeAsync(5000));
      expect(requestedPrefixes().slice(requestsBeforeClear)).toEqual([""]);
    },
  );

  it("requests the server prefix beyond the initial 50 and shares normalized query caches", async () => {
    fetchMock.mockImplementation(async (input) => {
      const query = new URL((input as Request).url).searchParams;
      return query.has("titlePrefix")
        ? response([{ id: "OLDER", title: "Quiz beyond the initial page" }])
        : response([{ id: "NEWEST", title: "Recent game" }]);
    });
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ prefix }) => ({ searched: useGames(prefix), rejoin: useGames() }),
      { wrapper, initialProps: { prefix: "" } },
    );
    await waitFor(() => expect(result.current.searched.data?.[0]?.id).toBe("NEWEST"));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.current.rejoin.data).toBe(result.current.searched.data);

    rerender({ prefix: "  QuIz  " });
    await waitFor(() => expect(result.current.searched.data?.[0]?.id).toBe("OLDER"));
    expect(result.current.rejoin.data?.[0]?.id).toBe("NEWEST");
    const query = new URL((fetchMock.mock.calls[1]![0] as Request).url).searchParams;
    expect(Object.fromEntries(query)).toEqual({
      limit: "50",
      offset: "0",
      sortBy: "createdAt",
      order: "desc",
      titlePrefix: "quiz",
    });
    rerender({ prefix: "QUIZ" });
    expect(result.current.searched.data?.[0]?.id).toBe("OLDER");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => client.invalidateQueries({ queryKey: gamesKey }));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    rerender({ prefix: "   " });
    expect(result.current.searched.data?.[0]?.id).toBe("NEWEST");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      new URL((fetchMock.mock.calls[0]![0] as Request).url).searchParams.has("titlePrefix"),
    ).toBe(false);
  });

  it("cancels an obsolete prefix without replacing the newer result or rejoin cache", async () => {
    let finishOld!: (response: Response) => void;
    fetchMock.mockImplementation(async (input) => {
      const prefix = new URL((input as Request).url).searchParams.get("titlePrefix");
      if (prefix === "old") {
        return new Promise<Response>((resolve) => {
          finishOld = resolve;
        });
      }
      return response([{ id: prefix ?? "ALL", title: prefix ?? "Unfiltered game" }]);
    });
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ prefix }) => ({ searched: useGames(prefix), rejoin: useGames() }),
      { wrapper, initialProps: { prefix: "old" } },
    );
    await waitFor(() => expect(result.current.rejoin.data?.[0]?.id).toBe("ALL"));
    const oldRequest = fetchMock.mock.calls
      .map(([input]) => input as Request)
      .find((request) => new URL(request.url).searchParams.get("titlePrefix") === "old")!;
    rerender({ prefix: "new" });
    await waitFor(() => expect(result.current.searched.data?.[0]?.id).toBe("new"));
    expect(oldRequest.signal.aborted).toBe(true);
    await act(async () => finishOld(response([{ id: "old", title: "Obsolete result" }])));
    expect(result.current.searched.data?.[0]?.id).toBe("new");
    expect(result.current.rejoin.data?.[0]?.id).toBe("ALL");
    expect(client.getQueryData([...gamesKey, "old", "all"])).toBeUndefined();
  });

  it("keeps a failed search separate from the unfiltered rejoin query", async () => {
    fetchMock.mockImplementation(async (input) => {
      const query = new URL((input as Request).url).searchParams;
      return query.has("titlePrefix")
        ? new Response(JSON.stringify({ error: "Unavailable" }), { status: 503 })
        : response([{ id: "MINE", title: "Retained game" }]);
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ searched: useGames("quiz"), rejoin: useGames() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.searched.isError).toBe(true));
    expect(result.current.rejoin.data?.[0]?.id).toBe("MINE");
    expect(result.current.rejoin.isError).toBe(false);
  });
});
