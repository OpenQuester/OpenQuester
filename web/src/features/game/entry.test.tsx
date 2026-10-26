import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "@/api/client";
import type { GameListItem, User } from "@/api/types";
import type * as AuthQueries from "@/features/auth/useMe";
import { DEFAULT_GAME_SETTINGS } from "@/features/create-game/gameSettings";
import { GameConnection, type JoinOptions } from "@/game/connection";
import { choosing } from "@/game/fixtures";
import { useGameStore } from "@/game/store";
import { useGameConnection } from "./connection/useGameConnection";
import { GamePage } from "./GamePage";
import { JoinPanel } from "./JoinPanel";
import { getLobbySeats } from "./lobby/getLobbySeats";
import { InviteCard } from "./lobby/InviteCard";

const { navigate, auth } = vi.hoisted(() => ({
  navigate: vi.fn(),
  auth: { me: null as User | null, login: vi.fn() },
}));
const { socket, listeners } = vi.hoisted(() => {
  const listeners = new Map<string, () => void>();
  return {
    listeners,
    socket: {
      id: "game-entry-socket",
      on: vi.fn((name: string, listener: () => void) => listeners.set(name, listener)),
      emit: vi.fn(),
      removeAllListeners: vi.fn(() => listeners.clear()),
      disconnect: vi.fn(),
    },
  };
});
vi.mock("socket.io-client", () => ({ io: () => socket }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ gameId: "ABCD" }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/features/auth/useMe", async (original) => ({
  ...(await original<typeof AuthQueries>()),
  useMe: () => ({ data: auth.me }),
  useGuestLogin: () => ({ mutateAsync: auth.login, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  auth.me = null;
});

it("keeps invite-copy feedback for the latest click and clears its timer on exit", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  const view = render(<InviteCard gameId="ABCD" password={null} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy" })));
  act(() => vi.advanceTimersByTime(1500));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copied" })));
  act(() => vi.advanceTimersByTime(600));
  expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps one mounted connection through updates and closes it on StrictMode replay and exit", () => {
  const connect = vi.spyOn(GameConnection.prototype, "connect").mockImplementation(() => {});
  const close = vi.spyOn(GameConnection.prototype, "close").mockImplementation(() => {});
  useGameStore.getState().begin("ABCD");
  useGameStore.setState({ left: { gameId: "OLD", why: "deleted" } });
  const { result, rerender, unmount } = renderHook(
    ({ myId, join }) => useGameConnection("ABCD", myId, join),
    {
      initialProps: { myId: 2, join: { role: "player" } as JoinOptions },
      reactStrictMode: true,
    },
  );
  const connection = result.current.connection;
  expect(connect.mock.contexts).toEqual([connection, connection]);
  expect(close.mock.contexts).toEqual([connection]);
  expect(navigate).not.toHaveBeenCalled();

  act(() => useGameStore.setState({ session: choosing(), connection: "replaced" }));
  rerender({ myId: 3, join: { role: "spectator", password: "changed" } });
  expect(result.current.connection).toBe(connection);
  expect(result.current.value).toEqual({ connection, myId: 3 });
  expect(result.current.replaced).toBe(true);
  expect(connect).toHaveBeenCalledTimes(2);

  act(() => useGameStore.getState().markLeft("deleted"));
  expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/", search: { notice: "deleted" } });
  unmount();
  expect(close.mock.contexts).toEqual([connection, connection]);
});

const game: GameListItem = {
  id: "ABCD",
  title: "Friday quiz",
  isPrivate: true,
  maxPlayers: 8,
  players: [],
  createdBy: { id: 1, username: "Host" },
  createdAt: "2026-10-21T12:00:00Z",
  ageRestriction: "NONE",
  settings: DEFAULT_GAME_SETTINGS,
  package: {
    id: 1,
    title: "Cities",
    createdAt: "2026-10-21T12:00:00Z",
    author: { id: 1, username: "Host" },
    ageRestriction: "NONE",
    roundsCount: 1,
    questionsCount: 10,
    tags: [],
  },
};

it.each(["player", "showman", "spectator"] as const)(
  "retries a private-game rejoin as %s after leaving a failed visit",
  async (role) => {
    auth.me = { id: 2, username: "Pat Smith" } as User;
    useGameStore.getState().begin(game.id);
    const authenticate = vi
      .spyOn(api, "POST")
      .mockRejectedValueOnce(new Error("Temporary authentication failure"))
      .mockResolvedValue({ response: new Response(), data: undefined });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["game", game.id], {
      ...game,
      players: [{ id: auth.me.id, role, slot: role === "player" ? 3 : null }],
    });
    const page = () => (
      <QueryClientProvider client={client}>
        <GamePage />
      </QueryClientProvider>
    );
    const firstVisit = render(page(), { reactStrictMode: true });
    await act(async () => listeners.get("connect")?.());
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(useGameStore.getState().joinError).toBe("auth_failed");
    expect(socket.emit).not.toHaveBeenCalled();
    firstVisit.rerender(page());
    expect(screen.getByRole("alert")).toBeVisible();
    expect(listeners.has("connect")).toBe(false);

    firstVisit.unmount();
    render(page());
    await act(async () => listeners.get("connect")?.());
    expect(authenticate).toHaveBeenCalledTimes(2);
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("join", {
      gameId: game.id,
      role,
      targetSlot: role === "player" ? 3 : null,
      password: null,
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Game password")).not.toBeVisible();
  },
);

it("preserves masked join drafts and lets a guest correct local and server password errors", async () => {
  const onJoin = vi.fn();
  const view = (preview: GameListItem | null, joinError: string | null = null, joining = false) => (
    <JoinPanel
      gameId="ABCD"
      game={preview}
      loading={preview === null}
      onJoin={onJoin}
      joinError={joinError}
      joining={joining}
    />
  );
  const { rerender } = render(view(game));
  const password = screen.getByLabelText("Game password");
  expect(password).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
  expect(onJoin).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(password).toHaveAttribute("type", "password");
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "  Pat   Smith  " } });
  fireEvent.change(screen.getByLabelText("Game password"), { target: { value: "  draft  " } });
  rerender(view(null));
  expect(screen.queryByLabelText("Your name")).toBeNull();
  rerender(view(game));
  expect(screen.getByLabelText("Your name")).toHaveValue("  Pat   Smith  ");
  expect(screen.getByLabelText("Game password")).toHaveValue("  draft  ");
  fireEvent.change(screen.getByLabelText("Game password"), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Join as player" }));
  expect(screen.getByRole("alert")).toHaveTextContent("This game needs a password.");
  expect(auth.login).not.toHaveBeenCalled();
  for (const invalid of ["фівфів", "has space", "x".repeat(17)]) {
    fireEvent.change(screen.getByLabelText("Game password"), { target: { value: invalid } });
    fireEvent.click(screen.getByRole("button", { name: "Spectate" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use 1–16 Latin letters, digits, - or _.");
  }
  expect(auth.login).not.toHaveBeenCalled();
  expect(onJoin).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Game password"), { target: { value: "wrong" } });
  auth.login.mockRejectedValueOnce(new Error("Try the connection again"));
  fireEvent.click(screen.getByRole("button", { name: "Join as player" }));
  await screen.findByText("Try the connection again");
  expect(auth.login).toHaveBeenCalledExactlyOnceWith("Pat Smith");
  expect(onJoin).not.toHaveBeenCalled();

  auth.login.mockImplementationOnce(async () => {
    auth.me = { id: 2, username: "Pat Smith" } as User;
  });
  fireEvent.click(screen.getByRole("button", { name: "Join as player" }));
  await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
  expect(auth.login).toHaveBeenCalledTimes(2);
  const beforeError = screen.getByLabelText("Game password");
  rerender(view(game, null, true));
  const player = screen.getByRole("button", { name: "Join as player" });
  const spectator = screen.getByRole("button", { name: "Spectate" });
  expect(beforeError).toBeVisible();
  expect(player).toBeDisabled();
  expect(spectator).toBeDisabled();
  expect(player).toHaveAttribute("aria-busy", "true");
  expect(within(player).getByRole("status", { hidden: true })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Try the connection again");
  fireEvent.submit(beforeError.closest("form")!);
  expect(onJoin).toHaveBeenCalledTimes(1);
  rerender(view(game, "Password is incorrect"));
  expect(player).toBeEnabled();
  expect(spectator).toBeEnabled();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("Incorrect password. Try again.");
  expect(screen.getByLabelText("Game password")).toBe(beforeError);
  expect(beforeError).toHaveValue("wrong");
  onJoin.mockClear();
  fireEvent.change(screen.getByLabelText("Game password"), { target: { value: "  QUIZ  " } });
  fireEvent.click(screen.getByRole("button", { name: "Spectate" }));
  expect(onJoin).toHaveBeenCalledExactlyOnceWith({
    role: "spectator",
    targetSlot: null,
    password: "QUIZ",
  });
  expect(auth.login).toHaveBeenCalledTimes(2);
  rerender(view(game, null, true));
  expect(spectator).toHaveAttribute("aria-busy", "true");
  expect(within(spectator).getByRole("status", { hidden: true })).toBeVisible();
  expect(within(player).queryByRole("status", { hidden: true })).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("Incorrect password. Try again.");
});

it("retains offline and unnumbered players while limiting empty seat cards", () => {
  const players = choosing().players.filter((player) => player.role === "player");
  const offline = { ...players[0]!, status: "disconnected" as const, slot: 4 };
  const unnumbered = { ...players[1]!, slot: null };
  const { slots, hiddenEmpty } = getLobbySeats([offline, unnumbered], 8);
  expect(slots).toEqual([
    { p: unnumbered, index: 0 },
    { p: null, index: 1 },
    { p: null, index: 2 },
    { p: offline, index: 4 },
  ]);
  expect(hiddenEmpty).toBe(4);
});
