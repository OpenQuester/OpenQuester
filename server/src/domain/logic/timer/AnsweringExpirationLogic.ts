import { Game } from "domain/entities/game/Game";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";

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
}
