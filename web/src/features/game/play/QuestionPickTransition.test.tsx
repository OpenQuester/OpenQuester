import { StrictMode } from "react";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ALICE, choosing, question, snapshot, timer } from "@/game/fixtures";
import { createGameStore } from "@/game/store";
import { GameContext } from "../GameContext";
import { QuestionPickTransition } from "./QuestionPickTransition";
import { usePointImageReady } from "./question/useQuestionStage";

let frames: Map<number, FrameRequestCallback>;
let frameId: number;
beforeEach(() => {
  vi.useFakeTimers();
  frames = new Map();
  frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function paint() {
  act(() => {
    const current = [...frames.values()];
    frames.clear();
    current.forEach((callback) => callback(performance.now()));
  });
}
function mount(strict = false) {
  const store = createGameStore();
  store.setState({ gameId: "ABCD", connection: "connected", session: choosing() });
  const pick = () =>
    store.getState().dispatch({
      type: "question-data",
      payload: { data: question(100, { textOrder: 0 }), timer: timer() },
    });
  const ready = () =>
    store.getState().dispatch({
      type: "media-download-status",
      payload: { playerId: ALICE, mediaDownloaded: true, allPlayersReady: true, timer: timer() },
    });
  pick();
  const element = (
    <GameContext.Provider
      value={{ connection: { connected: true, emit: vi.fn() }, myId: ALICE, store }}
    >
      <QuestionPickTransition>
        <span data-testid="next-scene">Question</span>
      </QuestionPickTransition>
    </GameContext.Provider>
  );
  render(strict ? <StrictMode>{element}</StrictMode> : element);
  return { store, pick, ready };
}
it.each([false, true])("keeps the full 200/300/250/300ms sequence (StrictMode: %s)", (strict) => {
  const { store, ready } = mount(strict);
  const overlay = screen.getByTestId("question-pick-transition");
  expect(overlay).not.toHaveAttribute("data-started");
  expect(screen.getAllByTestId("board-cell").length).toBeGreaterThan(0);
  paint();
  expect(overlay).not.toHaveAttribute("data-started");
  paint();
  expect(overlay).toHaveAttribute("data-started");
  act(ready);
  act(() => vi.advanceTimersByTime(199));
  expect(screen.getAllByTestId("board-cell").length).toBeGreaterThan(0);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByTestId("board-cell")).toBeNull();
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByTestId("next-scene")).toBeNull();
  act(() => vi.advanceTimersByTime(249));
  expect(overlay).not.toHaveAttribute("data-exiting");
  act(() => vi.advanceTimersByTime(1));
  expect(overlay).toHaveAttribute("data-exiting");
  expect(screen.getByTestId("next-scene").parentElement).toHaveAttribute("inert");
  expect(screen.queryByTestId("question-pick-waiting")).toBeNull();
  act(() => vi.advanceTimersByTime(299));
  expect(store.getState().questionPresentation?.complete).toBe(false);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByTestId("question-pick-transition")).toBeNull();
  expect(screen.getByTestId("next-scene").parentElement).not.toHaveAttribute("inert");
  expect(store.getState().questionPresentation?.contentOffsetMs).toBe(1050);
});

it("delays its hint, preserves its identity through fade out and waits only 300ms after readiness", () => {
  const { ready } = mount();
  paint();
  paint();
  act(() => vi.advanceTimersByTime(749));
  expect(screen.queryByTestId("question-pick-waiting")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  const hint = screen.getByTestId("question-pick-waiting");
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.queryByTestId("next-scene")).toBeNull();
  act(ready);
  expect(screen.getByTestId("question-pick-waiting")).toBe(hint);
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByTestId("question-pick-transition")).toBeNull();
});

it("remounts a repeated pick even when reset and the next pick are batched", () => {
  const { store, pick } = mount();
  paint();
  paint();
  act(() => vi.advanceTimersByTime(500));
  const first = screen.getByTestId("question-pick-transition");
  act(() => {
    store.getState().setSession(choosing());
    pick();
  });
  const second = screen.getByTestId("question-pick-transition");
  expect(second).not.toBe(first);
  expect(second).not.toHaveAttribute("data-started");
  paint();
  paint();
  act(() => vi.advanceTimersByTime(100));
  expect(second).not.toHaveAttribute("data-exiting");
});

it("cancels callbacks when a snapshot replaces an unfinished opening", () => {
  const { store } = mount();
  paint();
  paint();
  act(() => store.getState().dispatch({ type: "game-data", payload: snapshot() }));
  act(() => vi.advanceTimersByTime(3000));
  expect(store.getState().questionPresentation).toBeNull();
  expect(screen.queryByTestId("question-pick-transition")).toBeNull();
});

it("keeps a later point image gated on the shifted clock, including answer freezes", () => {
  const store = createGameStore();
  store.setState({ session: choosing(), connection: "connected" });
  store.getState().dispatch({
    type: "question-data",
    payload: {
      data: question(100, {
        textOrder: 0,
        answerType: "point",
        questionFiles: [
          {
            order: 1,
            displayTime: 3000,
            file: { type: "image", md5: "point", link: "https://media.test/point.png" },
          },
        ],
      }),
      timer: timer(),
    },
  });
  store.getState().dispatch({
    type: "media-download-status",
    payload: {
      playerId: ALICE,
      mediaDownloaded: true,
      allPlayersReady: true,
      timer: timer(),
      contentPlan: {
        totalMs: 4000,
        steps: [
          {
            startMs: 0,
            durationMs: 1000,
            items: [{ kind: "text", order: 0, durationMs: 1000, placement: "screen" }],
          },
          {
            startMs: 1000,
            durationMs: 3000,
            items: [{ kind: "file", order: 1, durationMs: 3000, placement: "screen" }],
          },
        ],
      },
    },
  });
  vi.advanceTimersByTime(900);
  store.getState().finishQuestionOpening(store.getState().questionPresentation!.id);
  vi.advanceTimersByTime(500);
  const current = store.getState().session!;
  const view = renderHook((session) => usePointImageReady(session), {
    initialProps: current,
    wrapper: ({ children }) => (
      <GameContext.Provider
        value={{ connection: { connected: true, emit: vi.fn() }, myId: ALICE, store }}
      >
        {children}
      </GameContext.Provider>
    ),
  });
  expect(view.result.current).toBe(false);
  act(() => vi.advanceTimersByTime(530));
  expect(view.result.current).toBe(true);
  view.rerender({ ...current, content: { ...current.content!, timer: null, frozenAtMs: 1500 } });
  expect(view.result.current).toBe(false);
});
