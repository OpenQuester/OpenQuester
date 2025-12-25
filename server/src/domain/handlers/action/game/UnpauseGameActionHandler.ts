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
import {
  EmptyInputData,
  GameUnpauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for unpausing a game.
 */
export class UnpauseGameActionHandler
  implements GameActionHandler<EmptyInputData, GameUnpauseBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<GameUnpauseBroadcastData>> {
    const { game, timer } = await this.socketIOGameService.handleGameUnpause(
      action.socketId
    );

    const unpauseData: GameUnpauseBroadcastData = { timer };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.GAME_UNPAUSE,
        data: unpauseData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      },
    ];

    return { success: true, data: unpauseData, broadcasts };
  }
}
