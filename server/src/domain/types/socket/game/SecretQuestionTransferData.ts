import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

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
  /** customPrice questions: the receiver now picks one of these prices */
  allowedPrices?: number[] | null;
  /** customPrice questions: the timer of the price pick */
  timer?: GameStateTimerDTO | null;
}

export interface SecretQuestionPriceInputData {
  /** One of the question's allowed prices */
  price: number;
}

export interface SecretQuestionPriceBroadcastData {
  /** The player who picked the price and answers the question */
  playerId: number;
  price: number;
  questionId: number;
}
