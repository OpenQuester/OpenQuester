import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as Router from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { takeJoinIntent } from "@/features/game/joinIntent";

import type * as Activity from "./activity";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));

const { navigate, startActivity } = vi.hoisted(() => ({
  navigate: vi.fn(),
  startActivity: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  useNavigate: () => navigate,
  Link: ({
    children,
    params,
    "aria-label": label,
  }: {
    children: ReactNode;
    params: { gameId: string };
    "aria-label"?: string;
  }) => (
    <a href={`/games/${params.gameId}`} aria-label={label}>
      {children}
    </a>
  ),
}));

vi.mock("./activity", async (importOriginal) => ({
  ...(await importOriginal<typeof Activity>()),
  startActivity,
}));

import { ActivityError } from "./activity";
import {
  ActivityPage,
  resetActivityLobbyForTests,
  roleFor,
  type ActivityGame,
} from "./ActivityPage";

const fetchMock = vi.fn<typeof fetch>();
const me = { id: 7, username: "pilot", name: "Pilot" };
const instancePath = "/v1/discord/activity/instances/i-1/game";

function game(overrides: Partial<NonNullable<ActivityGame["game"]>> = {}) {
  return {
    id: "ABCD",
    title: "Pilot's game",
    createdBy: { id: 1, username: "Host" },
    maxPlayers: 2,
    players: [],
    ...overrides,
  } as unknown as NonNullable<ActivityGame["game"]>;
}

let instance: ActivityGame = { game: null, password: null, created: false };
let games: unknown[] = [];
let created: ActivityGame = { game: game(), password: "pw", created: true };

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const { pathname } = new URL(request.url);
    if (pathname === "/v1/auth/settings")
      return json({ oauthProviders: [], discordActivity: null });
    if (pathname === "/v1/games") return json({ data: games });
    if (pathname === "/v1/packages") {
      return json({
        data: [{ id: 3, title: "Movies", author: { id: 1, username: "Author" } }],
        pageInfo: { total: 1 },
      });
    }
    if (pathname === instancePath && request.method === "GET") return json(instance);
    if (pathname === instancePath && request.method === "POST") return json(created);
    return new Response("not found", { status: 404 });
  });
  startActivity.mockResolvedValue({ instanceId: "i-1", user: me });
  navigate.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetActivityLobbyForTests();
  instance = { game: null, password: null, created: false };
  games = [];
  created = { game: game(), password: "pw", created: true };
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ActivityPage />
    </QueryClientProvider>,
  );
  return client;
}

describe("ActivityPage", () => {
  it("lets the first person pick a package and hosts the call's game", async () => {
    const client = renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Movies/ }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/games/$gameId",
        params: { gameId: "ABCD" },
        replace: true,
      }),
    );
    const post = fetchMock.mock.calls
      .map(([input]) => input as Request)
      .find((r) => r.method === "POST");
    expect(await post?.json()).toMatchObject({
      packageId: 3,
      isPrivate: true,
      title: "Pilot's game",
    });
    expect(takeJoinIntent("ABCD")).toEqual({ role: "showman", password: "pw" });
    expect(client.getQueryData(["me"])).toEqual(me);
  });

  it("sends people straight into a game someone in the call already started", async () => {
    instance = { game: game(), password: "pw", created: false };

    renderPage();

    await waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    expect(takeJoinIntent("ABCD")).toEqual({ role: "player", password: "pw" });
  });

  it("explains a failed sign-in and retries it", async () => {
    startActivity.mockRejectedValueOnce(new ActivityError("not_configured"));
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This server isn't set up to run as a Discord Activity.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: /Movies/ })).toBeInTheDocument();
    expect(startActivity).toHaveBeenCalledTimes(2);
  });
});

describe("ActivityPage after leaving the call's game", () => {
  function listed(id: string, title: string, finishedAt: string | null = null) {
    return game({
      id,
      title,
      finishedAt,
      startedAt: null,
      createdAt: new Date().toISOString(),
      package: { title: "Pack" },
      isPrivate: false,
    } as never);
  }

  async function renderLobbyCard() {
    // Coming back: the first visit already went into the game
    instance = {
      game: game({
        players: [{ id: me.id, role: "player", slot: 0, status: "disconnected" }] as never,
      }),
      password: "pw",
      created: false,
    };
    games = [
      listed("ABCD", "Call game"),
      listed("WXYZ", "Open game"),
      listed("DONE", "Old game", "2026-10-18T00:00:00Z"),
    ];
    renderPage();
    await waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    navigate.mockClear();
  }

  it("offers to go back into the call's game", async () => {
    await renderLobbyCard();
    cleanup();
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Back to the game" }));

    expect(navigate).toHaveBeenCalledWith({
      to: "/games/$gameId",
      params: { gameId: "ABCD" },
      replace: true,
    });
  });

  it("lists other open games and joins one by code", async () => {
    await renderLobbyCard();
    cleanup();
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByRole("link", { name: /Open game/ })).toHaveAttribute(
      "href",
      "/games/WXYZ",
    );
    expect(screen.queryByRole("link", { name: /Call game/ })).toBeNull();
    expect(screen.queryByText("Old game")).toBeNull();

    await user.type(screen.getByLabelText("Game code or link"), "https://x.test/games/qwer");
    await user.click(screen.getByRole("button", { name: "Join" }));

    expect(navigate).toHaveBeenCalledWith({ to: "/games/$gameId", params: { gameId: "QWER" } });
  });
});

describe("roleFor", () => {
  const seated = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: 100 + i,
      role: "player",
      slot: i,
      status: "in_game",
    }));

  it.each([
    ["the creator hosts", { game: game(), password: null, created: true }, "showman"],
    [
      "a free seat makes a player",
      { game: game({ players: seated(1) as never }), password: null, created: false },
      "player",
    ],
    [
      "a full game seats a spectator",
      { game: game({ players: seated(2) as never }), password: null, created: false },
      "spectator",
    ],
    [
      "a member keeps their role",
      {
        game: game({
          players: [{ id: me.id, role: "showman", slot: null, status: "in_game" }] as never,
        }),
        password: null,
        created: false,
      },
      "showman",
    ],
  ] as const)("%s", (_, result, role) => {
    expect(roleFor(result as ActivityGame, me.id)).toBe(role);
  });
});
