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
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player answering a question (buzzer press).
 */
export class QuestionAnswerActionHandler
  implements GameActionHandler<EmptyInputData, QuestionAnswerEventPayload>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<QuestionAnswerEventPayload>> {
    const { userId, gameId, timer } =
      await this.socketIOQuestionService.handleQuestionAnswer(action.socketId);

    const result: QuestionAnswerEventPayload = {
      userId: userId!,
      timer: timer.value()!,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.QUESTION_ANSWER,
        data: result,
        target: SocketBroadcastTarget.GAME,
        gameId,
      },
    ];

    return { success: true, data: result, broadcasts };
  }
}
