import type { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import type { PublicSecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";

export interface SecretQuestionPickedBroadcastData {
  secretQuestionData?: PublicSecretQuestionGameData | null;
  timer?: GameStateTimerDTO | null;
  /** The player who picked the secret question */
  pickerPlayerId: number;
  /** Transfer type determining who can receive the question */
  transferType: PackageQuestionTransferType;
  /** Question ID for reference */
  questionId: number;
  /** Players eligible to participate in the current question */
  questionEligiblePlayers?: number[] | null;
}
