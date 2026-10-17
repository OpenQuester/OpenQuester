import type { GameJoinData, Player, PlayerRole, Question, Round, Timer } from "./protocol";
import { sessionFromSnapshot, type GameSession } from "./reducer";

/** Builders for reducer/selector tests. Ids: showman 1, players 2 and 3, spectator 4. */
export const SHOWMAN = 1;
export const ALICE = 2;
export const BOB = 3;
export const SAM = 4;

export function player(id: number, role: PlayerRole, extra: Partial<Player> = {}): Player {
  return {
    meta: { id, username: `user${id}`, avatar: null },
    slot: role === "player" ? id - 2 : null,
    role,
    status: "in-game",
    restrictionData: { muted: false, restricted: false, banned: false },
    score: 0,
    ...extra,
  };
}

export const timer = (durationMs = 20_000): Timer => ({
  startedAt: new Date().toISOString(),
  durationMs,
  elapsedMs: 0,
  resumedAt: null,
});

export function round(type: "simple" | "final" = "simple"): Round {
  return {
    id: 1,
    order: 0,
    name: type === "final" ? "Final" : "Round 1",
    type,
    themes: [
      {
        id: 10,
        order: 0,
        name: "Capitals",
        questions: [
          { id: 100, order: 0, price: 100, isPlayed: false },
          { id: 101, order: 1, price: 200, isPlayed: false },
        ],
      },
      {
        id: 11,
        order: 1,
        name: "Science",
        questions: [{ id: 110, order: 0, price: 300, isPlayed: false }],
      },
    ],
  };
}

export function question(id = 100, extra: Partial<Question> = {}): Question {
  return {
    id,
    type: "simple",
    order: 0,
    price: 100,
    isHidden: false,
    text: "Q?",
    answerDelay: 0,
    ...extra,
  };
}

export function snapshot(
  extra: Partial<GameJoinData["gameState"]> = {},
  players?: Player[],
): GameJoinData {
  return {
    meta: { title: "Test game" },
    players: players ?? [
      player(SHOWMAN, "showman"),
      player(ALICE, "player"),
      player(BOB, "player"),
      player(SAM, "spectator"),
    ],
    chatMessages: [],
    gameState: {
      questionState: null,
      isPaused: false,
      currentRound: null,
      currentQuestion: null,
      answeringPlayer: null,
      answeredPlayers: null,
      readyPlayers: null,
      timer: null,
      skippedPlayers: null,
      ...extra,
    },
  };
}

export function session(
  extra: Partial<GameJoinData["gameState"]> = {},
  players?: Player[],
): GameSession {
  return sessionFromSnapshot("ABCD", snapshot(extra, players));
}

/** A started game in the choosing phase with Alice to pick. */
export function choosing(): GameSession {
  return session({ currentRound: round(), questionState: "choosing", currentTurnPlayerId: ALICE });
}
