import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { QuestionAnswerResultLogic } from "domain/logic/question/QuestionAnswerResultLogic";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { AnswerShowStartEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishWithAnswerEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";

/**
 * Stateless action handler for answer result (showman marking answer).
 */
export class AnswerResultActionHandler
  implements
    GameActionHandler<AnswerResultData, QuestionAnswerResultEventPayload>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    //
  }

  public async execute(
    action: GameAction<AnswerResultData>
  ): Promise<GameActionHandlerResult<QuestionAnswerResultEventPayload>> {
    const {
      playerAnswerResult,
      game,
      question,
      timer,
      allPlayersSkipped,
      skippedQuestion,
    } = await this.socketIOQuestionService.handleAnswerResult(
      action.socketId,
      action.payload
    );

    const shouldShowAnswer =
      playerAnswerResult.answerType === AnswerResultType.CORRECT ||
      allPlayersSkipped;

    if (shouldShowAnswer) {
      const questionData = allPlayersSkipped ? skippedQuestion : question;
      return this.buildShowAnswerResult(
        game.id,
        playerAnswerResult,
        questionData ?? null,
        timer,
        game.gameState.currentTurnPlayerId ?? null
      );
    }

    return this.buildContinueQuestionResult(game.id, playerAnswerResult, timer);
  }

  /**
   * Build result for transitioning to SHOWING_ANSWER state.
   * Sends ANSWER_RESULT → QUESTION_FINISH → ANSWER_SHOW_START (empty payload).
   */
  private buildShowAnswerResult(
    gameId: string,
    playerAnswerResult: GameStateAnsweredPlayerData,
    questionData: PackageQuestionDTO | null,
    timer: GameStateTimerDTO | null,
    nextTurnPlayerId: number | null
  ): GameActionHandlerResult<QuestionAnswerResultEventPayload> {
    const answerResultPayload = QuestionAnswerResultLogic.buildSocketPayload({
      answerResult: playerAnswerResult,
      timer,
    });

    const questionFinishPayload: QuestionFinishWithAnswerEventPayload = {
      answerFiles: questionData?.answerFiles ?? null,
      answerText: questionData?.answerText ?? null,
      nextTurnPlayerId,
      answerResult: playerAnswerResult,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: answerResultPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      },
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: questionFinishPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      },
      {
        event: SocketIOGameEvents.ANSWER_SHOW_START,
        data: {} satisfies AnswerShowStartEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      },
    ];

    return { success: true, data: answerResultPayload, broadcasts };
  }

  private buildContinueQuestionResult(
    gameId: string,
    playerAnswerResult: GameStateAnsweredPlayerData,
    timer: GameStateTimerDTO | null
  ): GameActionHandlerResult<QuestionAnswerResultEventPayload> {
    const resultPayload = QuestionAnswerResultLogic.buildSocketPayload({
      answerResult: playerAnswerResult,
      timer,
    });

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: resultPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      },
    ];

    return { success: true, data: resultPayload, broadcasts };
  }
}
