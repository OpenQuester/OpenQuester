export enum AnswerResultType {
  CORRECT = "correct",
  WRONG = "wrong",
  SKIP = "skip",
}

export interface AnswerResultData {
  /** any positive number handled as correct, negative - incorrect, 0 - skip */
  scoreResult: number;
  answerType: AnswerResultType;
}
