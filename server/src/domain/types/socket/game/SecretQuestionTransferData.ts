export interface SecretQuestionTransferInputData {
  /** ID of the player who should receive the secret question */
  targetPlayerId: number;
}

export interface SecretQuestionTransferBroadcastData {
  /** The player who transferred the question */
  fromPlayerId: number;
  /** The player who received the question */
  toPlayerId: number;
  /** Question ID for reference */
  questionId: number;
}
