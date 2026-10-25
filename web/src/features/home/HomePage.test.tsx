import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameListItem } from "@/api/types";
import { DEFAULT_GAME_SETTINGS } from "@/features/create-game/gameSettings";
import { i18n } from "@/i18n";
import type * as GameQueries from "./useGames";
import { HomePage } from "./HomePage";

const { queries, hidden, navigate } = vi.hoisted(() => ({
  queries: new Map<
    string,
    { data?: GameListItem[]; isLoading?: boolean; isError?: boolean; isFetching?: boolean }
  >(),
  hidden: [] as string[],
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  useNavigate: () => navigate,
  Link: ({ children, ...props }: { children: ReactNode; "aria-label"?: string }) => (
    <a href="/games/test" aria-label={props["aria-label"]}>
      {children}
    </a>
  ),
}));
vi.mock("@/features/auth/useMe", () => ({ useMe: () => ({ data: { id: 1 } }) }));
vi.mock("@/game/store", () => ({
  leftGames: () => [...hidden],
  rememberLeftGame: (id: string) => hidden.push(id),
}));
vi.mock("./useGames", async (original) => ({
  ...(await original<typeof GameQueries>()),
  useGames: (prefix = "") => queries.get(prefix) ?? { data: [] },
}));

function game(id: string, title: string, extra: Partial<GameListItem> = {}): GameListItem {
  return {
    id,
    title,
    createdAt: "2026-10-25T12:00:00Z",
    createdBy: { id: 2, username: "Host" },
    ageRestriction: "NONE",
    isPrivate: false,
    maxPlayers: 4,
    players: [],
    package: {
      id: 7,
      title: "Package",
      createdAt: "2026-10-25T12:00:00Z",
      author: { id: 2, username: "Author" },
      ageRestriction: "NONE",
      roundsCount: 1,
      questionsCount: 5,
      tags: [],
    },
    settings: DEFAULT_GAME_SETTINGS,
    ...extra,
  };
}

beforeEach(() => {
  queries.clear();
  hidden.length = 0;
  navigate.mockReset();
  void i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  void i18n.changeLanguage("en");
});

describe("open game search", () => {
  it.each([
    ["en", "Search games", "Clear search", "Match the start of a game title."],
    ["uk", "Пошук ігор", "Очистити пошук", "Пошук за початком назви гри."],
    ["ru", "Поиск игр", "Очистить поиск", "Поиск по началу названия игры."],
  ])("labels the search and clear controls in %s", (lang, label, clear, help) => {
    void i18n.changeLanguage(lang);
    render(<HomePage />);
    const input = screen.getByRole("searchbox", { name: label });
    expect(input).toHaveAccessibleDescription(help);
    expect(input).toHaveAttribute("maxlength", "70");
    expect(screen.getByRole("button", { name: clear })).toBeDisabled();
  });

  it("debounces the latest trimmed, case-insensitive prefix without showing stale results", () => {
    vi.useFakeTimers();
    queries.set("", { data: [game("RECENT", "Recent game")] });
    queries.set("quiz", { data: [game("OLDER", "Quiz beyond the initial page")] });
    const view = render(<HomePage />);
    const input = screen.getByRole("searchbox", { name: "Search games" });
    expect(screen.getByText("Recent game")).toBeVisible();
    fireEvent.change(input, { target: { value: "  Qu  " } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(input, { target: { value: "  QuIz  " } });
    act(() => vi.advanceTimersByTime(249));
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByText("Recent game")).not.toBeInTheDocument();
    expect(screen.queryByText("No games match your search and filters.")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Quiz beyond the initial page")).toBeVisible();
    expect(input).toHaveValue("  QuIz  ");
    fireEvent.change(input, { target: { value: "QUIZ" } });
    expect(screen.getByText("Quiz beyond the initial page")).toBeVisible();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.change(input, { target: { value: "pending" } });
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("composes status filters with server search and keeps rejoin independent", () => {
    vi.useFakeTimers();
    queries.set("", {
      data: [
        game("MINE", "My retained game", {
          players: [{ id: 1, role: "player", status: "disconnected" }],
        }),
        game("DEFAULT", "Default running game", { startedAt: "2026-10-25T12:01:00Z" }),
      ],
    });
    queries.set("quiz", {
      data: [
        game("LOBBY", "Quiz lobby"),
        game("PLAY", "Quiz running", { startedAt: "2026-10-25T12:01:00Z" }),
        game("DONE", "Quiz finished", { finishedAt: "2026-10-25T12:02:00Z" }),
      ],
    });
    render(<HomePage />);
    const input = screen.getByRole("searchbox", { name: "Search games" });
    const filters = screen.getByRole("group", { name: "Filter games" });
    const playing = within(filters).getByRole("button", { name: "In progress" });
    fireEvent.click(playing);
    fireEvent.change(input, { target: { value: "quiz" } });
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByText("Quiz running")).toBeVisible();
    expect(screen.queryByText("Quiz lobby")).not.toBeInTheDocument();
    expect(screen.queryByText("Quiz finished")).not.toBeInTheDocument();
    expect(screen.getByText("You're still in “My retained game”")).toBeVisible();
    fireEvent.click(within(filters).getByRole("button", { name: "In lobby" }));
    expect(screen.getByText("Quiz lobby")).toBeVisible();
    expect(screen.queryByText("Quiz running")).not.toBeInTheDocument();
    fireEvent.click(playing);

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(playing).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Default running game")).toBeVisible();
    expect(screen.queryByText("Quiz running")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "pending" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByText("Default running game")).toBeVisible();
    expect(screen.getByText("You're still in “My retained game”")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByRole("link", { name: "Rejoin" })).not.toBeInTheDocument();
  });

  it("shows distinct empty, loading, no-match and failed-search feedback", () => {
    vi.useFakeTimers();
    const view = render(<HomePage />);
    const input = screen.getByRole("searchbox", { name: "Search games" });
    expect(screen.getByText("No open games right now. Host one and share the link!")).toBeVisible();
    queries.set("quiz", { isLoading: true, isFetching: true });
    fireEvent.change(input, { target: { value: "quiz" } });
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByText("No games match your search and filters.")).not.toBeInTheDocument();
    queries.set("quiz", { data: [] });
    view.rerender(<HomePage />);
    expect(screen.getByText("No games match your search and filters.")).toBeVisible();
    queries.set("quiz", { isError: true });
    view.rerender(<HomePage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load games");
    expect(input).toHaveValue("quiz");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("No open games right now. Host one and share the link!")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "In lobby" }));
    expect(screen.getByText("No games match your search and filters.")).toBeVisible();
  });
});
