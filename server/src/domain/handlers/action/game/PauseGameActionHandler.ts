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
  GamePauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for pausing a game.
 */
export class PauseGameActionHandler
  implements GameActionHandler<EmptyInputData, GamePauseBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<GamePauseBroadcastData>> {
    const { game, timer } = await this.socketIOGameService.handleGamePause(
      action.socketId
    );

    const pauseData: GamePauseBroadcastData = { timer };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.GAME_PAUSE,
        data: pauseData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      },
    ];

    return { success: true, data: pauseData, broadcasts };
  }
}
