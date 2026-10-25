import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
});

import { gamesKey, useGames } from "./useGames";

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
});

describe("game list queries", () => {
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
    expect(client.getQueryData([...gamesKey, "old"])).toBeUndefined();
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
