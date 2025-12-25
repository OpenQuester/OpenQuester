import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";

export interface MediaDownloadResult {
  game: Game;
  playerId: number;
  allPlayersReady: boolean;
  timer: GameStateTimerDTO | null;
}

export interface MediaDownloadBuildResultInput {
  game: Game;
  playerId: number;
  allPlayersReady: boolean;
  timer: GameStateTimerDTO | null;
}

/**
 * Logic class for handling media download state during question flow.
 * Manages player download status and determines when all players are ready.
 */
export class MediaDownloadLogic {
  /**
   * Mark a player as having downloaded media.
   */
  public static markPlayerReady(player: Player): void {
    player.mediaDownloaded = true;
  }

  /**
   * Reset media download status for all players in a game.
   */
  public static resetAllPlayerStatus(game: Game): void {
    for (const player of game.players) {
      player.mediaDownloaded = false;
    }
  }

  /**
   * Force all active players to be marked as ready.
   * Used when media download times out.
   */
  public static forceAllPlayersReady(game: Game): void {
    const activePlayers = this.getActivePlayers(game);
    for (const player of activePlayers) {
      player.mediaDownloaded = true;
    }
  }

  /**
   * Get all active players (non-spectators currently in game).
   */
  public static getActivePlayers(game: Game): Player[] {
    return game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );
  }

  /**
   * Check if all active players have downloaded media.
   */
  public static areAllPlayersReady(game: Game): boolean {
    const activePlayers = this.getActivePlayers(game);
    return activePlayers.every((p) => p.mediaDownloaded);
  }

  /**
   * Build the result for media download handling.
   */
  public static buildResult(
    input: MediaDownloadBuildResultInput
  ): MediaDownloadResult {
    const { game, playerId, allPlayersReady, timer } = input;

    return {
      game,
      playerId,
      allPlayersReady,
      timer,
    };
  }
}
