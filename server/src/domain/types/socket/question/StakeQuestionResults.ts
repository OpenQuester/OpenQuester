import { Game } from "domain/entities/game/Game";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";

export interface StakeBidSubmitResult {
  game: Game;
  playerId: number;
  bidAmount: number | null;
  bidType: StakeBidType;
  isPhaseComplete: boolean;
  nextBidderId: number | null;
  winnerPlayerId: number | null;
  questionData: SimplePackageQuestionDTO | PackageQuestionDTO | null;
  timer?: GameStateTimerDTO;
}
