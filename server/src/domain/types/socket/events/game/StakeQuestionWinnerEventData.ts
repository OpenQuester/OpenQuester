/**
 * Data sent when a stake question bidding phase is complete and winner is determined
 */
export interface StakeQuestionWinnerEventData {
  /** The player who won the bidding */
  winnerPlayerId: number;
  /** The final winning bid amount */
  finalBid: number | null;
}
