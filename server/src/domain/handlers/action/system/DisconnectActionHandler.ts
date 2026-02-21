import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";

interface DisconnectResult {
  gameId: string | null;
  userId: number | null;
}

/**
 * Stateless action handler for socket disconnect.
 * Handles leaving the game lobby when a socket disconnects.
 */
export class DisconnectActionHandler
  implements GameActionHandler<EmptyInputData, DisconnectResult>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<DisconnectResult>> {
    const result = await this.socketIOGameService.leaveLobby(
      ctx.action.socketId,
      ctx.userData,
      ctx.game
    );

    if (!result.emit || !result.data) {
      return {
        success: true,
        data: { gameId: null, userId: null },
        mutations: [],
      };
    }

    return {
      success: true,
      data: {
        gameId: result.data.game.id ?? null,
        userId: result.data.userId ?? null,
      },
      mutations: [
        ...DataMutationConverter.mutationFromServiceBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: result.data.game,
    };
  }
}
