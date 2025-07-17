/**
 * Enum for question-related actions to replace magic strings
 * and provide type safety for validation logic
 */
export enum QuestionAction {
  ANSWER = "ANSWER",
  PLAYER_SKIP = "PLAYER_SKIP",
  SUBMIT_ANSWER = "SUBMIT_ANSWER",
  RESULT = "RESULT",
  SKIP = "SKIP",
  PICK = "PICK",
}
