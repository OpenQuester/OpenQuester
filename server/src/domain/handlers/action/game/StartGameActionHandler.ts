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
  GameStartBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

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
    const gameDTO = await this.socketIOGameService.startGame(action.socketId);

    const startEventPayload: GameStartBroadcastData = {
      currentRound: gameDTO.gameState.currentRound!,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.START,
        data: startEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: gameDTO.id,
      },
    ];

    return { success: true, data: startEventPayload, broadcasts };
  }
}
