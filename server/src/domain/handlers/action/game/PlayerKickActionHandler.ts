import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
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
    ctx: ActionExecutionContext<PlayerKickInputData>
  ): Promise<ActionHandlerResult<PlayerKickBroadcastData>> {
    const result = await this.socketIOGameService.kickPlayer(
      createActionContextFromAction(ctx.action),
      ctx.game,
      ctx.userData,
      ctx.action.payload.playerId
    );

    const broadcastData: PlayerKickBroadcastData = {
      playerId: ctx.action.payload.playerId,
    };

    return {
      success: true,
      data: broadcastData,
      mutations: [
        ...DataMutationConverter.mutationFromServiceBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: result.game,
    };
  }
}
