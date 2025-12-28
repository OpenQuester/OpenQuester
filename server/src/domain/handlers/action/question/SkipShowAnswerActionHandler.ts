import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { AnswerShowEndEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
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
    const { gameId, socketId } = action;

    const { game } = await this.socketIOQuestionService.skipShowAnswer(
      socketId
    );

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.ANSWER_SHOW_END,
        data: {} satisfies AnswerShowEndEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      },
    ];

    // Check if round progression is needed
    if (ShowAnswerLogic.shouldProgressRound(game)) {
      const { isGameFinished, nextGameState } =
        await this.socketIOQuestionService.handleRoundProgression(game);

      if (nextGameState) {
        broadcasts.push({
          event: SocketIOGameEvents.NEXT_ROUND,
          data: {
            gameState: nextGameState,
          } satisfies GameNextRoundEventPayload,
          target: SocketBroadcastTarget.GAME,
          gameId,
        });
      }

      if (isGameFinished) {
        broadcasts.push({
          event: SocketIOGameEvents.GAME_FINISHED,
          data: true,
          target: SocketBroadcastTarget.GAME,
          gameId,
        });
      }
    }

    return {
      success: true,
      data: {},
      broadcasts,
    };
  }
}
