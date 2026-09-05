import { describe, expect, it } from "vitest";

import {
  getRole,
  getTimerRemaining,
  reconcileBuzzer,
  useGameStore,
} from "./gameStore";
import {
  SERVER_EVENTS,
  type GameState,
  type JoinSnapshot,
  type Player,
} from "./contracts";

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

  const snapshotWith = (players: Player[], state = baseState) =>
    ({
      meta: { title: "Live game" },
      players,
      gameState: state,
      chatMessages: [],
    }) as JoinSnapshot;

  const player = (id: number, name = `P${id}`): Player =>
    ({
      meta: { id, username: name, avatar: null },
      role: "player",
      score: 0,
      status: "in-game",
      mediaDownloaded: false,
      restrictionData: { muted: false, restricted: false, banned: false },
      slot: id,
    }) as Player;

  it("subscribes to every event the generated contract declares", () => {
    // The hand-written list this replaced had drifted from the schema, which
    // is how kick, restrict, slot-change and skip stopped reaching the client.
    expect(SERVER_EVENTS).toContain("player-kicked");
    expect(SERVER_EVENTS).toContain("player-restricted");
    expect(SERVER_EVENTS).toContain("player-slot-change");
    expect(SERVER_EVENTS).toContain("question-skip");
    expect(SERVER_EVENTS).toContain("question-unskip");
    expect(SERVER_EVENTS).toContain("notifications");
  });

  it("records a skip so the buzzer can lock the player out", () => {
    useGameStore.getState().replaceSnapshot(snapshotWith([player(7)]));
    useGameStore.getState().applyEvent("question-skip", { playerId: 7 });
    expect(useGameStore.getState().gameState?.skippedPlayers).toEqual([7]);
    useGameStore.getState().applyEvent("question-unskip", { playerId: 7 });
    expect(useGameStore.getState().gameState?.skippedPlayers).toEqual([]);
  });

  it("removes a kicked player and tells the local user it was them", () => {
    useGameStore.getState().setSelfId(7);
    useGameStore.getState().replaceSnapshot(snapshotWith([player(7), player(8)]));
    useGameStore.getState().applyEvent("player-kicked", { playerId: 8 });
    expect(useGameStore.getState().players.map((p) => p.meta.id)).toEqual([7]);
    expect(useGameStore.getState().removedFromGame).toBeNull();

    useGameStore.getState().applyEvent("player-kicked", { playerId: 7 });
    expect(useGameStore.getState().removedFromGame).toBe("kicked");
  });

  it("applies mute state to the named player only", () => {
    useGameStore.getState().setSelfId(7);
    useGameStore.getState().replaceSnapshot(snapshotWith([player(7), player(8)]));
    useGameStore.getState().applyEvent("player-restricted", {
      playerId: 8,
      muted: true,
      restricted: false,
      banned: false,
    });
    const current = useGameStore.getState().players;
    expect(current[0]?.restrictionData?.muted).toBe(false);
    expect(current[1]?.restrictionData?.muted).toBe(true);
  });

  it("clears a pending action only on events that resolve it", () => {
    useGameStore.getState().replaceSnapshot(snapshotWith([player(7)]));
    useGameStore.getState().setPending("question-answer");
    // An unrelated broadcast must not unlock the button early.
    useGameStore.getState().applyEvent("question-guidance", {
      message: "Read the whole clue",
    });
    expect(useGameStore.getState().pendingAction).toBe("question-answer");

    useGameStore.getState().applyEvent("question-answer", {
      userId: 7,
      timer: null,
    });
    expect(useGameStore.getState().pendingAction).toBeNull();
  });

  it("caps retained chat history", () => {
    useGameStore.getState().replaceSnapshot(snapshotWith([player(7)]));
    for (let index = 0; index < 320; index += 1)
      useGameStore.getState().applyEvent("chat-message", {
        uuid: `m${index}`,
        user: 7,
        message: `msg ${index}`,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
    const { messages } = useGameStore.getState();
    expect(messages).toHaveLength(300);
    expect(messages.at(-1)?.message).toBe("msg 319");
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
