import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameActionType } from "domain/enums/GameActionType";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
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

      // Add broadcast if the service indicates it should be emitted
      if (result.emit && result.data) {
        context.gameId = result.data.gameId;
        broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: result.data.userId },
          target: SocketBroadcastTarget.GAME,
          gameId: result.data.gameId,
        });

        // Socket can leave since event emitting handled by IO when target is Game
        await this.socket.leave(result.data.gameId);
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
