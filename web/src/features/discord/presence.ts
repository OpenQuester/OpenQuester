import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { GameSession } from "@/game/reducer";

import { isDiscordActivity } from "./launch";

/** What the Activity shows under each player's name in Discord. */
export interface Presence {
  details: string;
  state: string;
  /** Seated players and seats, shown as "(2 of 8)" */
  party?: { id: string; size: [number, number] };
  /** Epoch ms the game started; Discord shows the time played */
  startedAt?: number;
}

/** What the games list knows that the live session doesn't */
export interface GameListing {
  maxPlayers?: number | null;
  startedAt?: string | null;
}

type PresenceSink = (presence: Presence) => Promise<unknown>;

/** Discord limits how often an Activity may change its status. */
export const PRESENCE_DEBOUNCE_MS = 2000;

let sink: PresenceSink | null = null;
let latest: Presence | null = null;
let sent = "";
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Set by the Activity once Discord accepted it (activity.ts), so the website
 * and the game screen never load the SDK just to report a status.
 */
export function setPresenceSink(next: PresenceSink | null): void {
  sink = next;
  if (sink && latest) schedule();
}

/** Reports what the player is doing; repeats and bursts are folded together. */
export function reportPresence(presence: Presence): void {
  latest = presence;
  schedule();
}

function schedule(): void {
  clearTimeout(timer);
  timer = setTimeout(flush, PRESENCE_DEBOUNCE_MS);
}

function flush(): void {
  if (!sink || !latest) return;
  const key = JSON.stringify(latest);
  if (key === sent) return;
  sent = key;
  void sink(latest).catch((error: unknown) => {
    sent = "";
    console.warn("[OpenQuester Activity] presence", error);
  });
}

/** The game's status line: title, what is happening, seats and time played. */
export function gamePresence(
  session: GameSession,
  listing: GameListing | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): Presence {
  const s = session.state;
  const seated = session.players.filter(
    (p) => p.role === "player" && p.status !== "disconnected",
  ).length;
  let state: string;
  if (session.finished) state = t("discordActivity.presence.finished");
  else if (!s.currentRound) state = t("discordActivity.presence.lobby");
  else if (s.isPaused) state = t("discordActivity.presence.paused");
  else state = t("discordActivity.presence.round", { round: s.currentRound.name });
  // Discord shows a party only with at least one member and room for them
  const size = Math.max(seated, 1);
  return {
    details: session.title,
    state,
    party: { id: session.gameId, size: [size, Math.max(listing?.maxPlayers ?? size, size)] },
    startedAt: listing?.startedAt ? Date.parse(listing.startedAt) : undefined,
  };
}

/** Inside the Activity, keeps Discord's status in step with the game. */
export function useGamePresence(session: GameSession | null, listing: GameListing | null): void {
  const { t } = useTranslation();
  const maxPlayers = listing?.maxPlayers ?? null;
  const startedAt = listing?.startedAt ?? null;
  useEffect(() => {
    if (!session || !isDiscordActivity()) return;
    reportPresence(gamePresence(session, { maxPlayers, startedAt }, t));
  }, [session, maxPlayers, startedAt, t]);
}

/** Tests only. */
export function resetPresenceForTests(): void {
  clearTimeout(timer);
  sink = null;
  latest = null;
  sent = "";
}
