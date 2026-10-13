import type { PlayerRole } from "@/game/protocol";

/**
 * How the next visit to /games/:id should join. Kept in memory (not in the
 * URL) so a game password never lands in browser history.
 */
interface JoinIntent {
  role: PlayerRole;
  password?: string | null;
}

const intents = new Map<string, JoinIntent>();

export function setJoinIntent(gameId: string, intent: JoinIntent): void {
  intents.set(gameId.toUpperCase(), intent);
}

export function takeJoinIntent(gameId: string): JoinIntent | undefined {
  const key = gameId.toUpperCase();
  const intent = intents.get(key);
  intents.delete(key);
  return intent;
}
