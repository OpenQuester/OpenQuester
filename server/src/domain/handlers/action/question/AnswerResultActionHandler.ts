import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultData } from "domain/types/socket/game/AnswerResultData";

/**
 * Stateless action handler for answer result (showman marking answer).
 */
export class AnswerResultActionHandler
  implements
    GameActionHandler<AnswerResultData, QuestionAnswerResultEventPayload>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {}

  public async execute(
    action: GameAction<AnswerResultData>
  ): Promise<GameActionHandlerResult<QuestionAnswerResultEventPayload>> {
    const result = await this.socketIOQuestionService.handleAnswerResult(
      action.socketId,
      action.payload
    );

    return {
      success: true,
      data: result.data,
      broadcasts: result.broadcasts,
    };
  }
}
