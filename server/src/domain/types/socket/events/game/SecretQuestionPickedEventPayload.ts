import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";

export interface SecretQuestionPickedBroadcastData {
  /** The player who picked the secret question */
  pickerPlayerId: number;
  /** Transfer type determining who can receive the question */
  transferType: PackageQuestionTransferType;
  /** Question ID for reference */
  questionId: number;
  /** Players eligible to participate in the current question */
  questionEligiblePlayers?: number[] | null;
}
