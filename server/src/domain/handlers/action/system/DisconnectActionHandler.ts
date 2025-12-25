import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";

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
    const result = await this.socketIOGameService.leaveLobby(action.socketId);

    const broadcasts: SocketEventBroadcast<unknown>[] = [];

    // Add leave event if needed
    if (result.emit && result.data) {
      broadcasts.push({
        event: SocketIOGameEvents.LEAVE,
        data: result.data,
        target: SocketBroadcastTarget.GAME,
        gameId: result.data.gameId,
      });
    }

    // Add any additional broadcasts (e.g., answer-result from auto-skip)
    if (result.broadcasts) {
      for (const broadcast of result.broadcasts) {
        broadcasts.push({
          event: broadcast.event,
          data: broadcast.data,
          target: SocketBroadcastTarget.GAME,
          gameId: result.data?.gameId ?? "",
        });
      }
    }

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
