import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameConnection } from "@/game/connection";
import { ALICE, BOB, question, round, session, SHOWMAN, timer } from "@/game/fixtures";
import { reduce } from "@/game/reducer";
import { useGameStore } from "@/game/store";
import { GameContext } from "../GameContext";
import { useHotkeys } from "./useHotkeys";
import { onPlaytestKey } from "@/features/package-editor/playtest/playtestKeyboard";
import type { PreviewRuntime } from "@/features/package-editor/playtest/previewRuntime";

function Hotkeys() {
  useHotkeys({ onChat: () => {}, onMenu: () => {} });
  return <div data-testid="focus" tabIndex={0} />;
}

const answering = (answerType: "text" | "number" = "number") =>
  session({
    currentRound: round(),
    currentQuestion: question(100, { answerType }),
    questionState: "answering",
    answeringPlayer: BOB,
    timer: timer(),
  });

describe("judge and buzzer shortcuts", () => {
  it("uses physical P across layouts and leaves typing, repeats, dialogs and pending actions alone", () => {
    const click = vi.fn();
    const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
    useGameStore.setState({ session: answering(), connection: "connected", pending: null });
    render(
      <GameContext.Provider value={{ connection, myId: ALICE }}>
        <Hotkeys />
        <button data-hotkey="pass" onClick={click}>
          Pass
        </button>
        <input aria-label="Answer" />
      </GameContext.Provider>,
    );
    fireEvent.keyDown(window, { code: "KeyP", key: "з" });
    expect(click).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { code: "KeyP", key: "p", repeat: true });
    fireEvent.keyDown(screen.getByRole("textbox"), { code: "KeyP", key: "з" });
    act(() => useGameStore.setState({ pending: { action: "question-skip", at: Date.now() } }));
    fireEvent.keyDown(window, { code: "KeyP", key: "з" });
    expect(click).toHaveBeenCalledTimes(1);
    act(() => useGameStore.setState({ pending: null }));
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    fireEvent.keyDown(window, { code: "KeyP", key: "з" });
    dialog.remove();
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("blocks live C/W for structured submissions but preserves oral judging, pause, and pending guards", () => {
    const emit = vi.fn();
    const connection = { emit, connected: true } as unknown as GameConnection;
    const state = answering();
    useGameStore.setState({ session: state, connection: "connected", pending: null });
    render(
      <GameContext.Provider value={{ connection, myId: SHOWMAN }}>
        <Hotkeys />
      </GameContext.Provider>,
    );
    fireEvent.keyDown(window, { key: "c" });
    fireEvent.keyDown(window, { key: "w" });
    expect(emit).not.toHaveBeenCalled();
    const submitted = reduce(state, { type: "answer-submitted", payload: { answerText: null } });
    act(() => useGameStore.setState({ session: submitted }));
    fireEvent.keyDown(window, { key: "c" });
    expect(emit).not.toHaveBeenCalled();
    act(() =>
      useGameStore.setState({
        session: reduce(state, { type: "answer-submitted", payload: { answerText: "42" } }),
      }),
    );
    fireEvent.keyDown(window, { key: "c" });
    fireEvent.keyDown(window, { key: "w" });
    expect(emit).not.toHaveBeenCalled();
    act(() =>
      useGameStore.setState({
        session: answering("text"),
        pending: { action: "answer-result", at: Date.now() },
      }),
    );
    fireEvent.keyDown(window, { key: "w" });
    expect(emit).not.toHaveBeenCalled();
    act(() =>
      useGameStore.setState({
        pending: null,
        session: { ...answering("text"), state: { ...answering("text").state, isPaused: true } },
      }),
    );
    fireEvent.keyDown(window, { key: "w" });
    expect(emit).not.toHaveBeenCalled();
    act(() => useGameStore.setState({ connection: "reconnecting", session: answering("text") }));
    fireEvent.keyDown(window, { key: "w" });
    expect(emit).not.toHaveBeenCalled();
    act(() => useGameStore.setState({ connection: "connected" }));
    act(() => useGameStore.setState({ session: answering("text") }));
    fireEvent.keyDown(window, { key: "w" });
    expect(emit).toHaveBeenLastCalledWith("answer-result", {
      scoreResult: -100,
      answerType: "wrong",
    });
  });

  it.each(["text", "point"] as const)(
    "blocks live shortcuts until %s question data arrives",
    (answerType) => {
      const emit = vi.fn();
      const connection = { emit, connected: true } as unknown as GameConnection;
      const state = session({
        currentRound: round(),
        currentQuestion: null,
        questionState: "answering",
        answeringPlayer: BOB,
        timer: timer(),
      });
      useGameStore.setState({ session: state, connection: "connected", pending: null });
      render(
        <GameContext.Provider value={{ connection, myId: SHOWMAN }}>
          <Hotkeys />
        </GameContext.Provider>,
      );
      fireEvent.keyDown(window, { key: "c" });
      expect(emit).not.toHaveBeenCalled();
      const received = reduce(state, {
        type: "question-data",
        payload: { data: question(100, { answerType }), timer: timer() },
      });
      act(() => useGameStore.setState({ session: received }));
      fireEvent.keyDown(window, { key: "c" });
      if (answerType === "text")
        expect(emit).toHaveBeenCalledWith("answer-result", {
          scoreResult: 100,
          answerType: "correct",
        });
      else expect(emit).not.toHaveBeenCalled();
    },
  );

  it.each(["text", "point"] as const)(
    "blocks preview shortcuts until %s question data arrives",
    (answerType) => {
      let state = session({
        currentRound: round(),
        currentQuestion: null,
        questionState: "answering",
        answeringPlayer: BOB,
        timer: timer(),
      });
      const emit = vi.fn();
      const game = {
        get session() {
          return state;
        },
        commands: { emit, connected: true },
      } as unknown as PreviewRuntime;
      render(
        <div
          data-testid="preview-focus"
          tabIndex={0}
          onKeyDown={(event) => onPlaytestKey(event, game, SHOWMAN)}
        />,
      );
      const target = screen.getByTestId("preview-focus");
      fireEvent.keyDown(target, { key: "w" });
      expect(emit).not.toHaveBeenCalled();
      state = reduce(state, {
        type: "question-data",
        payload: { data: question(100, { answerType }), timer: timer() },
      });
      fireEvent.keyDown(target, { key: "w" });
      if (answerType === "text")
        expect(emit).toHaveBeenCalledWith("answer-result", {
          scoreResult: -100,
          answerType: "wrong",
        });
      else expect(emit).not.toHaveBeenCalled();
    },
  );

  it("keeps the early Space press active for false-start handling", () => {
    const emit = vi.fn();
    const connection = { emit, connected: true } as unknown as GameConnection;
    useGameStore.setState({
      session: session({
        currentRound: round(),
        currentQuestion: question(100),
        questionState: "showing",
        timer: timer(),
        buzzerOpensAtMs: 10_000,
      }),
      connection: "connected",
      pending: null,
    });
    render(
      <GameContext.Provider value={{ connection, myId: ALICE }}>
        <Hotkeys />
      </GameContext.Provider>,
    );
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(emit).toHaveBeenCalledWith("question-answer");
  });

  it.each(["live", "preview"] as const)(
    "blocks stale option shortcuts in %s until question data arrives",
    (mode) => {
      let state = session({
        currentRound: round(),
        currentQuestion: null,
        questionState: "answering",
        answeringPlayer: ALICE,
        timer: timer(),
      });
      const click = vi.fn();
      const emit = vi.fn();
      const game = {
        get session() {
          return state;
        },
        commands: { emit, connected: true },
      } as unknown as PreviewRuntime;
      const connection = { emit, connected: true } as unknown as GameConnection;
      useGameStore.setState({ session: state, connection: "connected", pending: null });
      render(
        <GameContext.Provider value={{ connection, myId: ALICE }}>
          {mode === "live" && <Hotkeys />}
          <div
            data-testid="option-scope"
            tabIndex={0}
            onKeyDown={
              mode === "preview" ? (event) => onPlaytestKey(event, game, ALICE) : undefined
            }
          >
            <button data-option="1" onClick={click}>
              Option
            </button>
          </div>
        </GameContext.Provider>,
      );
      const button = screen.getByRole("button", { name: "Option" });
      vi.spyOn(button, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
      const target = mode === "live" ? window : screen.getByTestId("option-scope");
      fireEvent.keyDown(target, { key: "1" });
      expect(click).not.toHaveBeenCalled();
      state = reduce(state, {
        type: "question-data",
        payload: { data: question(100, { type: "choice" }), timer: timer() },
      });
      act(() => useGameStore.setState({ session: state }));
      fireEvent.keyDown(target, { key: "1" });
      expect(click).toHaveBeenCalledOnce();
    },
  );

  it("applies the same guard to preview shortcuts", () => {
    let state = answering();
    const emit = vi.fn();
    const game = {
      get session() {
        return state;
      },
      commands: { emit, connected: true },
    } as unknown as PreviewRuntime;
    render(
      <div
        data-testid="preview-focus"
        tabIndex={0}
        onKeyDown={(event) => onPlaytestKey(event, game, SHOWMAN)}
      />,
    );
    const target = screen.getByTestId("preview-focus");
    fireEvent.keyDown(target, { key: "c" });
    fireEvent.keyDown(target, { key: "w" });
    expect(emit).not.toHaveBeenCalled();
    state = reduce(state, { type: "answer-submitted", payload: { answerText: "invalid" } });
    fireEvent.keyDown(target, { key: "w" });
    expect(emit).not.toHaveBeenCalled();
  });
});
