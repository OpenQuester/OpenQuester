import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { DataMutationType } from "domain/enums/DataMutationType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  MutationAction,
  type UpdatePlayerStatsMutation
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameEvent, type GameEventDTO } from "domain/types/dto/game/GameEventDTO";
import {
  type EmptyInputData,
  type GameClosedBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Closes a game from the admin panel (`ADMIN_GAME_CLOSE`).
 *
 * Tells everyone in the room why, ends the stats session of every player and
 * deletes the game. Runs through the action queue so no in-flight action can
 * save the game back after it is gone. Post-execution hooks clear room membership,
 * socket sessions and saved timers while the executor still owns the game lock.
 */
export class AdminGameCloseUseCase implements GameActionHandler<
  EmptyInputData,
  GameClosedBroadcastData
> {
  constructor(private readonly socketGameValidationService: SocketGameValidationService) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameClosedBroadcastData>> {
    const { game } = ctx;
    await this.socketGameValidationService.validateModerator(ctx.action);
    const data: GameClosedBroadcastData = { gameId: game.id, reason: "moderator" };
    const deleted: GameEventDTO = { event: GameEvent.DELETED, data: { id: game.id } };
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
        ]),
        ...DataMutationConverter.mutationFromSocketBroadcasts([
          { event: SocketIOEvents.GAMES, data: deleted, target: SocketBroadcastTarget.ALL }
        ])
      ]
    };
  }
}
