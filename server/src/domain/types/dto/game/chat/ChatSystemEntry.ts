/**
 * A chat line the server writes itself, such as a log of what the showman
 * did. Clients that know `action` show it translated from `params`; others
 * show the English `message` of the chat line.
 */
export interface ChatSystemEntry {
  /** What happened, e.g. "answer-result" or "player-kick" */
  action: string;
  /** Names, points and flags the line needs, resolved when it was written */
  params: Record<string, string | number | boolean | null>;
}
