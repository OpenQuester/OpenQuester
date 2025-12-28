import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  PlayerSlotChangeBroadcastData,
  PlayerSlotChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

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
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.PLAYER_SLOT_CHANGE;
  }

  protected async getGameIdForAction(
    _data: PlayerSlotChangeInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    try {
      const gameContext = await this.socketGameContextService.fetchGameContext(
        context.socketId
      );
      return gameContext.game?.id ?? null;
    } catch {
      return null;
    }
  }

  protected override getActionType(): GameActionType {
    return GameActionType.PLAYER_SLOT_CHANGE;
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
}
