import { Socket } from "socket.io";

import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  PlayerRoleChangeBroadcastData,
  PlayerRoleChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";
import { GameActionExecutor } from "application/executors/GameActionExecutor";

/**
 * Handler for player role change events
 */
export class PlayerRoleChangeEventHandler extends BaseSocketEventHandler<
  PlayerRoleChangeInputData,
  PlayerRoleChangeBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOGameService: SocketIOGameService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.PLAYER_ROLE_CHANGE;
  }

  protected async validateInput(
    data: PlayerRoleChangeInputData
  ): Promise<PlayerRoleChangeInputData> {
    return GameValidator.validatePlayerRoleChange(data);
  }

  protected async authorize(
    _data: PlayerRoleChangeInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled by service layer
  }

  protected async execute(
    data: PlayerRoleChangeInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<PlayerRoleChangeBroadcastData>> {
    const result = await this.socketIOGameService.changePlayerRole(
      this.socket.id,
      data.newRole,
      data.playerId
    );

    // Assign context variables for logging
    context.gameId = result.game.id;
    context.userId = this.socket.userId;

    const broadcastData: PlayerRoleChangeBroadcastData = {
      playerId: result.targetPlayer.meta.id,
      newRole: data.newRole,
      players: result.players,
    };

    return {
      success: true,
      data: broadcastData,
      broadcast: [
        {
          event: SocketIOGameEvents.PLAYER_ROLE_CHANGE,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        },
      ],
    };
  }
}
