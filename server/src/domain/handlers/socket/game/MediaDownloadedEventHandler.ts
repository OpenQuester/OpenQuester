import { Socket } from "socket.io";

import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Handler for media downloaded events
 */
export class MediaDownloadedEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  MediaDownloadStatusBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    super(socket, eventEmitter, logger);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.MEDIA_DOWNLOADED;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    // No input validation needed
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<MediaDownloadStatusBroadcastData>> {
    // Execute the media downloaded logic
    const result = await this.socketIOQuestionService.handleMediaDownloaded(
      this.socket.id
    );

    // Assign context variables for logging
    context.gameId = result.game.id;
    context.userId = this.socket.userId;

    const statusData: MediaDownloadStatusBroadcastData = {
      playerId: result.playerId,
      mediaDownloaded: true,
      allPlayersReady: result.allPlayersReady,
      timer: result.timer || undefined,
    };

    const broadcasts: Array<
      SocketEventBroadcast<MediaDownloadStatusBroadcastData>
    > = [
      {
        event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        data: statusData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      },
    ];

    return {
      success: true,
      data: statusData,
      broadcast: broadcasts,
    };
  }
}
