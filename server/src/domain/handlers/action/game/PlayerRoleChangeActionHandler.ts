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
import {
  PlayerRoleChangeBroadcastData,
  PlayerRoleChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player role change.
 */
export class PlayerRoleChangeActionHandler
  implements
    GameActionHandler<PlayerRoleChangeInputData, PlayerRoleChangeBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<PlayerRoleChangeInputData>
  ): Promise<GameActionHandlerResult<PlayerRoleChangeBroadcastData>> {
    const { payload, socketId } = action;

    const result = await this.socketIOGameService.changePlayerRole(
      socketId,
      payload.newRole,
      payload.playerId
    );

    const broadcastData: PlayerRoleChangeBroadcastData = {
      playerId: result.targetPlayer.meta.id,
      newRole: payload.newRole,
      players: result.players,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.PLAYER_ROLE_CHANGE,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      },
    ];

    return { success: true, data: broadcastData, broadcasts };
  }
}
