import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  GamePauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { createActionContextFromAction } from "domain/types/action/ActionContext";

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
    const result = await this.socketIOGameService.handleGamePause(
      createActionContextFromAction(action)
    );

    const pauseData: GamePauseBroadcastData = { timer: result.data.timer };

    return { success: true, data: pauseData, broadcasts: result.broadcasts };
  }
}
