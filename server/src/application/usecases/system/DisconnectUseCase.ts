import { PlayerLeaveService } from "application/services/game/PlayerLeaveService";
import { DataMutationType } from "domain/enums/DataMutationType";
import { PlayerLeaveReason } from "domain/logic/player-leave/PlayerLeaveOrchestrator";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  MutationAction,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";

interface DisconnectResult {
  gameId: string | null;
  userId: number | null;
}

/**
 * Handles socket disconnect.
 * Handles leaving the game lobby when a socket disconnects.
 */
export class DisconnectUseCase
  implements GameActionHandler<EmptyInputData, DisconnectResult>
{
  constructor(
    private readonly playerLeaveService: PlayerLeaveService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<DisconnectResult>> {
    const { game, userData, action } = ctx;

    if (!userData?.gameId) {
      return {
        success: true,
        data: { gameId: null, userId: null },
        mutations: [],
      };
    }

    const userId = userData.id;
    const targetPlayer = game.getPlayer(userId, { fetchDisconnected: true });
    const wasPlayer = targetPlayer?.role === PlayerRole.PLAYER;

    const leaveResult = await this.playerLeaveService.processLeave(
      game,
      userId,
      {
        reason: PlayerLeaveReason.DISCONNECT,
      }
    );

    const mutations = [...leaveResult.mutations];

    // Update socket session
    mutations.push({
      type: DataMutationType.UPDATE_SOCKET_SESSION,
      socketId: action.socketId,
      userId: JSON.stringify(userId),
      gameId: JSON.stringify(null),
    });

    // End player session to collect statistics if they were a player
    if (wasPlayer) {
      mutations.push({
        type: DataMutationType.UPDATE_PLAYER_STATS,
        gameId: game.id,
        userId,
        payload: { action: MutationAction.END_SESSION, leftAt: new Date() },
      });
    }

    const activePlayers = game.players.filter(
      (p) => p.gameStatus === PlayerGameStatus.IN_GAME
    );

    const gameNotStartedOrFinished =
      game.startedAt === null || game.finishedAt !== null;

    if (activePlayers.length === 0 && gameNotStartedOrFinished) {
      mutations.push(DataMutationConverter.deleteGameMutation(game.id));
    } else {
      mutations.push(DataMutationConverter.saveGameMutation(game));
    }

    mutations.push(
      ...DataMutationConverter.mutationFromServiceBroadcasts(
        leaveResult.broadcasts
      )
    );

    return {
      success: true,
      data: {
        gameId: game.id,
        userId,
      },
      mutations,
      broadcastGame: game,
    };
  }
}
