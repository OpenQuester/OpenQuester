import { QuestionTransitionDTO } from "domain/types/dto/game/state/QuestionTransitionDTO";
import { QuestionContentPlanDTO } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

export interface MediaDownloadStatusBroadcastData {
  playerId: number;
  mediaDownloaded: boolean;
  allPlayersReady: boolean;
  timer: GameStateTimerDTO | null;
  questionTransition?: QuestionTransitionDTO | null;
  /** May be prepared during the transition; only the SHOWING timer starts playback. */
  contentPlan?: QuestionContentPlanDTO | null;
  /** Position on this payload's timer (ms) when the buzzer opens; 0 = open now */
  buzzerOpensAtMs?: number | null;
  /** Final media readiness timed out and the game continued. */
  timedOut?: boolean;
}
