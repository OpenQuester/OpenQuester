import { PlayerLeaveService } from "application/services/game/PlayerLeaveService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { DataMutationType } from "domain/enums/DataMutationType";
import { ClientError } from "domain/errors/ClientError";
import { PlayerRestrictionLogic } from "domain/logic/game/PlayerRestrictionLogic";
import { PlayerLeaveReason } from "domain/logic/player-leave/PlayerLeaveOrchestrator";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  type DataMutation,
  DataMutationConverter,
  MutationAction
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  type PlayerRestrictionBroadcastData,
  type PlayerRestrictionInputData
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";

/**
 * Handles player restriction (mute/restrict/ban).
 */
export class PlayerRestrictionUseCase implements GameActionHandler<
  PlayerRestrictionInputData,
  PlayerRestrictionBroadcastData
> {
  constructor(private readonly playerLeaveService: PlayerLeaveService) {}

  public async execute(
    ctx: ActionExecutionContext<PlayerRestrictionInputData>
  ): Promise<ActionHandlerResult<PlayerRestrictionBroadcastData>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer, action } = ctx;
    const { payload } = action;
    const targetPlayerId = payload.playerId;

    if (currentPlayer.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_MANAGE_PLAYERS);
    }

    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: true
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    const mutation = PlayerRestrictionLogic.applyRestrictions(targetPlayer, {
      muted: payload.muted,
      restricted: payload.restricted,
      banned: payload.banned
    });

    const mutations: DataMutation[] = [];
    // TODO: Fix broadcasts and align them to one unified interface. Currently have BroadcastEvent[] and SocketEventBroadcast[]
    let broadcasts;

    if (mutation.shouldBan) {
      const leaveResult = await this.playerLeaveService.processLeave(game, targetPlayerId, {
        reason: PlayerLeaveReason.BAN
      });

      mutations.push(...leaveResult.mutations);

      const banResult = PlayerRestrictionLogic.buildBanResult({
        game,
        targetPlayer,
        restrictions: payload
      });

      broadcasts = [...leaveResult.broadcasts, ...banResult.broadcasts];

      mutations.push({
        type: DataMutationType.DISCONNECT_SOCKET,
        userId: targetPlayerId
      });
    } else if (mutation.shouldRestrictToSpectator) {
      const cleanupResult = await this.playerLeaveService.processGameStateCleanup(
        game,
        targetPlayerId
      );

      mutations.push(...cleanupResult.mutations);

      if (PlayerRestrictionLogic.wasPlayerRole(mutation.originalRole)) {
        mutations.push({
          type: DataMutationType.UPDATE_PLAYER_STATS,
          gameId: game.id,
          userId: targetPlayerId,
          payload: { action: MutationAction.END_SESSION, leftAt: new Date() }
        });
      }

      const restrictResult = PlayerRestrictionLogic.buildRestrictResult({
        game,
        targetPlayer,
        newRole: mutation.newRole!,
        restrictions: payload,
        gameStateCleanupBroadcasts: cleanupResult.broadcasts
      });

      broadcasts = restrictResult.broadcasts;
    } else {
      const simpleResult = PlayerRestrictionLogic.buildSimpleResult({
        game,
        targetPlayer,
        restrictions: payload
      });
      broadcasts = simpleResult.broadcasts;
    }

    mutations.push(DataMutationConverter.saveGameMutation(game));
    mutations.push(...DataMutationConverter.mutationFromSocketBroadcasts(broadcasts));

    const broadcastData: PlayerRestrictionBroadcastData = {
      playerId: payload.playerId,
      muted: payload.muted,
      restricted: payload.restricted,
      banned: payload.banned
    };

    return {
      success: true,
      data: broadcastData,
      mutations,
      broadcastGame: game
    };
  }
}
