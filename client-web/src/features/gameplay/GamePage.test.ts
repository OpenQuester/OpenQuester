import { describe, expect, it } from "vitest";

import type { GameState } from "../../shared/realtime/contracts";
import { derivePhase } from "./GamePage";

describe("game phase selector", () => {
  const state = {
    isPaused: false,
    currentRound: {
      id: 1,
      name: "Round",
      order: 0,
      type: "simple",
      themes: [],
    },
    currentQuestion: null,
    questionState: "choosing",
  } as GameState;

  it("prioritizes finished, pause, and final server states", () => {
    expect(derivePhase(state, true)).toBe("finished");
    expect(derivePhase({ ...state, isPaused: true })).toBe("pause");
    expect(
      derivePhase({
        ...state,
        finalRoundData: {
          phase: "bidding",
          turnOrder: [],
          bids: {},
          answers: [],
          eliminatedThemes: [],
          questionData: null,
        },
      }),
    ).toBe("final");
  });

  it("uses the authoritative question state", () => {
    expect(derivePhase(state)).toBe("choosing");
    expect(
      derivePhase({
        ...state,
        currentQuestion: {
          id: 3,
          order: 0,
          price: 100,
          type: "simple",
          isHidden: false,
          answerDelay: 4000,
          showAnswerDuration: 5000,
        },
        questionState: "answering",
      }),
    ).toBe("buzzer");
  });
});
