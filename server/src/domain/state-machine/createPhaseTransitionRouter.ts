import { AllPlayBiddingToMediaDownloadingHandler } from "domain/state-machine/handlers/all-play/AllPlayBiddingToMediaDownloadingHandler";
import { AllPlayReviewingToShowingAnswerHandler } from "domain/state-machine/handlers/all-play/AllPlayReviewingToShowingAnswerHandler";
import { ChoosingToAllPlayBiddingHandler } from "domain/state-machine/handlers/all-play/ChoosingToAllPlayBiddingHandler";
import { ShowingToAllPlayReviewingHandler } from "domain/state-machine/handlers/all-play/ShowingToAllPlayReviewingHandler";
import { FinalAnsweringToReviewingHandler } from "domain/state-machine/handlers/final-round/FinalAnsweringToReviewingHandler";
import { FinalBiddingToAnsweringHandler } from "domain/state-machine/handlers/final-round/FinalBiddingToAnsweringHandler";
import { FinalReviewingToGameFinishHandler } from "domain/state-machine/handlers/final-round/FinalReviewingToGameFinishHandler";
import { ThemeEliminationToBiddingHandler } from "domain/state-machine/handlers/final-round/ThemeEliminationToBiddingHandler";
import { ChoosingToMediaDownloadingHandler } from "domain/state-machine/handlers/regular-round/ChoosingToMediaDownloadingHandler";
import { AnsweringToShowingAnswerHandler } from "domain/state-machine/handlers/regular-round/AnsweringToShowingAnswerHandler";
import { AnsweringToShowingHandler } from "domain/state-machine/handlers/regular-round/AnsweringToShowingHandler";
import { MediaDownloadingToShowingHandler } from "domain/state-machine/handlers/regular-round/MediaDownloadingToShowingHandler";
import { FinalMediaToAnsweringHandler } from "domain/state-machine/handlers/final-round/FinalMediaToAnsweringHandler";
import { ShowingAnswerToGameFinishHandler } from "domain/state-machine/handlers/regular-round/ShowingAnswerToGameFinishHandler";
import { ShowingAnswerToChoosingHandler } from "domain/state-machine/handlers/regular-round/ShowingAnswerToChoosingHandler";
import { ShowingAnswerToThemeEliminationHandler } from "domain/state-machine/handlers/regular-round/ShowingAnswerToThemeEliminationHandler";
import { ShowingToShowingAnswerHandler } from "domain/state-machine/handlers/regular-round/ShowingToShowingAnswerHandler";
import { ShowingToAnsweringHandler } from "domain/state-machine/handlers/regular-round/ShowingToAnsweringHandler";
import { ChoosingToSecretTransferHandler } from "domain/state-machine/handlers/special-question/ChoosingToSecretTransferHandler";
import { ChoosingToStakeBiddingHandler } from "domain/state-machine/handlers/special-question/ChoosingToStakeBiddingHandler";
import { ChoosingToShowingFallbackHandler } from "domain/state-machine/handlers/special-question/ChoosingToShowingFallbackHandler";
import { SecretTransferToAnsweringHandler } from "domain/state-machine/handlers/special-question/SecretTransferToAnsweringHandler";
import { StakeBiddingToAnsweringHandler } from "domain/state-machine/handlers/special-question/StakeBiddingToAnsweringHandler";
import { TransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { ILogger } from "shared/logging/ILogger";

/**
 * Creates all transition handlers and the router.
 *
 * This is the single place where all handlers are registered.
 * Add new handlers here as they are implemented.
 */
export function createPhaseTransitionRouter(logger: ILogger): PhaseTransitionRouter {
  const handlers: TransitionHandler[] = [
    // =========================================================================
    // Final Round Transitions
    // =========================================================================
    new ThemeEliminationToBiddingHandler(),
    new FinalBiddingToAnsweringHandler(),
    new FinalAnsweringToReviewingHandler(),
    new FinalReviewingToGameFinishHandler(),

    // =========================================================================
    // Regular Round Transitions
    // =========================================================================

    // Stake for everyone picked: CHOOSING → ALL_PLAY_BIDDING
    new ChoosingToAllPlayBiddingHandler(),

    // Question picked (special): CHOOSING → SECRET_TRANSFER / STAKE_BIDDING
    new ChoosingToSecretTransferHandler(),
    new ChoosingToStakeBiddingHandler(),

    // Fallback when no eligible players for special questions: CHOOSING → SHOWING
    new ChoosingToShowingFallbackHandler(),

    // Question picked (normal): CHOOSING → MEDIA_DOWNLOADING
    new ChoosingToMediaDownloadingHandler(),

    // Player buzzes to answer: SHOWING → ANSWERING
    new ShowingToAnsweringHandler(),

    // Everyone answered in writing (or time ran out): SHOWING → ALL_PLAY_REVIEWING
    new ShowingToAllPlayReviewingHandler(),

    // Timer expired, force skip, or all players skipped: SHOWING → SHOWING_ANSWER
    new ShowingToShowingAnswerHandler(),

    // Wrong answer (players remaining): ANSWERING → SHOWING
    new AnsweringToShowingHandler(),

    // Correct answer or all players exhausted: ANSWERING → SHOWING_ANSWER
    new AnsweringToShowingAnswerHandler(),

    // Answer display complete: SHOWING_ANSWER → GAME_FINISHED (last question, no final round)
    new ShowingAnswerToGameFinishHandler(),

    // Answer display complete: SHOWING_ANSWER → FINAL_THEME_ELIMINATION (next round is final)
    new ShowingAnswerToThemeEliminationHandler(),

    // Answer display complete: SHOWING_ANSWER → CHOOSING (continue regular rounds)
    new ShowingAnswerToChoosingHandler(),

    // Media download complete/timeout: MEDIA_DOWNLOADING → SHOWING
    new MediaDownloadingToShowingHandler(),
    new FinalMediaToAnsweringHandler(),

    // =========================================================================
    // Special Question Transitions
    // =========================================================================

    // Stake question bidding complete: STAKE_BIDDING → ANSWERING
    new StakeBiddingToAnsweringHandler(),

    // Secret question transferred: SECRET_QUESTION_TRANSFER → ANSWERING
    new SecretTransferToAnsweringHandler(),

    // =========================================================================
    // "Everyone answers" questions
    // =========================================================================

    // Stakes in: ALL_PLAY_BIDDING → MEDIA_DOWNLOADING
    new AllPlayBiddingToMediaDownloadingHandler(),

    // Every answer ruled on: ALL_PLAY_REVIEWING → SHOWING_ANSWER
    new AllPlayReviewingToShowingAnswerHandler()
  ];

  return new PhaseTransitionRouter(logger, handlers);
}
