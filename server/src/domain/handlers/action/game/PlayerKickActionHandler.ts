import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { DataMutationType } from "domain/enums/DataMutationType";
import { ClientError } from "domain/errors/ClientError";
import {
  PlayerLeaveOrchestrator,
  PlayerLeaveReason,
} from "domain/logic/player-leave/PlayerLeaveOrchestrator";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  MutationAction,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  PlayerKickBroadcastData,
  PlayerKickInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for kicking a player.
 */
export class PlayerKickActionHandler
  implements GameActionHandler<PlayerKickInputData, PlayerKickBroadcastData>
{
  constructor(
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly playerLeaveOrchestrator: PlayerLeaveOrchestrator
  ) {}

  public async execute(
    ctx: ActionExecutionContext<PlayerKickInputData>
  ): Promise<ActionHandlerResult<PlayerKickBroadcastData>> {
    const { game, userData, action } = ctx;
    const targetPlayerId = action.payload.playerId;

    const currentPlayer = game.getPlayer(userData!.id, {
      fetchDisconnected: false,
    });

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer || !currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.socketGameValidationService.validatePlayerManagement(currentPlayer);

    const wasPlayer = targetPlayer.role === PlayerRole.PLAYER;

    const leaveResult = await this.playerLeaveOrchestrator.processLeave(
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
