/** A player pressed before the buzzer opened and is locked out for a moment */
export interface BuzzerFalseStartEventPayload {
  playerId: number;
  /** How long the lock lasts (ms), counted from when the event is sent */
  lockMs: number;
}
