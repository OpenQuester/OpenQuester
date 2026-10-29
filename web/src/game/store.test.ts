import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALICE, BOB, question, round, session, snapshot, timer } from "./fixtures";
import type { ServerEvent } from "./protocol";
import { createGameStore, useGameStore } from "./store";

const showing = () =>
  session({
    currentRound: round(),
    questionState: "showing",
    currentQuestion: question(100),
    timer: timer(),
  });

it("keeps local preview state, secret selection and side effects separate from the live game", () => {
  const live = showing();
  useGameStore.setState({ session: live });
  const preview = createGameStore();
  const later = vi.spyOn(window, "setTimeout");
  const write = vi.spyOn(Storage.prototype, "setItem");
  preview.getState().begin("preview");
  preview.setState({ session: showing() });
  preview.getState().setSecretTarget("preview", BOB);
  preview.getState().toast("info", "local");
  preview.getState().markLeft("left");
  expect(useGameStore.getState().session).toBe(live);
  expect(useGameStore.getState().secretTarget.scope).not.toBe("preview");
  expect(later).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  later.mockRestore();
  write.mockRestore();
});

describe("pending command", () => {
  beforeEach(() => useGameStore.setState({ session: showing(), pending: null }));

  it.each(["question-answer", "answer-result", "next-round"])(
    "keeps %s waiting through chat and other players' readiness",
    (action) => {
      useGameStore.getState().setPending(action);
      const pending = useGameStore.getState().pending;
      const unrelated: ServerEvent[] = [
        {
          type: "chat-message",
          payload: { uuid: "m1", user: BOB, message: "hi", timestamp: new Date().toISOString() },
        },
        { type: "player-ready", payload: { playerId: BOB, isReady: true, readyPlayers: [BOB] } },
        { type: "player-unready", payload: { playerId: BOB, isReady: false, readyPlayers: [] } },
      ];
      for (const event of unrelated) {
        useGameStore.getState().dispatch(event);
        expect(useGameStore.getState().pending).toBe(pending);
      }
      expect(useGameStore.getState().session?.chat.at(-1)?.message).toBe("hi");
      expect(useGameStore.getState().session?.state.readyPlayers).toEqual([]);
    },
  );

  it("ends when the server answers the command", () => {
    useGameStore.getState().setPending("question-answer");

    useGameStore.getState().dispatch({
      type: "question-answer",
      payload: { userId: ALICE, timer: timer() },
    } as ServerEvent);

    expect(useGameStore.getState().pending).toBeNull();
  });

  it("ends on a ruling even when the phase has not changed yet", () => {
    useGameStore.setState({
      session: session({ questionState: "answering", answeringPlayer: ALICE }),
    });
    useGameStore.getState().setPending("answer-result");
    useGameStore.getState().dispatch({
      type: "answer-result",
      payload: {
        answerResult: { player: ALICE, answerType: "correct", result: 100, score: 100 },
        timer: null,
      },
    });
    expect(useGameStore.getState().session?.state.questionState).toBe("answering");
    expect(useGameStore.getState().pending).toBeNull();
  });

  it("ends when the next round arrives", () => {
    useGameStore.getState().setPending("next-round");
    useGameStore.getState().dispatch({
      type: "next-round",
      payload: {
        gameState: snapshot({ currentRound: { ...round(), id: 2 }, questionState: "choosing" })
          .gameState,
      },
    });
    expect(useGameStore.getState().session?.state.currentRound?.id).toBe(2);
    expect(useGameStore.getState().pending).toBeNull();
  });
});
