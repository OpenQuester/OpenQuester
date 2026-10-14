import { QuestionContentPlanDTO } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

export interface MediaDownloadStatusBroadcastData {
  playerId: number;
  mediaDownloaded: boolean;
  allPlayersReady: boolean;
  timer: GameStateTimerDTO | null;
  /** Set together with the SHOWING timer: the content timeline to play */
  contentPlan?: QuestionContentPlanDTO | null;
  /** Position on this payload's timer (ms) when the buzzer opens; 0 = open now */
  buzzerOpensAtMs?: number | null;
}
