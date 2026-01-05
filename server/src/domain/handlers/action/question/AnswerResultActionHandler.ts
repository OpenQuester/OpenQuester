import { SocketIOAnswerResult } from "application/services/socket/SocketIOAnswerResult";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultData } from "domain/types/socket/game/AnswerResultData";

/**
 * Stateless action handler for answer result (showman marking answer).
 */
export class AnswerResultActionHandler
  implements
    GameActionHandler<AnswerResultData, QuestionAnswerResultEventPayload>
{
  constructor(private readonly socketIOAnswerResult: SocketIOAnswerResult) {
    //
  }

  public async execute(
    action: GameAction<AnswerResultData>
  ): Promise<GameActionHandlerResult<QuestionAnswerResultEventPayload>> {
    const result = await this.socketIOAnswerResult.handleAnswerResult(
      createActionContextFromAction(action),
      action.payload
    );

    return {
      success: true,
      data: result.data,
      broadcasts: result.broadcasts,
    };
  }
}
