import { ServerError } from "domain/errors/ServerError";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Value class representing a player's score in the game
 * Encapsulates score validation and bidding capacity logic for Stake questions
 */
export class PlayerScore {
  private constructor(private readonly amount: number) {
    if (!ValueUtils.isNumber(amount)) {
      throw new ServerError("PlayerScore amount must be a number");
    }
  }

  /**
   * Creates a new PlayerScore instance
   * @param amount The score amount (can be negative)
   */
  public static create(amount: number): PlayerScore {
    return new PlayerScore(amount);
  }

  public getAmount(): number {
    return this.amount;
  }

  /**
   * Checks if the player can afford a specific bid amount
   * @returns True if the player's score is >= bidAmount
   */
  public canAfford(bidAmount: number): boolean {
    if (!ValueUtils.isNumber(bidAmount) || bidAmount < 0) {
      return false;
    }
    return this.amount >= bidAmount;
  }

  /**
   * Gets the amount available for an all-in bid (the player's entire score)
   */
  public getAllInAmount(): number {
    return this.amount;
  }
}
