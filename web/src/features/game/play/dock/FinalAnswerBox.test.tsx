import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameConnection } from "@/game/connection";
import { ALICE, session, timer } from "@/game/fixtures";
import { useGameStore } from "@/game/store";
import { GameContext } from "../../GameContext";
import { FinalAnswerBox } from "./FinalAnswerBox";

function setup(event: "final-answer-submit" | "all-play-answer", paused = false) {
  const emit = vi.fn((action: string) => useGameStore.getState().setPending(action));
  useGameStore.setState({
    session: session({ timer: timer(2000), isPaused: paused }),
    connection: "connected",
    pending: null,
  });
  const view = render(
    <GameContext.Provider
      value={{ connection: { emit } as unknown as GameConnection, myId: ALICE }}
    >
      <FinalAnswerBox event={event} />
    </GameContext.Provider>,
  );
  return { emit, ...view };
}

describe.each(["final-answer-submit", "all-play-answer"] as const)("%s form", (event) => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("sends the latest answer at the deadline once, even after a manual submission", () => {
    const { emit, unmount } = setup(event);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "old answer" } });
    act(() => vi.advanceTimersByTime(1000));
    expect(emit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "  latest answer  " } });
    act(() => vi.advanceTimersByTime(250));
    expect(emit).toHaveBeenCalledExactlyOnceWith(event, { answerText: "latest answer" });
    fireEvent.click(screen.getByTestId("final-submit"));
    act(() => vi.advanceTimersByTime(2000));
    expect(emit).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not repeat a manually sent answer when the timer expires", () => {
    const { emit } = setup(event);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  manual  " } });
    fireEvent.click(screen.getByTestId("final-submit"));
    act(() => vi.advanceTimersByTime(3000));
    expect(emit).toHaveBeenCalledExactlyOnceWith(event, { answerText: "manual" });
  });

  it("unlocks a rejected answer for manual retry without retrying every timer tick", () => {
    const { emit } = setup(event);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "retry me" } });
    fireEvent.click(screen.getByTestId("final-submit"));
    expect(screen.getByTestId("final-submit")).toBeDisabled();
    act(() => useGameStore.getState().setPending(null));
    act(() => vi.advanceTimersByTime(1500));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("final-submit")).toBeEnabled();
    fireEvent.click(screen.getByTestId("final-submit"));
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it.each(["paused", "offline"])("does not auto-submit a near-deadline draft while %s", (mode) => {
    const { emit } = setup(event);
    act(() => {
      const current = useGameStore.getState().session!;
      useGameStore.setState({
        session: {
          ...current,
          state: { ...current.state, timer: timer(500), isPaused: mode === "paused" },
        },
        connection: mode === "offline" ? "reconnecting" : "connected",
      });
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hold" } });
    act(() => vi.advanceTimersByTime(2000));
    expect(emit).not.toHaveBeenCalled();
  });

  it("keeps text while paused, resumes the countdown and cancels it on unmount", () => {
    const { emit, unmount } = setup(event, true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "not sent yet" } });
    act(() => vi.advanceTimersByTime(5000));
    expect(emit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      const current = useGameStore.getState().session!;
      useGameStore.setState({
        session: { ...current, state: { ...current.state, timer: timer(2000), isPaused: false } },
      });
    });
    expect(screen.getByRole("textbox")).toHaveValue("not sent yet");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(3000));
    expect(emit).not.toHaveBeenCalled();
  });
});
