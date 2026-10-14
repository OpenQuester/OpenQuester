import { DataMutationType } from "domain/enums/DataMutationType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  MutationAction,
  type UpdatePlayerStatsMutation
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  type EmptyInputData,
  type GameClosedBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Closes a game from the admin panel (`ADMIN_GAME_CLOSE`).
 *
 * Tells everyone in the room why, ends the stats session of every player and
 * deletes the game. Runs through the action queue so no in-flight action can
 * save the game back after it is gone. Room membership, socket sessions,
 * timers and the package copy are cleaned up by the caller afterwards.
 */
export class AdminGameCloseUseCase implements GameActionHandler<
  EmptyInputData,
  GameClosedBroadcastData
> {
  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameClosedBroadcastData>> {
    const { game } = ctx;
    const data: GameClosedBroadcastData = { gameId: game.id, reason: "moderator" };
    const leftAt = new Date();

    const statsMutations =
      game.startedAt !== null && game.finishedAt === null
        ? game.players
            .filter((p) => p.role === PlayerRole.PLAYER)
            .map(
              (p): UpdatePlayerStatsMutation => ({
                type: DataMutationType.UPDATE_PLAYER_STATS,
                gameId: game.id,
                userId: p.meta.id,
                payload: { action: MutationAction.END_SESSION, leftAt }
              })
            )
        : [];

    return {
      success: true,
      data,
      mutations: [
        ...statsMutations,
        DataMutationConverter.deleteGameMutation(game.id),
        ...DataMutationConverter.mutationFromServiceBroadcasts([
          { event: SocketIOGameEvents.GAME_CLOSED, data, room: game.id }
        ])
      ]
    };
  }
}
