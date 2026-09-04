import { describe, expect, it } from "vitest";

import {
  getRole,
  getTimerRemaining,
  reconcileBuzzer,
  useGameStore,
} from "./gameStore";
import type { GameState, JoinSnapshot } from "./contracts";

describe("server timer derivation", () => {
  it("derives remaining duration from the authoritative timestamp", () => {
    expect(
      getTimerRemaining(
        {
          startedAt: "2026-01-01T00:00:00.000Z",
          durationMs: 30_000,
          elapsedMs: 0,
        },
        Date.parse("2026-01-01T00:00:10.000Z"),
      ),
    ).toBe(20_000);
  });

  it("never returns a negative duration", () => {
    expect(
      getTimerRemaining(
        {
          startedAt: "2026-01-01T00:00:00.000Z",
          durationMs: 1_000,
          elapsedMs: 0,
        },
        Date.parse("2026-01-01T00:00:10.000Z"),
      ),
    ).toBe(0);
  });
});

describe("authoritative game state", () => {
  const baseState: GameState = {
    isPaused: false,
    questionState: "answering",
    currentRound: null,
    currentQuestion: null,
    answeringPlayer: null,
    answeredPlayers: null,
    skippedPlayers: null,
    readyPlayers: null,
    timer: null,
  };

  it("replaces a reconnect snapshot and applies granular events", () => {
    const snapshot = {
      meta: { title: "Live game" },
      players: [],
      gameState: baseState,
      chatMessages: [],
    } as JoinSnapshot;
    useGameStore.getState().replaceSnapshot(snapshot);
    useGameStore.getState().applyEvent("score-changed", {
      playerId: 7,
      newScore: 100,
    });
    expect(useGameStore.getState().title).toBe("Live game");
  });

  it("selects roles and reconciles every non-ready buzzer reason", () => {
    const players = [
      { meta: { id: 7, username: "Player" }, role: "player" },
    ] as Parameters<typeof getRole>[0];
    expect(getRole(players, 7)).toBe("player");
    expect(
      reconcileBuzzer({
        current: "ready",
        role: "spectator",
        userId: 7,
        phase: "buzzer",
        state: baseState,
      }),
    ).toBe("spectator");
    expect(
      reconcileBuzzer({
        current: "ready",
        role: "player",
        userId: 7,
        phase: "buzzer",
        state: { ...baseState, skippedPlayers: [7] },
      }),
    ).toBe("skipped");
    expect(
      reconcileBuzzer({
        current: "ready",
        role: "player",
        userId: 7,
        phase: "buzzer",
        state: { ...baseState, answeringPlayer: 8 },
      }),
    ).toBe("missed");
    expect(
      reconcileBuzzer({
        current: "pending",
        role: "player",
        userId: 7,
        phase: "buzzer",
        state: baseState,
      }),
    ).toBe("pending");
  });
});
