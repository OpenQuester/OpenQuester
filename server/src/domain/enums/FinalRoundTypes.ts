/**
 * Enums for final round specific error and status types
 */

export enum FinalAnswerLossReason {
  EMPTY_ANSWER = "empty_answer",
  TIMEOUT = "timeout",
}

export enum FinalAnswerType {
  CORRECT = "correct",
  WRONG = "wrong",
  AUTO_LOSS = "auto_loss",
}
