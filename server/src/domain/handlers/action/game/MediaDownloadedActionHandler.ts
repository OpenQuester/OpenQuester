import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";

/**
 * Stateless action handler for media downloaded notification.
 */
export class MediaDownloadedActionHandler
  implements
    GameActionHandler<EmptyInputData, MediaDownloadStatusBroadcastData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<MediaDownloadStatusBroadcastData>> {
    const result = await this.socketIOQuestionService.handleMediaDownloaded(
      action.socketId
    );

    const statusData: MediaDownloadStatusBroadcastData = {
      playerId: result.playerId,
      mediaDownloaded: true,
      allPlayersReady: result.allPlayersReady,
      timer: result.timer,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        data: statusData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      },
    ];

    return { success: true, data: statusData, broadcasts };
  }
}
