import { QuestionTransitionDTO } from "domain/types/dto/game/state/QuestionTransitionDTO";
import { QuestionContentPlanDTO } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";

export interface GameQuestionDataEventPayload {
  data: PackageQuestionDTO | SimplePackageQuestionDTO;
  timer: GameStateTimerDTO | null;
  questionTransition?: QuestionTransitionDTO | null;
  /** Players eligible to participate in the current question */
  questionEligiblePlayers?: number[] | null;
  /**
   * Prepared content stays frozen during MEDIA_DOWNLOADING; playback uses
   * the question timer subsequently delivered with media-download-status.
   */
  contentPlan?: QuestionContentPlanDTO | null;
  /** Position on this payload's timer (ms) when the buzzer opens; 0 = open now */
  buzzerOpensAtMs?: number | null;
}
