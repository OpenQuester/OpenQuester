import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as Router from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as ApiClient from "@/api/client";
import { takeJoinIntent } from "@/features/game/joinIntent";

import { CreateGamePage } from "./CreateGamePage";

const { post, navigate } = vi.hoisted(() => ({ post: vi.fn(), navigate: vi.fn() }));

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  api: { POST: post },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  useSearch: () => ({ packageId: 7 }),
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

beforeEach(() => {
  post.mockReset().mockResolvedValue({ data: { id: "GAME" }, response: new Response() });
  navigate.mockReset().mockResolvedValue(undefined);
  takeJoinIntent("GAME");
});

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], { id: 1, username: "Host" });
  client.setQueryData(["package", 7], {
    id: 7,
    title: "Quiz",
    author: { id: 1 },
    rounds: [],
    uploadStatus: "ready",
  });
  render(
    <QueryClientProvider client={client}>
      <CreateGamePage />
    </QueryClientProvider>,
  );
  return client;
}

describe("private game creation", () => {
  it.each(["", "Pass_123-Xyz"])("submits private password %j correctly", async (password) => {
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Password" }));
    if (password) await user.type(screen.getByLabelText("Password", { exact: true }), password);
    await user.click(screen.getByRole("button", { name: "Create & open lobby" }));

    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/v1/games", {
      body: expect.objectContaining({ isPrivate: true, packageId: 7 }),
    });
    const body = post.mock.calls[0]?.[1].body;
    if (password) expect(body.password).toBe(password);
    else expect(body).not.toHaveProperty("password");
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/games/$gameId", params: { gameId: "GAME" } }),
    );
  });

  it("retains drafts and timer disclosure through query refresh, failure and retry", async () => {
    const client = renderForm();
    const user = userEvent.setup();
    const title = screen.getByLabelText("Game name");
    await user.type(title, "  My quiz  ");
    await user.click(screen.getByRole("radio", { name: "Password" }));
    await user.type(screen.getByLabelText("Password", { exact: true }), "Keep_123");
    await user.click(screen.getByRole("radio", { name: "Anyone with the link" }));
    await user.click(screen.getByRole("radio", { name: "Password" }));
    const password = screen.getByLabelText("Password", { exact: true });
    expect(password).toHaveValue("Keep_123");
    await user.click(screen.getByText("Timers", { selector: "summary" }));
    const details = screen.getByText("Timers", { selector: "summary" }).parentElement;
    const timer = screen.getByLabelText("Time to press the buzzer");
    await user.selectOptions(timer, "15");
    await user.selectOptions(screen.getByLabelText("Round time limit"), "15");
    await user.selectOptions(screen.getByLabelText("Players", { exact: true }), "10");
    await act(async () => {
      client.setQueryData(["me"], { id: 1, username: "Updated host" });
      client.setQueryData(["package", 7], {
        id: 7,
        title: "Updated package",
        author: { id: 1 },
        rounds: [],
        uploadStatus: "ready",
      });
    });
    expect(screen.getByLabelText("Game name")).toBe(title);
    expect(title).toHaveValue("  My quiz  ");
    expect(screen.getByLabelText("Password", { exact: true })).toBe(password);
    expect(screen.getByLabelText("Time to press the buzzer")).toBe(timer);
    expect(timer).toHaveValue("15");
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("Timers", { selector: "summary" }).parentElement).toBe(details);

    let reject!: (error: Error) => void;
    post.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    await user.click(screen.getByRole("button", { name: "Create & open lobby" }));
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    expect(takeJoinIntent("GAME")).toBeUndefined();
    await act(async () => reject(new Error("Try again")));
    expect(screen.getByRole("alert")).toHaveTextContent("Try again");
    expect(password).toHaveValue("Keep_123");
    expect(details).toHaveAttribute("open");
    expect(navigate).not.toHaveBeenCalled();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await user.click(screen.getByRole("button", { name: "Create & open lobby" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
    expect(post.mock.calls[1]?.[1].body).toMatchObject({
      title: "My quiz",
      maxPlayers: 10,
      password: "Keep_123",
      isPrivate: true,
      settings: { timers: { answerMs: 15000, roundMs: 900000 } },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["games"] });
    expect(takeJoinIntent("GAME")).toEqual({ role: "showman" });
    client.clear();
  });
});
