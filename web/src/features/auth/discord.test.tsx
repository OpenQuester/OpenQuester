import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
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

import { useDiscordClientId } from "./discord";

function settings(oauthProviders: { provider: string; clientId: string }[]) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ oauthProviders }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

function render() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useDiscordClientId(), { wrapper });
}

describe("useDiscordClientId", () => {
  afterEach(() => fetchMock.mockReset());

  it("reads the Discord application id from the server", async () => {
    // A provider this build doesn't know yet is ignored
    settings([
      { provider: "google", clientId: "other" },
      { provider: "discord", clientId: "123456789" },
    ]);
    const { result } = render();

    await waitFor(() => expect(result.current).toBe("123456789"));
    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(new URL(request.url).pathname).toBe("/v1/auth/settings");
  });

  it("keeps Discord sign-in off when the server hasn't set it up", async () => {
    settings([]);
    const { result } = render();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
