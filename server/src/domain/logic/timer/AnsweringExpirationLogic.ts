import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionAnswerResultLogic } from "domain/logic/question/QuestionAnswerResultLogic";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";

/**
 * Logic class for handling answering timer expiration.
 * Extracts business logic from TimerExpirationService.handleAnsweringExpiration.
 */
export class AnsweringExpirationLogic {
  /**
   * Check if this is a final round answering expiration.
   */
  public static isFinalRoundExpiration(game: Game): boolean {
    return (
      TransitionGuards.isFinalRound(game) &&
      TransitionGuards.isQuestionState(game, QuestionState.ANSWERING)
    );
  }

  /**
   * Build broadcast for answer result.
   */
  public static buildBroadcast(
    gameId: string,
    answerResult: GameStateAnsweredPlayerData,
    timer: GameStateTimerDTO | null
  ): BroadcastEvent {
    return {
      event: SocketIOGameEvents.ANSWER_RESULT,
      data: QuestionAnswerResultLogic.buildSocketPayload({
        answerResult,
        timer
      }),
      room: gameId
    };
  }
}
