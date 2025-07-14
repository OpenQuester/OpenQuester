/**
 * Data for reviewing final round answers
 */
export interface FinalAnswerReviewInputData {
  answerId: string;
  isCorrect: boolean;
}

export interface FinalAnswerReviewOutputData {
  answerId: string;
  playerId: number;
  isCorrect: boolean;
  scoreChange: number;
}
