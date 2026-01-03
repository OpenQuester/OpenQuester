import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  AnswerSubmittedBroadcastData,
  AnswerSubmittedInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for answer submission.
 */
export class AnswerSubmittedActionHandler
  implements
    GameActionHandler<AnswerSubmittedInputData, AnswerSubmittedBroadcastData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {}

  public async execute(
    action: GameAction<AnswerSubmittedInputData>
  ): Promise<GameActionHandlerResult<AnswerSubmittedBroadcastData>> {
    const result = await this.socketIOQuestionService.handleAnswerSubmitted(
      action.socketId,
      { answerText: action.payload.answerText }
    );

    return {
      success: true,
      data: result.data,
      broadcasts: result.broadcasts,
    };
  }
}
