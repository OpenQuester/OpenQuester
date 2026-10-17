import { randomInt } from "crypto";

import { BUZZER_ACCEPT_WINDOW, BUZZER_FALSE_START_LOCK_TIME } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ButtonPressMode } from "domain/enums/game/GameSettings";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";

/**
 * Buzzer fairness rules (SIGame parity).
 *
 * - The buzzer opens at `gameState.buzzerOpensAtMs` on the SHOWING timer
 *   (always 0 when the game's `falseStart` setting is off). A press before
 *   that is a false start and locks the player out for
 *   {@link BUZZER_FALSE_START_LOCK_TIME}.
 * - With `buttonPressMode: random_within_window`, the first press in time
 *   opens an accept window of {@link BUZZER_ACCEPT_WINDOW}. Everyone who
 *   presses inside it takes part in a random draw, so a shorter network path
 *   does not decide who answers. With `first_wins` the first press answers.
 *
 * Only a real race uses these rules: when a player is already designated to
 * answer (secret/stake winners), their press answers straight away.
 */
export class BuzzerLogic {
  /** True when several players may compete for this press */
  public static isRace(game: Game): boolean {
    return game.gameState.answeringPlayer === null || game.gameState.answeringPlayer === undefined;
  }

  /** Has the SHOWING timer reached the moment the buzzer opens? */
  public static isOpen(game: Game, now: number = Date.now()): boolean {
    const opensAt = game.gameState.buzzerOpensAtMs ?? 0;
    const timer = game.gameState.timer;

    if (opensAt <= 0 || !timer) {
      return true;
    }

    return GamePauseLogic.calculateElapsedTime(timer, now) >= opensAt;
  }

  /** Epoch ms when the player's false-start lock ends, or null when not locked */
  public static lockedUntil(game: Game, playerId: number, now: number = Date.now()): number | null {
    const until = game.gameState.buzzerLocks?.[String(playerId)];

    return until && until > now ? until : null;
  }

  /** Locks the player out after a false start; returns when the lock ends */
  public static lockFalseStart(game: Game, playerId: number, now: number = Date.now()): number {
    const until = now + BUZZER_FALSE_START_LOCK_TIME;
    game.gameState.buzzerLocks = {
      ...this._activeLocks(game, now),
      [String(playerId)]: until
    };

    return until;
  }

  /**
   * Records a press inside the accept window. A press after the window has
   * closed is left out even when the timer that ends the window has not been
   * handled yet (a busy queue can deliver it late): the draw stays fair.
   * @returns true when this press opened the window
   */
  public static recordPress(game: Game, playerId: number, now: number = Date.now()): boolean {
    const window = game.gameState.buzzerWindow;

    if (!window) {
      game.gameState.buzzerWindow = { openedAt: now, presses: [playerId] };

      return true;
    }

    const windowClosed = now > window.openedAt + this.acceptWindowMs(game);
    if (!windowClosed && !window.presses.includes(playerId)) {
      window.presses.push(playerId);
    }

    return false;
  }

  /** Length of the accept window for this game; 0 when the first press wins */
  public static acceptWindowMs(game: Game): number {
    return game.settings.buttonPressMode === ButtonPressMode.RANDOM_WITHIN_WINDOW
      ? BUZZER_ACCEPT_WINDOW
      : 0;
  }

  /**
   * Picks the answering player from the window's presses, at random among
   * those still seated and in game. Clears the window.
   */
  public static drawWinner(
    game: Game,
    pick: (count: number) => number = (count) => randomInt(count)
  ): number | null {
    const presses = game.gameState.buzzerWindow?.presses ?? [];
    game.gameState.buzzerWindow = null;

    const candidates = presses.filter((id) => {
      const player = game.getPlayer(id, { fetchDisconnected: false });

      return (
        !!player &&
        player.role === PlayerRole.PLAYER &&
        player.gameStatus === PlayerGameStatus.IN_GAME &&
        game.isPlayerEligibleToAnswer(id)
      );
    });

    if (candidates.length === 0) {
      return null;
    }

    return candidates[pick(candidates.length)] ?? null;
  }

  private static _activeLocks(game: Game, now: number): Record<string, number> {
    return Object.fromEntries(
      Object.entries(game.gameState.buzzerLocks ?? {}).filter(([, until]) => until > now)
    );
  }
}
