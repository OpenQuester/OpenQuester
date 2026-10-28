import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Discord from "@/features/auth/discord";
import { LoginPage } from "@/features/auth/LoginPage";
import { UploadAccess } from "./UploadAccess";

const { get, start, search } = vi.hoisted(() => ({
  get: vi.fn(),
  start: vi.fn(),
  search: { redirect: "/packages/upload" },
}));
vi.mock("@/api/client", () => ({
  api: { GET: get },
  unwrap: async (request: Promise<{ data?: unknown; response: Response }>) => {
    const { data, response } = await request;
    if (!response.ok) throw new Error("settings failed");
    return data;
  },
}));
vi.mock("@/features/auth/discord", async (original) => ({
  ...(await original<typeof Discord>()),
  startDiscordLogin: start,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode;
    to: string;
    search: { redirect: string };
  }) => <a href={`${to}?redirect=${search.redirect}`}>{children}</a>,
  useSearch: () => search,
  useNavigate: () => vi.fn(),
}));

const clients: QueryClient[] = [];
const configured = { oauthProviders: [{ provider: "discord", clientId: "client-123" }] };
const success = (data: unknown) => ({ data, response: new Response(null, { status: 200 }) });
function setup(me: { id: number; isGuest: boolean } | null, data?: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  client.setQueryData(["me"], me);
  if (data) client.setQueryData(["auth-settings"], data);
  render(
    <QueryClientProvider client={client}>
      <UploadAccess>
        <p>Upload content</p>
      </UploadAccess>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  get.mockReset();
  start.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe("upload access", () => {
  it("shows loading until settings resolve, then offers Discord with upload return", async () => {
    let resolve!: (value: unknown) => void;
    get.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    setup({ id: 1, isGuest: true });
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByText(/isn't switched on/)).toBeNull();
    await act(async () => resolve(success(configured)));
    const button = await screen.findByRole("button", { name: "Sign in with Discord" });
    expect(button.querySelector("img")).toHaveAttribute("alt", "");
    await userEvent.click(button);
    expect(start).toHaveBeenCalledExactlyOnceWith("client-123", "/packages/upload");
  });

  it("reports an error and retries instead of calling Discord unavailable", async () => {
    get
      .mockResolvedValueOnce({ response: new Response(null, { status: 503 }) })
      .mockResolvedValueOnce(success(configured));
    setup({ id: 1, isGuest: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load");
    expect(screen.queryByText(/isn't switched on/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Sign in with Discord" })).toBeVisible();
  });

  it("only says unavailable when the server returns no Discord provider", async () => {
    get.mockResolvedValue(success({ oauthProviders: [] }));
    setup({ id: 1, isGuest: true });
    expect(await screen.findByText(/Discord sign-in isn't switched on/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sign in with Discord" })).toBeNull();
  });

  it("keeps a cached configured action when refresh fails", async () => {
    get.mockResolvedValue({ response: new Response(null, { status: 503 }) });
    const client = setup({ id: 1, isGuest: true }, configured);
    await act(async () => {
      await client.refetchQueries({ queryKey: ["auth-settings"] });
    });
    expect(screen.getByRole("button", { name: "Sign in with Discord" })).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("preserves visitor login redirect and signed-in access", async () => {
    get.mockResolvedValue(success(configured));
    const client = setup(null);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?redirect=/packages/upload",
    );
    act(() => client.setQueryData(["me"], { id: 2, isGuest: false }));
    await waitFor(() => expect(screen.getByText("Upload content")).toBeVisible());
  });

  it("reuses the branded action on the login page with its return target", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    client.setQueryData(["auth-settings"], configured);
    render(
      <QueryClientProvider client={client}>
        <LoginPage />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign in with Discord" }));
    expect(start).toHaveBeenCalledExactlyOnceWith("client-123", "/packages/upload");
  });
});
