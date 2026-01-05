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

/**
 * Stateless action handler for skipping the show-answer phase.
 * Only the showman can skip this phase to speed up gameplay.
 */
export class SkipShowAnswerActionHandler
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
    const result = await this.socketIOQuestionService.skipShowAnswer(
      createActionContextFromAction(action)
    );

    return {
      success: true,
      data: result.data,
      broadcasts: result.broadcasts,
    };
  }
}
