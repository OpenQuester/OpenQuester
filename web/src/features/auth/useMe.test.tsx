import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// openapi-fetch needs an absolute base URL to build requests in the test DOM
vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));

// The API client keeps the fetch it finds when it is created, so replace it first
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
});

import { meKey, useLogout } from "./useMe";

function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  qc.setQueryData(meKey, { id: 1, username: "pat" });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, ...renderHook(() => useLogout(), { wrapper }) };
}

describe("useLogout", () => {
  afterEach(() => fetchMock.mockReset());

  it.each(["HTTP", "network"])("keeps the user signed in after a %s failure", async (failure) => {
    if (failure === "network") fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    else
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ error: "nope" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );
    const { qc, result } = setup();
    const navigate = vi.fn();

    act(() => result.current.mutate(undefined, { onSuccess: navigate }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(meKey)).toEqual({ id: 1, username: "pat" });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("clears auth and runs the success callback only after the server confirms logout", async () => {
    let confirm!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        confirm = resolve;
      }),
    );
    const { qc, result } = setup();
    const navigate = vi.fn();
    act(() => result.current.mutate(undefined, { onSuccess: navigate }));
    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(qc.getQueryData(meKey)).toEqual({ id: 1, username: "pat" });
    expect(navigate).not.toHaveBeenCalled();

    await act(async () => confirm(new Response(null, { status: 204 })));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(meKey)).toBeNull();
    expect(navigate).toHaveBeenCalledOnce();
  });
});
