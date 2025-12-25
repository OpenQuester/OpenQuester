import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionAnswerResultLogic } from "domain/logic/question/QuestionAnswerResultLogic";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";

export interface AnsweringExpirationMutation {
  answerResult: GameStateAnsweredPlayerData;
  nextState: QuestionState;
  scoreResult: number;
}

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
   * Process wrong answer due to timeout.
   */
  public static processWrongAnswer(
    game: Game,
    question: PackageQuestionDTO
  ): AnsweringExpirationMutation {
    const nextState = QuestionState.SHOWING;
    const scoreResult = question.price !== null ? -question.price : 0;

    const answerResult = game.handleQuestionAnswer(
      scoreResult,
      AnswerResultType.WRONG,
      nextState
    );

    return {
      answerResult,
      nextState,
      scoreResult,
    };
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
        timer,
      }),
      room: gameId,
    };
  }
}
