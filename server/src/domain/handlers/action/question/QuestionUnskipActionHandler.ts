import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import {
  EmptyInputData,
  QuestionUnskipBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player unskipping question.
 */
export class QuestionUnskipActionHandler
  implements GameActionHandler<EmptyInputData, QuestionUnskipBroadcastData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    //
  }

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<QuestionUnskipBroadcastData>> {
    const result = await this.socketIOQuestionService.handlePlayerUnskip(
      createActionContextFromAction(action)
    );

    return {
      success: true,
      data: result.data,
      broadcasts: result.broadcasts,
    };
  }
}
