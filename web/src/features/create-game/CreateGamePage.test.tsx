import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as Router from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as ApiClient from "@/api/client";

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
});
