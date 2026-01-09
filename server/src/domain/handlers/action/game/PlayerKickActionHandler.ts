import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  PlayerKickBroadcastData,
  PlayerKickInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { convertBroadcasts } from "domain/utils/BroadcastConverter";
import { createActionContextFromAction } from "domain/types/action/ActionContext";

/**
 * Stateless action handler for kicking a player.
 */
export class PlayerKickActionHandler
  implements GameActionHandler<PlayerKickInputData, PlayerKickBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<PlayerKickInputData>
  ): Promise<GameActionHandlerResult<PlayerKickBroadcastData>> {
    const result = await this.socketIOGameService.kickPlayer(
      createActionContextFromAction(action),
      action.payload.playerId
    );

    const broadcastData: PlayerKickBroadcastData = {
      playerId: action.payload.playerId,
    };

    // Service generates type-safe broadcasts with satisfies - just convert format
    const broadcasts = convertBroadcasts(result.broadcasts);

    return { success: true, data: broadcastData, broadcasts };
  }
}
