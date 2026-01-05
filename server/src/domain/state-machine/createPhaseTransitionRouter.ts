import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalAnsweringToReviewingHandler } from "domain/state-machine/handlers/final-round/FinalAnsweringToReviewingHandler";
import { FinalBiddingToAnsweringHandler } from "domain/state-machine/handlers/final-round/FinalBiddingToAnsweringHandler";
import { FinalReviewingToResultsHandler } from "domain/state-machine/handlers/final-round/FinalReviewingToResultsHandler";
import { ThemeEliminationToBiddingHandler } from "domain/state-machine/handlers/final-round/ThemeEliminationToBiddingHandler";
import { ChoosingToMediaDownloadingHandler } from "domain/state-machine/handlers/regular-round/ChoosingToMediaDownloadingHandler";
import { AnsweringToShowingAnswerHandler } from "domain/state-machine/handlers/regular-round/AnsweringToShowingAnswerHandler";
import { AnsweringToShowingHandler } from "domain/state-machine/handlers/regular-round/AnsweringToShowingHandler";
import { MediaDownloadingToShowingHandler } from "domain/state-machine/handlers/regular-round/MediaDownloadingToShowingHandler";
import { ShowingAnswerToChoosingHandler } from "domain/state-machine/handlers/regular-round/ShowingAnswerToChoosingHandler";
import { ShowingToChoosingHandler } from "domain/state-machine/handlers/regular-round/ShowingToChoosingHandler";
import { ShowingToAnsweringHandler } from "domain/state-machine/handlers/regular-round/ShowingToAnsweringHandler";
import { SecretTransferToAnsweringHandler } from "domain/state-machine/handlers/special-question/SecretTransferToAnsweringHandler";
import { StakeBiddingToAnsweringHandler } from "domain/state-machine/handlers/special-question/StakeBiddingToAnsweringHandler";
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
    new FinalReviewingToResultsHandler(
      gameService,
      timerService,
      roundHandlerFactory
    ),

    // =========================================================================
    // Regular Round Transitions
    // =========================================================================

    // Question picked (normal): CHOOSING → MEDIA_DOWNLOADING
    new ChoosingToMediaDownloadingHandler(gameService, timerService),

    // Player buzzes to answer: SHOWING → ANSWERING
    new ShowingToAnsweringHandler(gameService, timerService),

    // Wrong answer (players remaining): ANSWERING → SHOWING
    new AnsweringToShowingHandler(gameService, timerService),

    // Correct answer or all players exhausted: ANSWERING → SHOWING_ANSWER
    new AnsweringToShowingAnswerHandler(gameService, timerService),

    // Answer display complete: SHOWING_ANSWER → CHOOSING (with round progression check)
    new ShowingAnswerToChoosingHandler(
      gameService,
      timerService,
      roundHandlerFactory
    ),

    // Media download complete/timeout: MEDIA_DOWNLOADING → SHOWING
    new MediaDownloadingToShowingHandler(gameService, timerService),

    // Showing timeout: SHOWING → CHOOSING
    new ShowingToChoosingHandler(
      gameService,
      timerService,
      roundHandlerFactory
    ),

    // =========================================================================
    // Special Question Transitions
    // =========================================================================

    // Stake question bidding complete: STAKE_BIDDING → ANSWERING
    new StakeBiddingToAnsweringHandler(gameService, timerService),

    // Secret question transferred: SECRET_QUESTION_TRANSFER → ANSWERING
    new SecretTransferToAnsweringHandler(gameService, timerService),
  ];

  return new PhaseTransitionRouter(logger, handlers);
}
