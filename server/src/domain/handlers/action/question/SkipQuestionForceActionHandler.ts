import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionFinishWithAnswerEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";

/**
 * Stateless action handler for force skipping a question (showman).
 */
export class SkipQuestionForceActionHandler
  implements GameActionHandler<EmptyInputData, EmptyOutputData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {
    //
  }

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<EmptyOutputData>> {
    const actionCtx = createActionContextFromAction(action);

    // Core force-skip logic in service layer (validates + updates state)
    // Now returns broadcasts (e.g. GAME_FINISHED) if round completion logic triggered
    const { game, question, broadcasts } =
      await this.socketIOQuestionService.handleQuestionForceSkip(actionCtx);

    // We must manually broadcast QUESTION_FINISH because this action bypasses
    // the regular state machine transition handlers (ShowingToShowingAnswer)
    const questionFinishPayload: QuestionFinishWithAnswerEventPayload = {
      answerFiles: question?.answerFiles ?? null,
      answerText: question?.answerText ?? null,
      nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
      answerResult: null, // No actual answer was given
    };

    const finalBroadcasts = [
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: questionFinishPayload,
        room: game.id,
      },
      ...(broadcasts ?? []),
    ];

    return {
      success: true,
      data: {},
      broadcasts: finalBroadcasts,
    };
  }
}
