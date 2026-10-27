import { StrictMode, useLayoutEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { round } from "@/game/fixtures";
import { i18n } from "@/i18n/index";
import { RoundTransition } from "./RoundTransition";

const first = round();
const second = { ...first, id: 2, order: 1, name: "Music" };

beforeEach(() => {
  vi.useFakeTimers();
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  void i18n.changeLanguage("en");
});

it("plays when the lobby starts the first round", () => {
  const view = render(<RoundTransition round={null} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(<RoundTransition round={first} />);
  expect(screen.getByRole("dialog", { name: "First round" })).toHaveTextContent(
    "Round 1 — Round 1",
  );
  act(() => vi.advanceTimersByTime(3500));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("does not play when entering or reloading an already started game", () => {
  const view = render(<RoundTransition round={first} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.unmount();
  render(<RoundTransition round={second} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("opens the modal before the updated game frame can paint", () => {
  const visibleBeforePaint = vi.fn();
  function GameFrame({ round }: { round: typeof first }) {
    useLayoutEffect(() => {
      visibleBeforePaint(document.querySelector("dialog")?.open ?? false);
    }, [round]);
    return <RoundTransition round={round} />;
  }
  const view = render(<GameFrame round={first} />);
  view.rerender(<GameFrame round={second} />);
  expect(visibleBeforePaint).toHaveBeenLastCalledWith(true);
});

it("shows a changed round for 3.5 seconds without restarting on ordinary updates", () => {
  const view = render(<RoundTransition round={first} />);
  view.rerender(<RoundTransition round={second} />);
  expect(screen.getByRole("dialog", { name: "Next round" })).toHaveTextContent("Round 2 — Music");
  act(() => vi.advanceTimersByTime(1000));
  view.rerender(<RoundTransition round={{ ...second, themes: [] }} />);
  act(() => vi.advanceTimersByTime(2499));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(<RoundTransition round={{ ...second }} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("uses the round ID, falling back to order when IDs are absent", () => {
  const view = render(<RoundTransition round={first} />);
  view.rerender(<RoundTransition round={{ ...first, id: 2 }} />);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  view.unmount();
  const withoutIds = render(<RoundTransition round={{ ...first, id: undefined }} />);
  withoutIds.rerender(<RoundTransition round={{ ...second, id: undefined }} />);
  expect(screen.getByRole("dialog")).toHaveTextContent("Round 2 — Music");
});

it("replaces an active transition for the final round and clears the old timer", () => {
  const view = render(
    <StrictMode>
      <RoundTransition round={first} />
    </StrictMode>,
  );
  view.rerender(
    <StrictMode>
      <RoundTransition round={second} />
    </StrictMode>,
  );
  const oldDialog = screen.getByRole("dialog");
  act(() => vi.advanceTimersByTime(3000));
  view.rerender(
    <StrictMode>
      <RoundTransition round={{ ...round("final"), id: 3, order: 2 }} />
    </StrictMode>,
  );
  expect(oldDialog).not.toHaveAttribute("open");
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole("dialog")).toHaveTextContent("Round 3 — Final");
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("cannot be dismissed and releases the modal and timer on unmount", () => {
  const view = render(<RoundTransition round={first} />);
  view.rerender(<RoundTransition round={second} />);
  const dialog = screen.getByRole("dialog");
  const cancel = new Event("cancel", { cancelable: true });
  fireEvent(dialog, cancel);
  fireEvent.click(dialog);
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog).toHaveAttribute("open");
  view.unmount();
  expect(dialog).not.toHaveAttribute("open");
  expect(vi.getTimerCount()).toBe(0);
  const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
  window.dispatchEvent(escape);
  expect(escape.defaultPrevented).toBe(false);
});

it.each([
  ["uk", "Наступний раунд", "Раунд 2 — Music"],
  ["ru", "Следующий раунд", "Раунд 2 — Music"],
])("localizes the interlude in %s", async (language, title, description) => {
  await i18n.changeLanguage(language);
  const view = render(<RoundTransition round={first} />);
  view.rerender(<RoundTransition round={second} />);
  expect(screen.getByRole("dialog", { name: title })).toHaveTextContent(description);
});
