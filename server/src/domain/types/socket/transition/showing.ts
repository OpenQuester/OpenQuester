import { GameStateDTO } from "../../dto/game/state/GameStateDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

export type ShowingToAnsweringMutationData = {
  playerId: number;
};

export type ShowingToShowingAnswerMutationData = {
  question: PackageQuestionDTO | null;
};

export type ShowingAnswerToChoosingMutationData = {
  isRoundFinished: boolean;
  isGameFinished: boolean;
  nextGameState: GameStateDTO | null;
};

export type ShowingAnswerToThemeEliminationMutationData = {
  nextGameState: GameStateDTO;
};
