import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PlayerSlotChangeLogic } from "domain/logic/game/PlayerSlotChangeLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  PlayerSlotChangeBroadcastData,
  PlayerSlotChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player slot change.
 */
export class PlayerSlotChangeActionHandler
  implements
    GameActionHandler<PlayerSlotChangeInputData, PlayerSlotChangeBroadcastData>
{
  constructor(
    private readonly validationService: SocketGameValidationService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<PlayerSlotChangeInputData>
  ): Promise<ActionHandlerResult<PlayerSlotChangeBroadcastData>> {
    const { game, currentPlayer, action } = ctx;
    const { payload } = action;

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    // targetPlayerId may differ from currentPlayer when showman moves another player
    const targetPlayerId = payload.playerId ?? currentPlayer.meta.id;
    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.validationService.validatePlayerSlotChange(
      currentPlayer,
      game,
      payload.targetSlot,
      targetPlayer
    );

    PlayerSlotChangeLogic.applySlotChange(targetPlayer, payload.targetSlot);

    const result = PlayerSlotChangeLogic.buildResult({
      game,
      player: targetPlayer,
      newSlot: payload.targetSlot,
    });

    const broadcastData: PlayerSlotChangeBroadcastData = {
      playerId: result.data.playerId,
      newSlot: result.data.newSlot,
      players: result.data.updatedPlayers,
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
