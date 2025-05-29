import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

export interface QuestionAnswerResultEventPayload {
  answerResult: GameStateAnsweredPlayerData;
  timer: GameStateTimerDTO | null;
}
