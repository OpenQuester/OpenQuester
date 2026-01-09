import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  TurnPlayerChangeBroadcastData,
  TurnPlayerChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { createActionContextFromAction } from "domain/types/action/ActionContext";

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
    const { payload } = action;

    const result = await this.socketIOGameService.changeTurnPlayer(
      createActionContextFromAction(action),
      payload.newTurnPlayerId
    );

    const broadcastData: TurnPlayerChangeBroadcastData = {
      newTurnPlayerId: payload.newTurnPlayerId,
    };

    return {
      success: true,
      data: broadcastData,
      broadcasts: result.broadcasts,
    };
  }
}
