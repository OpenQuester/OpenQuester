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
  PlayerSlotChangeBroadcastData,
  PlayerSlotChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";
import { GameActionExecutor } from "application/executors/GameActionExecutor";

/**
 * Handler for player slot change events
 */
export class PlayerSlotChangeEventHandler extends BaseSocketEventHandler<
  PlayerSlotChangeInputData,
  PlayerSlotChangeBroadcastData
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
    return SocketIOGameEvents.PLAYER_SLOT_CHANGE;
  }

  protected async validateInput(
    data: PlayerSlotChangeInputData
  ): Promise<PlayerSlotChangeInputData> {
    return GameValidator.validatePlayerSlotChange(data);
  }

  protected async authorize(
    _data: PlayerSlotChangeInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled by service layer
  }

  protected async execute(
    data: PlayerSlotChangeInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<PlayerSlotChangeBroadcastData>> {
    const result = await this.socketIOGameService.changePlayerSlot(
      this.socket.id,
      data.targetSlot,
      data.playerId
    );

    // Assign context variables for logging
    context.gameId = result.game.id;
    context.userId = this.socket.userId;

    const broadcastData: PlayerSlotChangeBroadcastData = {
      playerId: result.playerId,
      newSlot: result.newSlot,
      players: result.updatedPlayers,
    };

    return {
      success: true,
      data: broadcastData,
      broadcast: [
        {
          event: SocketIOGameEvents.PLAYER_SLOT_CHANGE,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        },
      ],
    };
  }
}
