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
  ) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<QuestionUnskipBroadcastData>> {
    const { game, playerId } =
      await this.socketIOQuestionService.handlePlayerUnskip(action.socketId);

    const broadcastData: QuestionUnskipBroadcastData = { playerId };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.QUESTION_UNSKIP,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      },
    ];

    return { success: true, data: broadcastData, broadcasts };
  }
}
