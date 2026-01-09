import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  PlayerRoleChangeBroadcastData,
  PlayerRoleChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { createActionContextFromAction } from "domain/types/action/ActionContext";

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
    const { payload } = action;

    const result = await this.socketIOGameService.changePlayerRole(
      createActionContextFromAction(action),
      payload.newRole,
      payload.playerId
    );

    const broadcastData: PlayerRoleChangeBroadcastData = {
      playerId: result.data.targetPlayer.meta.id,
      newRole: payload.newRole,
      players: result.data.players,
    };

    return {
      success: true,
      data: broadcastData,
      broadcasts: result.broadcasts,
    };
  }
}
