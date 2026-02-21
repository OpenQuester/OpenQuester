import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  PlayerRestrictionBroadcastData,
  PlayerRestrictionInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player restriction (mute/restrict/ban).
 */
export class PlayerRestrictionActionHandler
  implements
    GameActionHandler<
      PlayerRestrictionInputData,
      PlayerRestrictionBroadcastData
    >
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    ctx: ActionExecutionContext<PlayerRestrictionInputData>
  ): Promise<ActionHandlerResult<PlayerRestrictionBroadcastData>> {
    const { payload } = ctx.action;

    const result = await this.socketIOGameService.updatePlayerRestrictions(
      createActionContextFromAction(ctx.action),
      ctx.userData,
      ctx.game,
      payload.playerId,
      {
        muted: payload.muted,
        restricted: payload.restricted,
        banned: payload.banned,
      }
    );

    const broadcastData: PlayerRestrictionBroadcastData = {
      playerId: payload.playerId,
      muted: payload.muted,
      restricted: payload.restricted,
      banned: payload.banned,
    };

    return {
      success: true,
      data: broadcastData,
      mutations: [
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: result.data.game,
    };
  }
}
