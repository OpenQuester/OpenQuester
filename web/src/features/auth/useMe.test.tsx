import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => vi.restoreAllMocks());

  it("keeps the user signed in when the server refuses the logout", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "nope" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    const { qc, result } = setup();

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(meKey)).toEqual({ id: 1, username: "pat" });
  });
});
