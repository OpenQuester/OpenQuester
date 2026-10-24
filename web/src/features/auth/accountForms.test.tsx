import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as Router from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiClient from "@/api/client";
import type * as Discord from "./discord";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { useSettings } from "@/features/settings/settingsStore";
import { LoginPage } from "./LoginPage";
import { DiscordCallbackPage } from "./DiscordCallbackPage";

const { patch, post, navigate, finish, routeSearch } = vi.hoisted(() => ({
  patch: vi.fn(),
  post: vi.fn(),
  navigate: vi.fn(),
  finish: vi.fn(),
  routeSearch: {} as { redirect?: string; code?: string; error?: string },
}));
vi.mock("@/api/client", async (original) => ({
  ...(await original<typeof ApiClient>()),
  api: { PATCH: patch, POST: post },
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof Router>()),
  useSearch: () => routeSearch,
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("./discord", async (original) => ({
  ...(await original<typeof Discord>()),
  finishDiscordLogin: finish,
}));

const clients: QueryClient[] = [];
const me = { id: 1, username: "Player", name: "First name", isGuest: true, avatar: null };
beforeEach(() => {
  patch
    .mockReset()
    .mockResolvedValue({ data: { ...me, name: "My name" }, response: new Response() });
  post.mockReset().mockResolvedValue({ data: me, response: new Response() });
  navigate.mockReset().mockResolvedValue(undefined);
  finish.mockReset().mockResolvedValue("/settings");
  delete routeSearch.redirect;
  delete routeSearch.code;
  delete routeSearch.error;
  useSettings.getState().update({ language: "en", theme: "midnight" });
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
function setup(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(["me"], me);
  client.setQueryData(["stats", "me"], { gamesPlayed: 0, correctAnswers: 0, wrongAnswers: 0 });
  client.setQueryData(["auth-settings"], {
    oauthProviders: [{ provider: "discord", clientId: "fixture" }],
  });
  const view = render(
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>,
  );
  return { client, ...view };
}

describe("account form ownership", () => {
  it("preserves the raw name and input identity across query/preference updates and failed save", async () => {
    const { client } = setup(<SettingsPage />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "  My   name  ");
    await act(async () => client.setQueryData(["me"], { ...me, name: "Server name" }));
    await user.click(screen.getByRole("radio", { name: "Daylight" }));
    expect(screen.getByLabelText("Display name")).toBe(input);
    expect(input).toHaveValue("  My   name  ");
    let reject!: (error: Error) => void;
    patch.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    await act(async () => reject(new Error("Retry profile")));
    expect(screen.getByRole("alert")).toHaveTextContent("Retry profile");
    expect(input).toHaveValue("  My   name  ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Saved ✓" })).toBeVisible());
    expect(patch.mock.calls).toEqual([
      ["/v1/me", { body: { name: "My name" } }],
      ["/v1/me", { body: { name: "My name" } }],
    ]);
    expect(client.getQueryData(["me"])).toMatchObject({ name: "My name" });
    expect(screen.getByLabelText("Display name")).toBe(input);
    expect(input).toHaveValue("  My   name  ");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeVisible(), {
      timeout: 3500,
    });
  });

  it("keeps a guest name on failure and navigates only after retry succeeds", async () => {
    routeSearch.redirect = "/settings";
    setup(<LoginPage />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Your name");
    await user.type(input, "  Guest   name  ");
    post.mockRejectedValueOnce(new Error("Retry guest"));
    await user.click(screen.getByRole("button", { name: "Continue as guest" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Retry guest"));
    expect(input).toHaveValue("  Guest   name  ");
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Continue as guest" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/settings" }));
    expect(post.mock.calls).toEqual([
      ["/v1/auth/guest", { body: { username: "Guest name" } }],
      ["/v1/auth/guest", { body: { username: "Guest name" } }],
    ]);
  });

  it.each(["/login?redirect=/settings", "https://example.test"])(
    "retains the existing redirect fallback for %s",
    async (redirect) => {
      routeSearch.redirect = redirect;
      setup(<LoginPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText("Your name"), "Guest");
      await user.click(screen.getByRole("button", { name: "Continue as guest" }));
      await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
    },
  );
});

describe("Discord callback lifetime", () => {
  it("exchanges once in StrictMode, invalidates auth, then replaces the route", async () => {
    routeSearch.code = "one-use-code";
    let resolve!: (path: string) => void;
    finish.mockReturnValue(
      new Promise<string>((done) => {
        resolve = done;
      }),
    );
    const { client } = setup(<DiscordCallbackPage />);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await waitFor(() => expect(finish).toHaveBeenCalledOnce());
    expect(finish).toHaveBeenCalledWith("fixture", "one-use-code");
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => resolve("/settings"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/settings", replace: true }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me"] });
    expect(invalidate.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0]!,
    );
    expect(finish).toHaveBeenCalledOnce();
  });
  it("keeps an exchange failure visible without navigation", async () => {
    routeSearch.code = "failed-code";
    finish.mockRejectedValue(new Error("discord_token_failed"));
    setup(<DiscordCallbackPage />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("discord_token_failed"),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledOnce();
  });
});
