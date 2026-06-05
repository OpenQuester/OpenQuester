import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { TurnPlayerChangeLogic } from "domain/logic/game/TurnPlayerChangeLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  type TurnPlayerChangeBroadcastData,
  type TurnPlayerChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameValidator } from "domain/validators/GameValidator";

/**
 * Handles turn player change requests from the showman.
 */
export class TurnPlayerChangeUseCase
  implements
    GameActionHandler<TurnPlayerChangeInputData, TurnPlayerChangeBroadcastData>
{
  public async execute(
    ctx: ActionExecutionContext<TurnPlayerChangeInputData>
  ): Promise<ActionHandlerResult<TurnPlayerChangeBroadcastData>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer, action } = ctx;
    const { payload } = action;

    if (currentPlayer.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_MANAGE_PLAYERS);
    }

    GameStateValidator.validateGameNotFinished(game);

    if (payload.newTurnPlayerId !== null) {
      const targetPlayer = game.getPlayer(payload.newTurnPlayerId, {
        fetchDisconnected: false,
      });
      if (!targetPlayer || targetPlayer.role !== PlayerRole.PLAYER) {
        throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
      }
    }

    TurnPlayerChangeLogic.applyTurnChange(game, payload.newTurnPlayerId);

    const result = TurnPlayerChangeLogic.buildResult({
      game,
      newTurnPlayerId: payload.newTurnPlayerId,
    });

    const broadcastData: TurnPlayerChangeBroadcastData = {
      newTurnPlayerId: payload.newTurnPlayerId,
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
