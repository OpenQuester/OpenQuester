import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
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

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<EmptyOutputData>> {
    const broadcasts: SocketEventBroadcast[] = [];

    try {
      // Try to leave game first (will emit leave event if needed)
      const result = await this.socketIOGameService.leaveLobby(this.socket.id);

      // Convert broadcasts from service to SocketEventBroadcast format
      // Note: Service already includes LEAVE broadcast, so we just convert them
      if (result.emit && result.data) {
        context.gameId = result.data.gameId;
        broadcasts.push(
          ...(result.broadcasts || []).map((b) => ({
            event: b.event,
            data: b.data,
            target: SocketBroadcastTarget.GAME,
            gameId: b.room,
          }))
        );

        // Use context.socketId to get the correct socket for queued actions
        const targetSocket = this.socket.nsp.sockets.get(this.socket.id);
        if (targetSocket) {
          await targetSocket.leave(result.data.gameId);
        }
      }
    } catch {
      // Continue with cleanup even if leave fails
    }

    // Always clean up auth data
    await this.socketIOGameService.removePlayerAuth(this.socket.id);

    return {
      success: true,
      broadcast: broadcasts,
    };
  }
}
