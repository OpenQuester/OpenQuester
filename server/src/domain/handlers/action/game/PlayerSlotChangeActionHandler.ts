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
      playerId: result.playerId,
      newSlot: result.newSlot,
      players: result.updatedPlayers,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.PLAYER_SLOT_CHANGE,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      },
    ];

    return { success: true, data: broadcastData, broadcasts };
  }
}
