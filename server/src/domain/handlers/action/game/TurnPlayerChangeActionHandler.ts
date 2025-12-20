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
  TurnPlayerChangeBroadcastData,
  TurnPlayerChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for turn player change.
 */
export class TurnPlayerChangeActionHandler
  implements
    GameActionHandler<TurnPlayerChangeInputData, TurnPlayerChangeBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<TurnPlayerChangeInputData>
  ): Promise<GameActionHandlerResult<TurnPlayerChangeBroadcastData>> {
    const { payload, socketId } = action;

    const result = await this.socketIOGameService.changeTurnPlayer(
      socketId,
      payload.newTurnPlayerId
    );

    const broadcastData: TurnPlayerChangeBroadcastData = {
      newTurnPlayerId: payload.newTurnPlayerId,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.TURN_PLAYER_CHANGED,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      },
    ];

    return { success: true, data: broadcastData, broadcasts };
  }
}
