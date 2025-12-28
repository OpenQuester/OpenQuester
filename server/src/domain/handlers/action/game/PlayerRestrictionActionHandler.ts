import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import {
  PlayerRestrictionBroadcastData,
  PlayerRestrictionInputData,
  PlayerRoleChangeBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player restriction (mute/restrict/ban).
 */
export class PlayerRestrictionActionHandler
  implements
    GameActionHandler<
      PlayerRestrictionInputData,
      PlayerRestrictionBroadcastData
    >
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<PlayerRestrictionInputData>
  ): Promise<GameActionHandlerResult<PlayerRestrictionBroadcastData>> {
    const { payload, socketId } = action;

    const result = await this.socketIOGameService.updatePlayerRestrictions(
      socketId,
      payload.playerId,
      {
        muted: payload.muted,
        restricted: payload.restricted,
        banned: payload.banned,
      }
    );

    const broadcastData: PlayerRestrictionBroadcastData = {
      playerId: payload.playerId,
      muted: payload.muted,
      restricted: payload.restricted,
      banned: payload.banned,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.PLAYER_RESTRICTED,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      },
    ];

    // If player was banned (removed), emit LEAVE event
    if (result.wasRemoved) {
      broadcasts.push({
        event: SocketIOGameEvents.LEAVE,
        data: { user: payload.playerId } satisfies GameLeaveEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      });
    }

    // If role was changed due to restriction, emit role change event
    if (result.newRole) {
      const roleChangeBroadcastData: PlayerRoleChangeBroadcastData = {
        playerId: payload.playerId,
        newRole: result.newRole,
        players: result.game.players.map((p) => p.toDTO()),
      };

      broadcasts.push({
        event: SocketIOGameEvents.PLAYER_ROLE_CHANGE,
        data: roleChangeBroadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      });
    }

    // Add game state cleanup broadcasts
    if (result.gameStateCleanupBroadcasts) {
      for (const broadcast of result.gameStateCleanupBroadcasts) {
        broadcasts.push({
          event: broadcast.event,
          data: broadcast.data,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
          useRoleBasedBroadcast: broadcast.roleFilter,
        });
      }
    }

    return { success: true, data: broadcastData, broadcasts };
  }
}
