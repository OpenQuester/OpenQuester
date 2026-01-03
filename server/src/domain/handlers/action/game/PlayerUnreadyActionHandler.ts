import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  PlayerReadinessBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player unready state.
 */
export class PlayerUnreadyActionHandler
  implements GameActionHandler<EmptyInputData, PlayerReadinessBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<PlayerReadinessBroadcastData>> {
    const result = await this.socketIOGameService.setPlayerReadiness(
      action.socketId,
      false
    );

    const readyData: PlayerReadinessBroadcastData = {
      playerId: result.data.playerId,
      isReady: result.data.isReady,
      readyPlayers: result.data.readyPlayers,
      autoStartTriggered: false,
    };

    return { success: true, data: readyData, broadcasts: result.broadcasts };
  }
}
