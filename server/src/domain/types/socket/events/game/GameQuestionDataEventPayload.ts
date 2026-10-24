import { QuestionContentPlanDTO } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";

export interface GameQuestionDataEventPayload {
  data: PackageQuestionDTO | SimplePackageQuestionDTO;
  timer: GameStateTimerDTO;
  /** Players eligible to participate in the current question */
  questionEligiblePlayers?: number[] | null;
  /**
   * Content timeline on this payload's timer. Absent while media is still
   * preloading (it then arrives with media-download-status).
   */
  contentPlan?: QuestionContentPlanDTO | null;
  /** Position on this payload's timer (ms) when the buzzer opens; 0 = open now */
  buzzerOpensAtMs?: number | null;
}
