import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
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
  ) {
    //
  }

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<MediaDownloadStatusBroadcastData>> {
    const result = await this.socketIOQuestionService.handleMediaDownloaded(
      createActionContextFromAction(action)
    );

    const statusData: MediaDownloadStatusBroadcastData = {
      playerId: result.data.playerId,
      mediaDownloaded: true,
      allPlayersReady: result.data.allPlayersReady,
      timer: result.data.timer,
    };

    return { success: true, data: statusData, broadcasts: result.broadcasts };
  }
}
