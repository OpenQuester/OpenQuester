/** Data saved to game state in order to understand current stake question state */
export interface StakeQuestionGameData {
  /** The player who originally picked the stake question */
  pickerPlayerId: number;
  /** Question ID being bid on */
  questionId: number;
  /** Maximum bid allowed for this question (null means no limit) */
  maxPrice: number | null;
  /** Current bids from all players (playerId -> highest bid amount) */
  bids: Record<number, number | null>;
  /** Players who have passed and are out of bidding */
  passedPlayers: number[];
  /** Order of players for sequential bidding */
  biddingOrder: number[];
  /** Current player's turn to bid (index in biddingOrder) */
  currentBidderIndex: number;
  /** Highest bid amount so far */
  highestBid: number | null;
  /** Player ID who placed the highest bid (winner) */
  winnerPlayerId: number | null;
  /** Whether currently in bidding phase */
  biddingPhase: boolean;
}
