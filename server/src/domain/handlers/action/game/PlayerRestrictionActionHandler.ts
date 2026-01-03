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
    const { payload, socketId } = action;

    const result = await this.socketIOGameService.updatePlayerRestrictions(
      socketId,
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

    return { success: true, data: broadcastData, broadcasts: result.broadcasts };
  }
}
