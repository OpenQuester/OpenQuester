import { SYSTEM_PLAYER_ID } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

/**
 * Validation result for media download player leave
 */
export interface MediaDownloadPlayerLeaveValidation {
  isEligible: boolean;
  reason?: string;
}

/**
 * Result of checking if all remaining players are ready
 */
export interface MediaDownloadCompletionResult {
  allPlayersReady: boolean;
  activePlayerCount: number;
}

/**
 * Result of media download player leave operation
 */
export interface MediaDownloadPlayerLeaveResult {
  broadcasts: BroadcastEvent[];
  shouldTransitionToShowing: boolean;
}

export interface MediaDownloadPlayerLeaveResultInput {
  game: Game;
  timer: GameStateTimerDTO | null;
  leftUserId: number;
}

/**
 * Pure business logic for handling player leaving during media download phase.
 *
 * When a player leaves during media download:
 * 1. Check if all remaining active players have downloaded
 * 2. If so, transition to SHOWING state
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class MediaDownloadPlayerLeaveLogic {
  /**
   * Validates if media download player leave logic should be applied.
   *
   * Conditions:
   * - Game must be in MEDIA_DOWNLOADING state
   */
  public static validate(game: Game): MediaDownloadPlayerLeaveValidation {
    if (game.gameState.questionState !== QuestionState.MEDIA_DOWNLOADING) {
      return { isEligible: false, reason: "Not in media downloading state" };
    }

    return { isEligible: true };
  }

  /**
   * Check if all remaining active players have downloaded media.
   *
   * Note: Called AFTER player is removed from game, so we check
   * current active players (excluding the leaving player).
   */
  public static checkAllPlayersReady(
    game: Game,
    excludeUserId: number
  ): MediaDownloadCompletionResult {
    const activePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME &&
        p.meta.id !== excludeUserId
    );

    const allPlayersReady =
      activePlayers.every((p) => p.mediaDownloaded) && activePlayers.length > 0;

    return {
      allPlayersReady,
      activePlayerCount: activePlayers.length,
    };
  }

  /**
   * Builds result for media download player leave.
   */
  public static buildResult(
    input: MediaDownloadPlayerLeaveResultInput
  ): MediaDownloadPlayerLeaveResult {
    const completionResult = this.checkAllPlayersReady(
      input.game,
      input.leftUserId
    );

    const { game, timer } = input;
    const broadcasts: BroadcastEvent[] = [];

    if (!completionResult.allPlayersReady) {
      return { broadcasts, shouldTransitionToShowing: false };
    }

    broadcasts.push({
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      data: {
        playerId: SYSTEM_PLAYER_ID,
        mediaDownloaded: true,
        allPlayersReady: true,
        timer,
      } satisfies MediaDownloadStatusBroadcastData,
      room: game.id,
    });

    return {
      broadcasts,
      shouldTransitionToShowing: true,
    };
  }
}
