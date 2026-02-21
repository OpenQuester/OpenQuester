import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  GameLeaveBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { DataMutationConverter } from "../../../types/action/DataMutation";

/**
 * Stateless action handler for player leaving a game.
 * Socket-specific operations (room leave, notifications) handled in socket handler's afterBroadcast.
 */
export class LeaveGameActionHandler
  implements GameActionHandler<EmptyInputData, GameLeaveBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameLeaveBroadcastData>> {
    const result = await this.socketIOGameService.leaveLobby(
      ctx.action.socketId,
      ctx.userData,
      ctx.game
    );

    if (!result.emit || !result.data) {
      return {
        success: true,
        data: { user: -1 },
        mutations: [],
      };
    }

    const broadcastData: GameLeaveBroadcastData = {
      user: result.data.userId,
    };

    return {
      success: true,
      data: broadcastData,
      mutations: [
        ...DataMutationConverter.mutationFromServiceBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: result.data.game,
    };
  }
}
