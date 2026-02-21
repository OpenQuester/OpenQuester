import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { TurnPlayerChangeLogic } from "domain/logic/game/TurnPlayerChangeLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  TurnPlayerChangeBroadcastData,
  TurnPlayerChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for turn player change.
 */
export class TurnPlayerChangeActionHandler
  implements
    GameActionHandler<TurnPlayerChangeInputData, TurnPlayerChangeBroadcastData>
{
  constructor(
    private readonly validationService: SocketGameValidationService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<TurnPlayerChangeInputData>
  ): Promise<ActionHandlerResult<TurnPlayerChangeBroadcastData>> {
    const { game, currentPlayer, action } = ctx;
    const { payload } = action;

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.validationService.validateTurnPlayerChange(
      currentPlayer,
      game,
      payload.newTurnPlayerId
    );

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
