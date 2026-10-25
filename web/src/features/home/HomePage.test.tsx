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
  ])("names the compact search and inline clear controls in %s", (lang, label, clear, help) => {
    void i18n.changeLanguage(lang);
    render(<HomePage />);
    const input = screen.getByRole("searchbox", { name: label });
    expect(input).toHaveAttribute("placeholder", label);
    expect(input).toHaveAccessibleDescription(help);
    expect(input).toHaveAttribute("maxlength", "70");
    expect(screen.queryByText(label)).not.toBeInTheDocument();
    const form = screen.getByRole("search", { name: label });
    const filters = screen.getByRole("group", { name: i18n.t("home.filter") });
    expect(form.compareDocumentPosition(filters)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByRole("button", { name: clear })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "quiz" } });
    expect(screen.getByRole("button", { name: clear })).toBeVisible();
    expect(screen.queryByText(clear)).not.toBeInTheDocument();
  });

  it("waits one idle second after every raw edit while keeping committed results visible", () => {
    vi.useFakeTimers();
    queries.set("", { data: [game("RECENT", "Recent game")] });
    queries.set("quiz", { data: [game("OLDER", "Quiz beyond the initial page")] });
    const view = render(<HomePage />);
    const input = screen.getByRole("searchbox", { name: "Search games" });
    expect(screen.getByText("Recent game")).toBeVisible();
    fireEvent.change(input, { target: { value: "  Qu  " } });
    act(() => vi.advanceTimersByTime(900));
    fireEvent.change(input, { target: { value: "  QuIz  " } });
    act(() => vi.advanceTimersByTime(900));
    fireEvent.change(input, { target: { value: "  QUIZ  " } });
    act(() => vi.advanceTimersByTime(900));
    fireEvent.change(input, { target: { value: "  QUIZ   " } });
    act(() => vi.advanceTimersByTime(999));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Recent game")).toBeVisible();
    expect(screen.queryByText("No games match your search and filters.")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Quiz beyond the initial page")).toBeVisible();
    expect(input).toHaveValue("  QUIZ   ");
    fireEvent.change(input, { target: { value: "QUIZ" } });
    expect(screen.getByText("Quiz beyond the initial page")).toBeVisible();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.change(input, { target: { value: "pending" } });
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("commits a submitted search immediately and cancels the pending idle commit", () => {
    vi.useFakeTimers();
    queries.set("", { data: [game("RECENT", "Recent game")] });
    queries.set("quiz", { data: [game("MATCH", "Quiz match")] });
    render(<HomePage />);
    const input = screen.getByRole("searchbox", { name: "Search games" });
    fireEvent.change(input, { target: { value: "  QuIz  " } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.submit(screen.getByRole("search", { name: "Search games" }));
    expect(screen.getByText("Quiz match")).toBeVisible();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("Quiz match")).toBeVisible();
  });

  it("does not submit or auto-commit an IME composition, including the Safari Enter key", () => {
    vi.useFakeTimers();
    queries.set("", { data: [game("RECENT", "Recent game")] });
    queries.set("київ", { data: [game("MATCH", "Київ: вечір")] });
    render(<HomePage />);
    const input = screen.getByRole("searchbox", { name: "Search games" });
    const form = screen.getByRole("search", { name: "Search games" });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "Київ" } });
    act(() => vi.advanceTimersByTime(1000));
    expect(fireEvent.keyDown(input, { key: "Enter", isComposing: true })).toBe(false);
    fireEvent.submit(form);
    expect(screen.getByText("Recent game")).toBeVisible();
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.compositionEnd(input);
    expect(fireEvent.keyDown(input, { key: "Enter", keyCode: 229 })).toBe(false);
    expect(screen.getByText("Recent game")).toBeVisible();
    fireEvent.submit(form);
    expect(screen.getByText("Київ: вечір")).toBeVisible();
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
    act(() => vi.advanceTimersByTime(1000));
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

    // jsdom queues a selectionchange task when clear returns focus to the input.
    act(() => vi.advanceTimersByTime(0));
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.change(input, { target: { value: "pending" } });
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
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
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByText("No games match your search and filters.")).not.toBeInTheDocument();
    queries.set("quiz", { data: [] });
    view.rerender(<HomePage />);
    expect(screen.getByText("No games match your search and filters.")).toBeVisible();
    queries.set("quiz", { data: [game("MATCH", "Quiz match")], isFetching: true });
    view.rerender(<HomePage />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Quiz match")).toBeVisible();
    expect(screen.getByText("Quiz match").closest("[aria-live]")).toHaveAttribute(
      "aria-busy",
      "true",
    );
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
