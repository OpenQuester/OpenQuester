import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";

/**
 * Logic class for handling question showing timer expiration.
 * Extracts broadcast building from TimerExpirationService.handleQuestionShowingExpiration.
 */
export class QuestionShowingExpirationLogic {
  /**
   * Build the broadcasts for question finish.
   */
  public static buildQuestionFinishBroadcast(
    game: Game,
    question: PackageQuestionDTO,
    gameId: string
  ): BroadcastEvent {
    return {
      event: SocketIOGameEvents.QUESTION_FINISH,
      data: {
        answerFiles: question.answerFiles ?? null,
        answerText: question.answerText ?? null,
        nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
      } satisfies QuestionFinishEventPayload,
      room: gameId,
    };
  }

  /**
   * Determine if round progression is needed.
   */
  public static shouldProgressRound(game: Game): boolean {
    return game.isAllQuestionsPlayed() ?? false;
  }
}
