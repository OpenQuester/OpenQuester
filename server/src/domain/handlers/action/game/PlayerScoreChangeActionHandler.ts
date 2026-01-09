import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  PlayerScoreChangeBroadcastData,
  PlayerScoreChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { createActionContextFromAction } from "domain/types/action/ActionContext";

/**
 * Stateless action handler for player score change.
 */
export class PlayerScoreChangeActionHandler
  implements
    GameActionHandler<
      PlayerScoreChangeInputData,
      PlayerScoreChangeBroadcastData
    >
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    action: GameAction<PlayerScoreChangeInputData>
  ): Promise<GameActionHandlerResult<PlayerScoreChangeBroadcastData>> {
    const { payload } = action;

    const result = await this.socketIOGameService.changePlayerScore(
      createActionContextFromAction(action),
      payload.playerId,
      payload.newScore
    );

    const broadcastData: PlayerScoreChangeBroadcastData = {
      playerId: payload.playerId,
      newScore: result.data.newScore,
    };

    return {
      success: true,
      data: broadcastData,
      broadcasts: result.broadcasts,
    };
  }
}
