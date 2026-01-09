import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  GameUnpauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { createActionContextFromAction } from "domain/types/action/ActionContext";

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
    const result = await this.socketIOGameService.handleGameUnpause(
      createActionContextFromAction(action)
    );

    const unpauseData: GameUnpauseBroadcastData = { timer: result.data.timer };

    return { success: true, data: unpauseData, broadcasts: result.broadcasts };
  }
}
