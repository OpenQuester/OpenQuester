import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PlayerScoreChangeLogic } from "domain/logic/game/PlayerScoreChangeLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  type PlayerScoreChangeBroadcastData,
  type PlayerScoreChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";

/**
 * Handles player score change requests from the showman.
 */
export class PlayerScoreChangeUseCase
  implements
    GameActionHandler<
      PlayerScoreChangeInputData,
      PlayerScoreChangeBroadcastData
    >
{
  public async execute(
    ctx: ActionExecutionContext<PlayerScoreChangeInputData>
  ): Promise<ActionHandlerResult<PlayerScoreChangeBroadcastData>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer, action } = ctx;
    const { payload } = action;

    if (currentPlayer.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_MANAGE_PLAYERS);
    }

    const newScore = PlayerScoreChangeLogic.applyScore(
      game,
      payload.playerId,
      payload.newScore
    );

    const result = PlayerScoreChangeLogic.buildResult({
      game,
      targetPlayerId: payload.playerId,
      newScore,
    });

    const broadcastData: PlayerScoreChangeBroadcastData = {
      playerId: payload.playerId,
      newScore: result.data.newScore,
    };

    return {
      success: true,
      data: broadcastData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
    };
  }
}
