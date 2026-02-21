import {
  GAME_EXPIRATION_WARNING_NAMESPACE,
  GAME_NAMESPACE,
} from "domain/constants/game";
import { TIMER_NSP } from "domain/constants/timer";
import { SOCKET_SESSION_PREFIX } from "./socket";

/**
 * Centralized Redis key construction for game action pipeline.
 *
 * Used by GameActionExecutor to build IN/OUT pipelines without
 * depending on repository internals.
 *
 * Key patterns:
 * - game:{gameId}                          — game hash
 * - game:package:{gameId}                  — package hash
 * - game:action:lock:{gameId}              — action lock
 * - game:action:queue:{gameId}             — action FIFO queue
 * - game-expiration-warning:{gameId}       — expiration warning key
 * - timer:{gameId}                         — active timer
 * - timer:{questionState}:{gameId}         — saved/paused timer
 */

const LOCK_KEY_PREFIX = "game:action:lock";
const QUEUE_KEY_PREFIX = "game:action:queue";
const PACKAGE_KEY_PREFIX = `${GAME_NAMESPACE}:package`;

export function gameKey(gameId: string): string {
  return `${GAME_NAMESPACE}:${gameId}`;
}

export function packageKey(gameId: string): string {
  return `${PACKAGE_KEY_PREFIX}:${gameId}`;
}

export function lockKey(gameId: string): string {
  return `${LOCK_KEY_PREFIX}:${gameId}`;
}

export function queueKey(gameId: string): string {
  return `${QUEUE_KEY_PREFIX}:${gameId}`;
}

export function expirationWarningKey(gameId: string): string {
  return `${GAME_EXPIRATION_WARNING_NAMESPACE}:${gameId}`;
}

export function timerKey(gameId: string, timerAdditional?: string): string {
  return timerAdditional
    ? `${TIMER_NSP}:${timerAdditional}:${gameId}`
    : `${TIMER_NSP}:${gameId}`;
}

export function sessionKey(socketId: string): string {
  return `${SOCKET_SESSION_PREFIX}:${socketId}`;
}
