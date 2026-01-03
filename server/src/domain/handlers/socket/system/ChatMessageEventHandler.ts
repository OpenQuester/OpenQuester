import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  ChatMessageBroadcastData,
  ChatMessageInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class ChatMessageEventHandler extends BaseSocketEventHandler<
  ChatMessageInputData,
  ChatMessageBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOChatService: SocketIOChatService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOEvents {
    return SocketIOEvents.CHAT_MESSAGE;
  }

  protected async validateInput(
    data: ChatMessageInputData
  ): Promise<ChatMessageInputData> {
    return GameValidator.validateChatMessage(data);
  }

  protected async authorize(
    _data: ChatMessageInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled in service (mute checks, etc.)
  }

  protected async execute(
    data: ChatMessageInputData,
    _context: SocketEventContext
  ): Promise<SocketEventResult<ChatMessageBroadcastData>> {
    const result = await this.socketIOChatService.processChatMessage(
      this.socket.id,
      data.message
    );

    const payload: ChatMessageBroadcastData = {
      uuid: result.uuid,
      timestamp: result.timestamp,
      user: result.user,
      message: result.message,
    };

    return {
      success: true,
      data: payload,
      broadcast: [
        {
          event: SocketIOEvents.CHAT_MESSAGE,
          data: payload,
          target: SocketBroadcastTarget.GAME,
          gameId: result.gameId,
        },
      ],
    };
  }
}
