import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { SecretQuestionPickedBroadcastData } from "domain/types/socket/events/game/SecretQuestionPickedEventPayload";
import { StakeQuestionPickedBroadcastData } from "domain/types/socket/events/game/StakeQuestionPickedEventPayload";

export enum QuestionPickType {
  NORMAL = "normal",
  SECRET = "secret",
  STAKE = "stake",
}

/**
 * Result of question pick action.
 * Contains all data needed for socket handler's afterBroadcast to perform
 * personalized emissions (different data for showman vs players).
 */
export interface QuestionPickResult {
  type: QuestionPickType;
  gameId: string;
  /** Timer data for question display */
  timer?: GameStateTimerDTO;
  /** Full question data (for normal questions - socket handler will filter per role) */
  question?: PackageQuestionDTO;
  /** Data for secret question broadcast */
  secretData?: SecretQuestionPickedBroadcastData;
  /** Data for stake question broadcast */
  stakeData?: StakeQuestionPickedBroadcastData;
  /** Automatic bid data when only one player eligible for stake question */
  automaticNominalBid?: PlayerBidData | null;
}
