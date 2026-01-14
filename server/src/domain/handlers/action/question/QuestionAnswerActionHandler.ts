import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { createActionContextFromAction } from "domain/types/action/ActionContext";

/**
 * Stateless action handler for player answering a question (buzzer press).
 */
export class QuestionAnswerActionHandler
  implements GameActionHandler<EmptyInputData, QuestionAnswerEventPayload>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    //
  }

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<QuestionAnswerEventPayload>> {
    const result = await this.socketIOQuestionService.handleQuestionAnswer(
      createActionContextFromAction(action)
    );

    const responseData: QuestionAnswerEventPayload = {
      userId: result.data.userId!,
      timer: result.data.timer.value()!,
    };

    return {
      success: true,
      data: responseData,
      broadcasts: result.broadcasts,
    };
  }
}
