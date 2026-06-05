import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PlayerRoleChangeLogic } from "domain/logic/game/PlayerRoleChangeLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  type PlayerRoleChangeBroadcastData,
  type PlayerRoleChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";

/**
 * Handles player role change requests.
 */
export class PlayerRoleChangeUseCase
  implements
    GameActionHandler<PlayerRoleChangeInputData, PlayerRoleChangeBroadcastData>
{
  constructor(
    private readonly validationService: SocketGameValidationService,
    private readonly playerGameStatsService: PlayerGameStatsService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<PlayerRoleChangeInputData>
  ): Promise<ActionHandlerResult<PlayerRoleChangeBroadcastData>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer, action } = ctx;
    const { payload } = action;

    const targetPlayerId = payload.playerId ?? currentPlayer.meta.id;
    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.validationService.validatePlayerRoleChange(
      currentPlayer,
      targetPlayer,
      payload.newRole,
      game
    );

    const mutation = PlayerRoleChangeLogic.processRoleChange(
      game,
      targetPlayer,
      payload.newRole
    );

    // Handle statistics based on role change
    if (payload.newRole === PlayerRole.PLAYER) {
      await this.playerGameStatsService.clearPlayerLeftAtTime(
        game.id,
        targetPlayerId
      );
    } else if (payload.newRole === PlayerRole.SPECTATOR && mutation.wasPlayer) {
      await this.playerGameStatsService.endPlayerSession(
        game.id,
        targetPlayerId,
        new Date()
      );
    }

    const result = PlayerRoleChangeLogic.buildResult({ game, targetPlayer });

    const broadcastData: PlayerRoleChangeBroadcastData = {
      playerId: result.data.targetPlayer.meta.id,
      newRole: payload.newRole,
      players: result.data.players,
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
