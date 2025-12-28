import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class DisconnectEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  EmptyOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketUserDataService: SocketUserDataService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOEvents {
    return SocketIOEvents.DISCONNECT;
  }

  protected override async getGameIdForAction(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<string | null> {
    try {
      const socketData = await this.socketUserDataService.getSocketData(
        this.socket.id
      );
      return socketData?.gameId ?? null;
    } catch {
      return null;
    }
  }

  protected override getActionType(): GameActionType {
    return GameActionType.DISCONNECT;
  }

  /**
   * Allow null gameId - disconnect may be called when user isn't in a game.
   * In that case, silently succeed with no-op.
   */
  protected override allowsNullGameId(): boolean {
    return true;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // No authorization needed for disconnect
  }
}
