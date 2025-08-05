import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

/**
 * Data sent when a stake question is picked
 */
export interface StakeQuestionPickedBroadcastData {
  /** The player who picked the stake question */
  pickerPlayerId: number;
  /** Question ID for reference */
  questionId: number;
  /** Maximum bid allowed for this question (null means no limit) */
  maxPrice: number | null;
  /** Player order for sequential bidding */
  biddingOrder: number[];
  /** Timer for the bidding phase (30 seconds per bid) */
  timer: GameStateTimerDTO;
}
