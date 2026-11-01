import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ALICE, BOB, player, round, session } from "@/game/fixtures";

import {
  gamePresence,
  PRESENCE_DEBOUNCE_MS,
  reportPresence,
  resetPresenceForTests,
  setPresenceSink,
} from "./presence";

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  resetPresenceForTests();
  vi.useRealTimers();
});

describe("gamePresence", () => {
  it("names the game, the round and the seats", () => {
    const s = session({ currentRound: round() });
    s.players = [player(BOB, "player"), player(ALICE, "player")];

    const presence = gamePresence(s, { maxPlayers: 8, startedAt: "2026-10-18T20:00:00Z" }, t);

    expect(presence.details).toBe(s.title);
    expect(presence.state).toBe(`discordActivity.presence.round {"round":"${round().name}"}`);
    expect(presence.party).toEqual({ id: s.gameId, size: [2, 8] });
    expect(presence.startedAt).toBe(Date.parse("2026-10-18T20:00:00Z"));
  });

  it("says lobby before the first round and paused while paused", () => {
    expect(gamePresence(session({ currentRound: null }), null, t).state).toBe(
      "discordActivity.presence.lobby",
    );
    expect(gamePresence(session({ currentRound: round(), isPaused: true }), null, t).state).toBe(
      "discordActivity.presence.paused",
    );
  });
});

describe("reportPresence", () => {
  it("sends only the latest status, once, after a quiet moment", async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    setPresenceSink(sink);

    reportPresence({ details: "Game", state: "Round 1" });
    reportPresence({ details: "Game", state: "Round 2" });
    await vi.advanceTimersByTimeAsync(PRESENCE_DEBOUNCE_MS);
    reportPresence({ details: "Game", state: "Round 2" });
    await vi.advanceTimersByTimeAsync(PRESENCE_DEBOUNCE_MS);

    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith({ details: "Game", state: "Round 2" });
  });

  it("holds a status until Discord is connected", async () => {
    reportPresence({ details: "Game", state: "In the lobby" });
    await vi.advanceTimersByTimeAsync(PRESENCE_DEBOUNCE_MS);
    const sink = vi.fn().mockResolvedValue(undefined);

    setPresenceSink(sink);
    await vi.advanceTimersByTimeAsync(PRESENCE_DEBOUNCE_MS);

    expect(sink).toHaveBeenCalledWith({ details: "Game", state: "In the lobby" });
  });
});
