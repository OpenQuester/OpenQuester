import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  GameLeaveBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { convertBroadcasts } from "domain/utils/BroadcastConverter";

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

    // Service generates type-safe broadcasts with satisfies - just convert format
    const broadcasts = convertBroadcasts(result.broadcasts || []);

    return { success: true, data: broadcastData, broadcasts };
  }
}
