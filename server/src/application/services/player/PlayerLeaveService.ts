import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  BroadcastEvent,
  ServiceResult,
} from "domain/types/service/ServiceResult";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";

/**
 * Reason for player leaving the game
 */
export enum PlayerLeaveReason {
  DISCONNECT = "disconnect",
  LEAVE = "leave",
  KICK = "kick",
  BAN = "ban",
}

/**
 * Options for player leave operation
 */
export interface PlayerLeaveOptions {
  reason: PlayerLeaveReason;
  kickedBy?: number;
  bannedBy?: number;
  cleanupSession?: boolean;
  targetUserId?: number;
}

/**
 * Result from player leave operation
 */
export interface PlayerLeaveResult extends ServiceResult {
  game: Game;
  userId: number;
  wasInGame: boolean;
  shouldEmitLeave: boolean;
}

/**
 * Service consolidating all player leave logic
 * Handles: disconnect, voluntary leave, kick, and ban
 */
export class PlayerLeaveService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Handle player leaving the game
   * Game-level locking handled by action executor
   */
  public async handlePlayerLeave(
    socketId: string,
    options: PlayerLeaveOptions
  ): Promise<PlayerLeaveResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const gameId = game.id;
    const userId = options.targetUserId ?? context.userSession.id;

    return await this.executePlayerLeave(
      game,
      gameId,
      socketId,
      userId,
      options
    );
  }

  private async executePlayerLeave(
    game: Game,
    gameId: string,
    socketId: string,
    userId: number,
    options: PlayerLeaveOptions
  ): Promise<PlayerLeaveResult> {
    // Check if player is still in the game
    if (!game.hasPlayer(userId)) {
      return {
        success: false,
        wasInGame: false,
        game,
        userId,
        shouldEmitLeave: false,
        broadcasts: [],
      };
    }

    const targetPlayer = game.getPlayer(userId, { fetchDisconnected: true });
    const wasPlayer = targetPlayer?.role === PlayerRole.PLAYER;

    // Remove player from game
    game.removePlayer(userId);

    // Remove from ready list
    if (game.gameState.readyPlayers) {
      game.gameState.readyPlayers = game.gameState.readyPlayers.filter(
        (playerId) => playerId !== userId
      );
    }

    // Update socket session
    if (options.cleanupSession !== false) {
      await this.socketUserDataService.update(socketId, {
        id: JSON.stringify(userId),
        gameId: JSON.stringify(null),
      });
    }

    await this.gameService.updateGame(game);

    // End player session to collect statistics if they were a player
    if (wasPlayer) {
      await this.playerGameStatsService.endPlayerSession(
        gameId,
        userId,
        new Date()
      );
    }

    // Build broadcasts based on reason
    const broadcasts = this.buildBroadcasts(gameId, userId, options);

    return {
      success: true,
      wasInGame: true,
      game,
      userId,
      shouldEmitLeave: true,
      broadcasts,
    };
  }

  private buildBroadcasts(
    gameId: string,
    userId: number,
    options: PlayerLeaveOptions
  ): BroadcastEvent[] {
    const broadcasts: BroadcastEvent[] = [];

    switch (options.reason) {
      case PlayerLeaveReason.KICK:
        broadcasts.push({
          event: SocketIOGameEvents.PLAYER_KICKED,
          data: { playerId: userId },
          room: gameId,
        });
        broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: userId },
          room: gameId,
        });
        break;

      case PlayerLeaveReason.BAN:
        // Ban restriction event is handled by PlayerRestrictionEventHandler
        // We only emit LEAVE here
        broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: userId },
          room: gameId,
        });
        break;

      case PlayerLeaveReason.LEAVE:
      case PlayerLeaveReason.DISCONNECT:
        broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: userId },
          room: gameId,
        });
        break;
    }

    return broadcasts;
  }
}
