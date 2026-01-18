import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";

/** Data saved to game state in order to understand current secret question state */
export interface SecretQuestionGameData {
  /** The player who originally picked the secret question */
  pickerPlayerId: number;
  /** Transfer restrictions for the question */
  transferType: PackageQuestionTransferType;
  /** Question ID being transferred */
  questionId: number;
  /** Whether currently in transfer phase (waiting for transfer decision) */
  transferDecisionPhase: boolean;
}
