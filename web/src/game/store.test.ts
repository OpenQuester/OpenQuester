import { beforeEach, describe, expect, it } from "vitest";

import { ALICE, question, round, session, timer } from "./fixtures";
import type { ServerEvent } from "./protocol";
import { useGameStore } from "./store";

const showing = () =>
  session({
    currentRound: round(),
    questionState: "showing",
    currentQuestion: question(100),
    timer: timer(),
  });

describe("pending command", () => {
  beforeEach(() => useGameStore.setState({ session: showing(), pending: null }));

  it("keeps waiting through an unrelated chat message", () => {
    useGameStore.getState().setPending("question-answer");

    useGameStore.getState().dispatch({
      type: "chat-message",
      payload: { uuid: "m1", user: ALICE, message: "hi", timestamp: new Date().toISOString() },
    } as ServerEvent);

    expect(useGameStore.getState().pending?.action).toBe("question-answer");
  });

  it("ends when the server answers the command", () => {
    useGameStore.getState().setPending("question-answer");

    useGameStore.getState().dispatch({
      type: "question-answer",
      payload: { userId: ALICE, timer: timer() },
    } as ServerEvent);

    expect(useGameStore.getState().pending).toBeNull();
  });
});
