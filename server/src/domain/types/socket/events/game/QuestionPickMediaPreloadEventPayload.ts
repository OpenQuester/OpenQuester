import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { type PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";

export interface QuestionPickMediaPreloadEventPayload {
  questionId: number;
  questionFiles: PackageQuestionFileDTO[];
  timer: GameStateTimerDTO;
}
