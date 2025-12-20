import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
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
  PlayerKickBroadcastData,
  PlayerKickInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

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
      action.socketId,
      action.payload.playerId
    );

    const broadcastData: PlayerKickBroadcastData = {
      playerId: action.payload.playerId,
    };

    // Convert service broadcasts
    const broadcasts: SocketEventBroadcast<unknown>[] = result.broadcasts.map(
      (b) => ({
        event: b.event,
        data: b.data,
        target: SocketBroadcastTarget.GAME,
        gameId: b.room,
      })
    );

    return { success: true, data: broadcastData, broadcasts };
  }
}
