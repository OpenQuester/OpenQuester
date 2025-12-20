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
  PlayerReadinessBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player ready state.
 */
export class PlayerReadyActionHandler
  implements GameActionHandler<EmptyInputData, PlayerReadinessBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<PlayerReadinessBroadcastData>> {
    const result = await this.socketIOGameService.setPlayerReadiness(
      action.socketId,
      true
    );

    const readyData: PlayerReadinessBroadcastData = {
      playerId: result.playerId,
      isReady: result.isReady,
      readyPlayers: result.readyPlayers,
      autoStartTriggered: result.shouldAutoStart,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.PLAYER_READY,
        data: readyData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      },
    ];

    // If auto-start should trigger, handle it
    if (result.shouldAutoStart) {
      const autoStartResult = await this.socketIOGameService.handleAutoStart(
        result.game.id
      );

      if (autoStartResult) {
        const startEventPayload: GameStartBroadcastData = {
          currentRound: autoStartResult.gameState.currentRound!,
        };

        broadcasts.push({
          event: SocketIOGameEvents.START,
          data: startEventPayload,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        });
      }
    }

    return { success: true, data: readyData, broadcasts };
  }
}
