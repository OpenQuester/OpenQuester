import { PlayerLeaveService } from "application/services/game/PlayerLeaveService";
import { DataMutationType } from "domain/enums/DataMutationType";
import { PlayerLeaveReason } from "domain/logic/player-leave/PlayerLeaveOrchestrator";
import { ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  MutationAction,
} from "domain/types/action/DataMutation";
import { GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  EmptyInputData,
  GameLeaveBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";

export class LeaveGameUseCase
  implements GameActionHandler<EmptyInputData, GameLeaveBroadcastData>
{
  constructor(
    private readonly playerLeaveService: PlayerLeaveService
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameLeaveBroadcastData>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, userData, action } = ctx;

    const userId = userData.id;
    const targetPlayer = game.getPlayer(userId, { fetchDisconnected: false });
    const wasPlayer = targetPlayer!.role === PlayerRole.PLAYER;

    const leaveResult = await this.playerLeaveService.processLeave(
      game,
      userId,
      {
        reason: PlayerLeaveReason.LEAVE,
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

    const activePlayers = game.getActivePlayers();

    const gameNotStartedOrFinished =
      game.startedAt === null || game.finishedAt !== null;

    // Delete game if not started or finished and all players left (to avoid hanging empty games)
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
      data: { user: userId },
      mutations,
      broadcastGame: game,
    };
  }
}
