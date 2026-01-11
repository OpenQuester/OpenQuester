import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { convertBroadcasts } from "domain/utils/BroadcastConverter";

/**
 * Stateless action handler for force skipping a question (showman).
 */
export class SkipQuestionForceActionHandler
  implements GameActionHandler<EmptyInputData, EmptyOutputData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    //
  }

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<EmptyOutputData>> {
    const actionCtx = createActionContextFromAction(action);

    const { broadcasts } =
      await this.socketIOQuestionService.handleQuestionForceSkip(actionCtx);

    const convertedBroadcasts = convertBroadcasts(
      broadcasts ?? [],
      action.gameId
    );

    return {
      success: true,
      data: {},
      broadcasts: convertedBroadcasts,
    } satisfies GameActionHandlerResult<EmptyOutputData>;
  }
}
