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
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Element.prototype.animate = vi.fn(() => ({
    currentTime: 0,
    pause: vi.fn(),
    cancel: vi.fn(),
  })) as unknown as typeof Element.prototype.animate;
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
function mount(strict = false, serverReady?: boolean) {
  const store = createGameStore();
  store.setState({ gameId: "ABCD", connection: "connected", session: choosing() });
  const openingTimer = timer(1550);
  const pick = () =>
    store.getState().dispatch({
      type: "question-data",
      payload: {
        data: question(100, { textOrder: 0 }),
        timer: serverReady === undefined ? timer() : null,
        ...(serverReady === undefined
          ? {}
          : { questionTransition: { timer: openingTimer, mediaReady: serverReady } }),
      },
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
it.each([false, true])("keeps the full 200/800/250/300ms sequence (StrictMode: %s)", (strict) => {
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
  act(() => vi.advanceTimersByTime(800));
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
  expect(store.getState().questionPresentation?.complete).toBe(true);
});

it("delays its hint, preserves its identity through fade out and waits only 300ms after readiness", () => {
  const { ready } = mount();
  paint();
  paint();
  act(() => vi.advanceTimersByTime(1249));
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

it("keeps a later point image gated on its server offset, including answer freezes", () => {
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
  act(() => vi.advanceTimersByTime(130));
  expect(view.result.current).toBe(true);
  view.rerender({ ...current, content: { ...current.content!, timer: null, frozenAtMs: 950 } });
  expect(view.result.current).toBe(false);
});

it("follows the server's 1550ms opening while readiness alone keeps the media phase", () => {
  const { store } = mount(false, true);
  expect(screen.getByTestId("question-pick-transition")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1250));
  expect(screen.getByTestId("question-pick-transition")).toHaveAttribute("data-exiting");
  act(() => vi.advanceTimersByTime(299));
  expect(screen.getByTestId("question-pick-transition")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByTestId("question-pick-transition")).not.toBeInTheDocument();
  expect(store.getState().session?.state.questionState).toBe("media_downloading");
  act(() =>
    store.getState().dispatch({
      type: "media-download-status",
      payload: {
        playerId: -1,
        mediaDownloaded: true,
        allPlayersReady: true,
        timer: timer(),
        questionTransition: null,
      },
    }),
  );
  expect(store.getState().session?.state.questionState).toBe("showing");
});

it("waits for slow readiness, then uses the server's final 300ms fade", () => {
  const { store } = mount(false, false);
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByTestId("question-pick-waiting")).toBeInTheDocument();
  const opening = store.getState().session!.state.questionTransition!;
  act(() =>
    store.getState().dispatch({
      type: "media-download-status",
      payload: {
        playerId: ALICE,
        mediaDownloaded: true,
        allPlayersReady: true,
        timer: null,
        questionTransition: { timer: { ...opening.timer, durationMs: 2300 }, mediaReady: true },
      },
    }),
  );
  expect(store.getState().session?.state.questionState).toBe("media_downloading");
  expect(screen.getByTestId("question-pick-transition")).toHaveAttribute("data-exiting");
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByTestId("question-pick-transition")).not.toBeInTheDocument();
});

it("freezes and resumes the remaining server opening without replaying its intro", () => {
  const { store } = mount(false, true);
  act(() => vi.advanceTimersByTime(500));
  const opening = store.getState().session!.state.questionTransition!;
  const paused = { ...opening, timer: { ...opening.timer, elapsedMs: 500 } };
  act(() =>
    store.getState().dispatch({
      type: "game-pause",
      payload: {
        timer: null,
        questionTransition: paused,
      },
    }),
  );
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByTestId("question-pick-transition")).toBeInTheDocument();
  act(() =>
    store.getState().dispatch({
      type: "game-unpause",
      payload: {
        timer: null,
        questionTransition: {
          ...paused,
          timer: { ...paused.timer, resumedAt: new Date().toISOString() },
        },
      },
    }),
  );
  act(() => vi.advanceTimersByTime(1049));
  expect(screen.getByTestId("question-pick-transition")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByTestId("question-pick-transition")).not.toBeInTheDocument();
});
