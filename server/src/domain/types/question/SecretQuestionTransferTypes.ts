import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SecretQuestionTransferBroadcastData } from "domain/types/socket/game/SecretQuestionTransferData";

/**
 * Result of secret question transfer action.
 * Contains all data needed for socket handler's afterBroadcast to perform
 * personalized emissions (different question data for showman vs players).
 */
export interface SecretQuestionTransferResult
  extends SecretQuestionTransferBroadcastData {
  gameId: string;
  /** Timer data for question display */
  timer: GameStateTimerDTO | null;
  /** Full question data (socket handler will filter per role) */
  question: PackageQuestionDTO | null;
  /** Round ID for question lookup */
  roundId: number | null;
}
