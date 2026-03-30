import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { DataMutationType } from "domain/enums/DataMutationType";
import { ClientError } from "domain/errors/ClientError";
import { PlayerRestrictionLogic } from "domain/logic/game/PlayerRestrictionLogic";
import {
  PlayerLeaveOrchestrator,
  PlayerLeaveReason,
} from "domain/logic/player-leave/PlayerLeaveOrchestrator";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutation,
  DataMutationConverter,
  MutationAction,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  PlayerRestrictionBroadcastData,
  PlayerRestrictionInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player restriction (mute/restrict/ban).
 */
export class PlayerRestrictionActionHandler
  implements
    GameActionHandler<
      PlayerRestrictionInputData,
      PlayerRestrictionBroadcastData
    >
{
  constructor(
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly playerLeaveOrchestrator: PlayerLeaveOrchestrator
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<PlayerRestrictionInputData>
  ): Promise<ActionHandlerResult<PlayerRestrictionBroadcastData>> {
    const { game, userData, action } = ctx;
    const { payload } = action;
    const targetPlayerId = payload.playerId;

    const currentPlayer = game.getPlayer(userData!.id, {
      fetchDisconnected: false,
    });

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: true,
    });

    if (!targetPlayer || !currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.socketGameValidationService.validatePlayerManagement(currentPlayer);

    const mutation = PlayerRestrictionLogic.applyRestrictions(targetPlayer, {
      muted: payload.muted,
      restricted: payload.restricted,
      banned: payload.banned,
    });

    const mutations: DataMutation[] = [];
    let broadcasts = [];

    if (mutation.shouldBan) {
      const leaveResult = await this.playerLeaveOrchestrator.processLeave(
        game,
        targetPlayerId,
        {
          reason: PlayerLeaveReason.BAN,
        }
      );

      mutations.push(...leaveResult.mutations);

      const banResult = PlayerRestrictionLogic.buildBanResult({
        game,
        targetPlayer,
        restrictions: payload,
      });

      broadcasts = [...leaveResult.broadcasts, ...banResult.broadcasts];

      mutations.push({
        type: DataMutationType.DISCONNECT_SOCKET,
        userId: targetPlayerId,
      });
    } else if (mutation.shouldRestrictToSpectator) {
      const cleanupResult =
        await this.playerLeaveOrchestrator.processGameStateCleanup(
          game,
          targetPlayerId
        );

      mutations.push(...cleanupResult.mutations);

      if (PlayerRestrictionLogic.wasPlayerRole(mutation.originalRole)) {
        mutations.push({
          type: DataMutationType.UPDATE_PLAYER_STATS,
          gameId: game.id,
          userId: targetPlayerId,
          payload: { action: MutationAction.END_SESSION, leftAt: new Date() },
        });
      }

      const restrictResult = PlayerRestrictionLogic.buildRestrictResult({
        game,
        targetPlayer,
        newRole: mutation.newRole!,
        restrictions: payload,
        gameStateCleanupBroadcasts: cleanupResult.broadcasts,
      });

      broadcasts = restrictResult.broadcasts;
    } else {
      const simpleResult = PlayerRestrictionLogic.buildSimpleResult({
        game,
        targetPlayer,
        restrictions: payload,
      });
      broadcasts = simpleResult.broadcasts;
    }

    mutations.push(DataMutationConverter.saveGameMutation(game));
    mutations.push(
      ...DataMutationConverter.mutationFromSocketBroadcasts(broadcasts)
    );

    const broadcastData: PlayerRestrictionBroadcastData = {
      playerId: payload.playerId,
      muted: payload.muted,
      restricted: payload.restricted,
      banned: payload.banned,
    };

    return {
      success: true,
      data: broadcastData,
      mutations,
      broadcastGame: game,
    };
  }
}
