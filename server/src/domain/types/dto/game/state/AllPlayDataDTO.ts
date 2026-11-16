import type { WrongAnswerPenalty } from "domain/enums/game/GameSettings";
/** Which "everyone answers" question is being played */
export enum AllPlayMode {
  SIMPLE = "simple",
  /** No-risk for everyone: right wins price × multiplier, wrong costs nothing */
  NO_RISK = "noRisk",
  /** Stake for everyone: each player stakes, right wins the stake, wrong loses it */
  STAKE = "stake"
}

/** One player's part in an "everyone answers" question */
export interface AllPlayEntryDTO {
  playerId: number;
  /** Stake mode: the amount staked; null until staked */
  stake: number | null;
  /** Typed answer; null until submitted. Hidden from other players until review */
  answer: string | null;
  choiceOrder?: number;
  submitted: boolean;
  /** The showman's ruling; null until reviewed */
  isCorrect: boolean | null;
  /** Points gained or lost; set when reviewed */
  scoreChange: number | null;
}

/**
 * "Everyone answers" question (SIGame stakeAll / forAll): instead of a buzzer
 * race, every player answers in writing and the showman reviews each answer.
 *
 * Phases follow `questionState`: BIDDING (stake mode only, stakes are hidden)
 * → MEDIA_DOWNLOADING → SHOWING (players type answers once the content has
 * played) → REVIEWING (showman rules on each answer) → SHOWING_ANSWER.
 */
export interface AllPlayDataDTO {
  mode: AllPlayMode;
  questionId: number;
  themeId: number;
  /** Resolved actual base price, fixed when the question starts. */
  price: number;
  /** Stake mode: the package's upper limit for a stake */
  maxStake: number | null;
  /** No-risk mode: reward multiplier */
  priceMultiplier: number | null;
  /** Simple mode: room penalty fixed at start; absent legacy snapshots subtract. */
  wrongAnswerPenalty?: WrongAnswerPenalty;
  entries: AllPlayEntryDTO[];
}
