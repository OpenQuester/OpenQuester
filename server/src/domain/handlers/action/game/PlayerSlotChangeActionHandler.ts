import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  PlayerSlotChangeBroadcastData,
  PlayerSlotChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player slot change.
 */
export class PlayerSlotChangeActionHandler
  implements
    GameActionHandler<PlayerSlotChangeInputData, PlayerSlotChangeBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<PlayerSlotChangeInputData>
  ): Promise<GameActionHandlerResult<PlayerSlotChangeBroadcastData>> {
    const { payload, socketId } = action;

    const result = await this.socketIOGameService.changePlayerSlot(
      socketId,
      payload.targetSlot,
      payload.playerId
    );

    const broadcastData: PlayerSlotChangeBroadcastData = {
      playerId: result.data.playerId,
      newSlot: result.data.newSlot,
      players: result.data.updatedPlayers,
    };

    return { success: true, data: broadcastData, broadcasts: result.broadcasts };
  }
}
