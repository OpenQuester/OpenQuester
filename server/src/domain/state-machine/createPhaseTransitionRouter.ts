import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalAnsweringToReviewingHandler } from "domain/state-machine/handlers/final-round/FinalAnsweringToReviewingHandler";
import { FinalBiddingToAnsweringHandler } from "domain/state-machine/handlers/final-round/FinalBiddingToAnsweringHandler";
import { FinalReviewingToResultsHandler } from "domain/state-machine/handlers/final-round/FinalReviewingToResultsHandler";
import { ThemeEliminationToBiddingHandler } from "domain/state-machine/handlers/final-round/ThemeEliminationToBiddingHandler";
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
    // Final round transitions
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

    // TODO: Add more handlers as they are implemented:
    // - Regular round handlers
    // - Special question handlers
  ];

  return new PhaseTransitionRouter(gameService, logger, handlers);
}
