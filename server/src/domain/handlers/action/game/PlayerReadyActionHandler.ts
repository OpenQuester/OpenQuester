import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
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
 * Stateless action handler for player ready state.
 */
export class PlayerReadyActionHandler
  implements GameActionHandler<EmptyInputData, PlayerReadinessBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<PlayerReadinessBroadcastData>> {
    const result = await this.socketIOGameService.setPlayerReadiness(
      action.socketId,
      true
    );

    const broadcasts: SocketEventBroadcast[] = [...result.broadcasts];

    // If auto-start should trigger, handle it and add start broadcasts
    if (result.data.shouldAutoStart) {
      const autoStartResult = await this.socketIOGameService.handleAutoStart(
        result.data.game.id
      );

      if (autoStartResult) {
        broadcasts.push(...autoStartResult.broadcasts);
      }
    }

    const readyData: PlayerReadinessBroadcastData = {
      playerId: result.data.playerId,
      isReady: result.data.isReady,
      readyPlayers: result.data.readyPlayers,
      autoStartTriggered: result.data.shouldAutoStart,
    };

    return { success: true, data: readyData, broadcasts };
  }
}
