import { QuestionState } from "domain/types/dto/game/state/QuestionState";

/**
 * Payload for timer expiration actions
 */
export interface TimerActionPayload {
  timerKey: string;
  questionState: QuestionState | null;
  expirationTime: Date;
}
