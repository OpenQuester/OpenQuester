import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  GameStartBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { createActionContextFromAction } from "domain/types/action/ActionContext";

/**
 * Stateless action handler for starting a game.
 */
export class StartGameActionHandler
  implements GameActionHandler<EmptyInputData, GameStartBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<GameStartBroadcastData>> {
    const result = await this.socketIOGameService.startGame(
      createActionContextFromAction(action)
    );

    return {
      success: true,
      data: { currentRound: result.data.currentRound! },
      broadcasts: result.broadcasts,
    };
  }
}
