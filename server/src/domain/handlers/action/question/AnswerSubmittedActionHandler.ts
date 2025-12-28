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
    const game = await this.socketIOQuestionService.handleAnswerSubmitted(
      action.socketId
    );

    const broadcastData: AnswerSubmittedBroadcastData = {
      answerText: action.payload.answerText,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.ANSWER_SUBMITTED,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      },
    ];

    return { success: true, data: broadcastData, broadcasts };
  }
}
