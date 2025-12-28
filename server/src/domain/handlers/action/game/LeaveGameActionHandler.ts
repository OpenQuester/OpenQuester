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
  EmptyInputData,
  GameLeaveBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player leaving a game.
 * Socket-specific operations (room leave, notifications) handled in socket handler's afterBroadcast.
 */
export class LeaveGameActionHandler
  implements GameActionHandler<EmptyInputData, GameLeaveBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<GameLeaveBroadcastData>> {
    const result = await this.socketIOGameService.leaveLobby(action.socketId);

    if (!result.emit || !result.data) {
      return {
        success: true,
        data: { user: -1 },
        broadcasts: [],
      };
    }

    const broadcastData: GameLeaveBroadcastData = {
      user: result.data.userId,
    };

    // Convert service broadcasts
    const broadcasts: SocketEventBroadcast<unknown>[] = (
      result.broadcasts || []
    ).map((b) => ({
      event: b.event,
      data: b.data,
      target: SocketBroadcastTarget.GAME,
      gameId: b.room,
    }));

    return { success: true, data: broadcastData, broadcasts };
  }
}
