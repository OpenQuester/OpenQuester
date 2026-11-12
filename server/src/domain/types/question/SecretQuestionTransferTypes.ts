import type { BroadcastEvent } from "domain/types/service/ServiceResult";
import type { DataMutation } from "domain/types/action/DataMutation";
import type { Game } from "domain/entities/game/Game";
import type { GameStateTimer } from "domain/entities/game/GameStateTimer";
import type { TransitionTrigger } from "domain/state-machine/types";
import type { TimerMutation } from "domain/types/action/ActionExecutionContext";
import type { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import type { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import type { SecretQuestionTransferBroadcastData } from "domain/types/socket/game/SecretQuestionTransferData";

export interface CompleteSecretQuestionTransferInput {
  targetPlayerId: number;
  question: PackageQuestionDTO;
  price?: number;
  trigger: TransitionTrigger;
  triggeredBy?: number;
}

/** A completed transfer, or a receiver waiting to select the question price. */
export interface SecretQuestionTransferContextResult {
  game: Game;
  fromPlayerId: number;
  toPlayerId: number;
  questionId: number;
  timer: GameStateTimer | null;
  broadcasts: BroadcastEvent[];
  additionalMutations: DataMutation[];
  /** Full data for role-specific broadcasts; null during price selection. */
  question: PackageQuestionDTO | null;
  allowedPrices: number[] | null;
  price: number | null;
  timerMutations: TimerMutation[];
}

/**
 * Result of secret question transfer action.
 * Carries the action result; broadcasts and role filtering are declared mutations.
 */
export interface SecretQuestionTransferResult extends SecretQuestionTransferBroadcastData {
  gameId: string;
  /** Timer data for question display */
  timer: GameStateTimerDTO | null;
  /** Full question data (socket handler will filter per role) */
  question: PackageQuestionDTO | null;
  /** Round ID for question lookup */
  roundId: number | null;
}

/** Result of a customPrice secret question's price pick */
export interface SecretQuestionPriceResult {
  gameId: string;
  playerId: number;
  price: number;
  questionId: number;
  timer: GameStateTimerDTO | null;
  question: PackageQuestionDTO | null;
}
