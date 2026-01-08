import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalAnsweringToReviewingHandler } from "domain/state-machine/handlers/final-round/FinalAnsweringToReviewingHandler";
import { FinalBiddingToAnsweringHandler } from "domain/state-machine/handlers/final-round/FinalBiddingToAnsweringHandler";
import { FinalReviewingToGameFinishHandler } from "domain/state-machine/handlers/final-round/FinalReviewingToGameFinishHandler";
import { ThemeEliminationToBiddingHandler } from "domain/state-machine/handlers/final-round/ThemeEliminationToBiddingHandler";
import { ChoosingToMediaDownloadingHandler } from "domain/state-machine/handlers/regular-round/ChoosingToMediaDownloadingHandler";
import { AnsweringToShowingAnswerHandler } from "domain/state-machine/handlers/regular-round/AnsweringToShowingAnswerHandler";
import { AnsweringToShowingHandler } from "domain/state-machine/handlers/regular-round/AnsweringToShowingHandler";
import { MediaDownloadingToShowingHandler } from "domain/state-machine/handlers/regular-round/MediaDownloadingToShowingHandler";
import { ShowingAnswerToGameFinishHandler } from "domain/state-machine/handlers/regular-round/ShowingAnswerToGameFinishHandler";
import { ShowingAnswerToChoosingHandler } from "domain/state-machine/handlers/regular-round/ShowingAnswerToChoosingHandler";
import { ShowingAnswerToThemeEliminationHandler } from "domain/state-machine/handlers/regular-round/ShowingAnswerToThemeEliminationHandler";
import { ShowingToShowingAnswerHandler } from "domain/state-machine/handlers/regular-round/ShowingToShowingAnswerHandler";
import { ShowingToAnsweringHandler } from "domain/state-machine/handlers/regular-round/ShowingToAnsweringHandler";
import { ChoosingToSecretTransferHandler } from "domain/state-machine/handlers/special-question/ChoosingToSecretTransferHandler";
import { ChoosingToStakeBiddingHandler } from "domain/state-machine/handlers/special-question/ChoosingToStakeBiddingHandler";
import { ChoosingToShowingFallbackHandler } from "domain/state-machine/handlers/special-question/ChoosingToShowingFallbackHandler";
import { SecretTransferToAnsweringHandler } from "domain/state-machine/handlers/special-question/SecretTransferToAnsweringHandler";
import { StakeBiddingToShowingHandler } from "domain/state-machine/handlers/special-question/StakeBiddingToShowingHandler";
import { TransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Creates all transition handlers and the router.
 *
 * This is the single place where all handlers are registered.
 * Add new handlers here as they are implemented.
 */
export function createPhaseTransitionRouter(
  gameService: GameService,
  timerService: SocketQuestionStateService,
  roundHandlerFactory: RoundHandlerFactory,
  logger: ILogger
): PhaseTransitionRouter {
  const handlers: TransitionHandler[] = [
    // =========================================================================
    // Final Round Transitions
    // =========================================================================
    new ThemeEliminationToBiddingHandler(
      gameService,
      timerService,
      roundHandlerFactory
    ),
    new FinalBiddingToAnsweringHandler(
      gameService,
      timerService,
      roundHandlerFactory
    ),
    new FinalAnsweringToReviewingHandler(gameService, timerService),
    new FinalReviewingToGameFinishHandler(
      gameService,
      timerService,
      roundHandlerFactory
    ),

    // =========================================================================
    // Regular Round Transitions
    // =========================================================================

    // Question picked (special): CHOOSING → SECRET_TRANSFER / STAKE_BIDDING
    new ChoosingToSecretTransferHandler(gameService, timerService),
    new ChoosingToStakeBiddingHandler(gameService, timerService),

    // Fallback when no eligible players for special questions: CHOOSING → SHOWING
    new ChoosingToShowingFallbackHandler(gameService, timerService),

    // Question picked (normal): CHOOSING → MEDIA_DOWNLOADING
    new ChoosingToMediaDownloadingHandler(gameService, timerService),

    // Player buzzes to answer: SHOWING → ANSWERING
    new ShowingToAnsweringHandler(gameService, timerService),

    // Question ends without answer: SHOWING → SHOWING_ANSWER
    new ShowingToShowingAnswerHandler(gameService, timerService),

    // Wrong answer (players remaining): ANSWERING → SHOWING
    new AnsweringToShowingHandler(gameService, timerService),

    // Correct answer or all players exhausted: ANSWERING → SHOWING_ANSWER
    new AnsweringToShowingAnswerHandler(gameService, timerService),

    // Answer display complete: SHOWING_ANSWER → GAME_FINISHED (last question, no final round)
    new ShowingAnswerToGameFinishHandler(gameService, timerService),

    // Answer display complete: SHOWING_ANSWER → FINAL_THEME_ELIMINATION (next round is final)
    new ShowingAnswerToThemeEliminationHandler(
      gameService,
      timerService,
      roundHandlerFactory
    ),

    // Answer display complete: SHOWING_ANSWER → CHOOSING (continue regular rounds)
    new ShowingAnswerToChoosingHandler(
      gameService,
      timerService,
      roundHandlerFactory
    ),

    // Media download complete/timeout: MEDIA_DOWNLOADING → SHOWING
    new MediaDownloadingToShowingHandler(gameService, timerService),

    // =========================================================================
    // Special Question Transitions
    // =========================================================================

    // Stake question bidding complete: STAKE_BIDDING → ANSWERING
    new StakeBiddingToShowingHandler(gameService, timerService),

    // Secret question transferred: SECRET_QUESTION_TRANSFER → ANSWERING
    new SecretTransferToAnsweringHandler(gameService, timerService),
  ];

  return new PhaseTransitionRouter(logger, handlers);
}
