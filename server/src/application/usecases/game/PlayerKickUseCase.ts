import { PlayerLeaveService } from "application/services/game/PlayerLeaveService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { DataMutationType } from "domain/enums/DataMutationType";
import { ClientError } from "domain/errors/ClientError";
import { PlayerLeaveReason } from "domain/logic/player-leave/PlayerLeaveOrchestrator";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  MutationAction,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ShowmanAction } from "domain/types/game/ShowmanAction";
import {
  type PlayerKickBroadcastData,
  type PlayerKickInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Handles kicking a player from the game.
 *
 * Shared by showman socket commands and authorized admin-panel commands.
 */
export class PlayerKickUseCase
  implements GameActionHandler<PlayerKickInputData, PlayerKickBroadcastData>
{
  constructor(
    private readonly playerLeaveService: PlayerLeaveService,
    private readonly socketGameValidationService: SocketGameValidationService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<PlayerKickInputData>
  ): Promise<ActionHandlerResult<PlayerKickBroadcastData>> {
    const { game, action } = ctx;
    const targetPlayerId = action.payload.playerId;

    await this.socketGameValidationService.validateShowmanOrModerator(ctx, ShowmanAction.KICK_PLAYER);

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    const wasPlayer = targetPlayer.role === PlayerRole.PLAYER;

    const leaveResult = await this.playerLeaveService.processLeave(
      game,
      targetPlayerId,
      {
        reason: PlayerLeaveReason.KICK,
      }
    );

    const mutations = [...leaveResult.mutations];

    if (wasPlayer) {
      mutations.push({
        type: DataMutationType.UPDATE_PLAYER_STATS,
        gameId: game.id,
        userId: targetPlayerId,
        payload: { action: MutationAction.END_SESSION, leftAt: new Date() },
      });
    }

    mutations.push(DataMutationConverter.saveGameMutation(game));
    mutations.push(
      ...DataMutationConverter.mutationFromServiceBroadcasts(
        leaveResult.broadcasts
      )
    );

    const broadcastData: PlayerKickBroadcastData = {
      playerId: targetPlayerId,
    };

    return {
      success: true,
      data: broadcastData,
      mutations,
      broadcastGame: game,
    };
  }
}
