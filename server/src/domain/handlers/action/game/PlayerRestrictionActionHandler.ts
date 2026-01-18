import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  PlayerRestrictionBroadcastData,
  PlayerRestrictionInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { createActionContextFromAction } from "domain/types/action/ActionContext";

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
    action: GameAction<PlayerRestrictionInputData>
  ): Promise<GameActionHandlerResult<PlayerRestrictionBroadcastData>> {
    const { payload } = action;

    const result = await this.socketIOGameService.updatePlayerRestrictions(
      createActionContextFromAction(action),
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
      broadcasts: result.broadcasts,
    };
  }
}
