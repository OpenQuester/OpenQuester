import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { Game } from "domain/entities/game/Game";
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
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
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
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {}

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

    const shouldFinishQuestion =
      playerAnswerResult.answerType === AnswerResultType.CORRECT ||
      allPlayersSkipped;

    if (shouldFinishQuestion) {
      const questionData = allPlayersSkipped ? skippedQuestion : question;
      return this.buildQuestionFinishResult(
        game.id,
        playerAnswerResult,
        questionData ?? null,
        game
      );
    }

    return this.buildContinueQuestionResult(game.id, playerAnswerResult, timer);
  }

  private async buildQuestionFinishResult(
    gameId: string,
    playerAnswerResult: GameStateAnsweredPlayerData,
    questionData: PackageQuestionDTO | null,
    game: Game
  ): Promise<GameActionHandlerResult<QuestionAnswerResultEventPayload>> {
    const { isGameFinished, nextGameState } =
      await this.socketIOQuestionService.handleRoundProgression(game);

    const progressionResult =
      await this.gameProgressionCoordinator.processGameProgression({
        game,
        isGameFinished,
        nextGameState,
        questionFinishData: {
          answerFiles: questionData?.answerFiles ?? null,
          answerText: questionData?.answerText ?? null,
          nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
        },
      });

    const answerResultPayload: QuestionAnswerResultEventPayload = {
      answerResult: playerAnswerResult,
      timer: null,
    };

    const questionFinishWithAnswer: QuestionFinishWithAnswerEventPayload = {
      answerFiles: questionData?.answerFiles ?? null,
      answerText: questionData?.answerText ?? null,
      nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
      answerResult: playerAnswerResult,
    };

    const additionalBroadcasts = progressionResult.broadcasts.filter(
      (broadcast) => broadcast.event !== SocketIOGameEvents.QUESTION_FINISH
    );

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: answerResultPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      },
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: questionFinishWithAnswer,
        target: SocketBroadcastTarget.GAME,
        gameId,
      },
      ...(additionalBroadcasts as SocketEventBroadcast<unknown>[]),
    ];

    return { success: true, data: answerResultPayload, broadcasts };
  }

  private buildContinueQuestionResult(
    gameId: string,
    playerAnswerResult: GameStateAnsweredPlayerData,
    timer: GameStateTimerDTO | null
  ): GameActionHandlerResult<QuestionAnswerResultEventPayload> {
    const resultPayload: QuestionAnswerResultEventPayload = {
      answerResult: playerAnswerResult,
      timer,
    };

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
