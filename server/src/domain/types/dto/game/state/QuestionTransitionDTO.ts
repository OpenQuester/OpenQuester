import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

/** The opening and media preparation share MEDIA_DOWNLOADING until both finish. */
export interface QuestionTransitionDTO {
  timer: GameStateTimerDTO;
  mediaReady: boolean;
  /** Original media viewers; empty means the showman is the sole loader. */
  mediaEligiblePlayerIds?: number[];
  /** Media timeout is a durable fallback, including reconnects during the closing fade. */
  timedOut?: boolean;
}
