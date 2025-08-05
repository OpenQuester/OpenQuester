import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";

/**
 * Value class representing a bid in a Stake question
 * Encapsulates bid amount and type with validation and factory methods
 */
export class StakeBid {
  private constructor(
    private readonly amount: number | null,
    private readonly type: StakeBidType
  ) {
    //
  }

  /**
   * Creates a PASS bid (no amount)
   */
  public static pass(): StakeBid {
    return new StakeBid(null, StakeBidType.PASS);
  }

  /**
   * Creates an ALL_IN bid with the player's entire score
   * @param amount The all-in amount (player's total score)
   */
  public static allIn(amount: number): StakeBid {
    return new StakeBid(amount, StakeBidType.ALL_IN);
  }

  /**
   * Creates a normal bid with a specific amount
   * @param amount The bid amount
   */
  public static normal(amount: number): StakeBid {
    return new StakeBid(amount, StakeBidType.NORMAL);
  }

  /**
   * @returns The bid amount (null for PASS bids)
   */
  public getAmount(): number | null {
    return this.amount;
  }

  public getType(): StakeBidType {
    return this.type;
  }

  public isPass(): boolean {
    return this.type === StakeBidType.PASS;
  }
}
