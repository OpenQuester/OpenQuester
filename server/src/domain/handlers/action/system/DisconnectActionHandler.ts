import { PlayerLeaveReason } from "application/services/player/PlayerLeaveService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { convertBroadcasts } from "domain/utils/BroadcastConverter";

export interface DisconnectResult {
  gameId: string | null;
  userId: number | null;
}

/**
 * Stateless action handler for socket disconnect.
 * Handles leaving the game lobby when a socket disconnects.
 */
export class DisconnectActionHandler
  implements GameActionHandler<EmptyInputData, DisconnectResult>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<DisconnectResult>> {
    const result = await this.socketIOGameService.leaveLobby(
      action.socketId,
      PlayerLeaveReason.DISCONNECT
    );

    // Service generates type-safe broadcasts with satisfies - just convert format
    const broadcasts = result.broadcasts
      ? convertBroadcasts(result.broadcasts)
      : [];

    return {
      success: true,
      data: {
        gameId: result.data?.gameId ?? null,
        userId: result.data?.userId ?? null,
      },
      broadcasts,
    };
  }
}
