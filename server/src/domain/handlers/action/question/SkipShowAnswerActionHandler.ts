import { GameLifecycleService } from "application/services/game/GameLifecycleService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { convertBroadcasts } from "domain/utils/BroadcastConverter";

/**
 * Stateless action handler for skipping the show-answer phase.
 * Only the showman can skip this phase to speed up gameplay.
 */
export class SkipShowAnswerActionHandler
  implements GameActionHandler<EmptyInputData, EmptyOutputData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameLifecycleService: GameLifecycleService
  ) {
    //
  }

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<EmptyOutputData>> {
    const result = await this.socketIOQuestionService.skipShowAnswer(
      createActionContextFromAction(action)
    );

    // Convert BroadcastEvent[] to SocketEventBroadcast[] with proper target, gameId, and roleFilter
    const convertedBroadcasts = convertBroadcasts(
      result.broadcasts ?? [],
      action.gameId
    );

    // Check if game finished and trigger statistics persistence
    if (result.game?.finishedAt) {
      await this.gameLifecycleService.handleGameCompletion(action.gameId);
    }

    return {
      success: true,
      data: result.data,
      broadcasts: convertedBroadcasts,
    };
  }
}
