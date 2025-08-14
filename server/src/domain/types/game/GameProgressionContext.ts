import { Game } from "domain/entities/game/Game";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";

/**
 * Context information for game progression processing
 */
export interface GameProgressionContext {
  game: Game;
  isGameFinished: boolean;
  nextGameState: GameStateDTO | null;
  questionFinishData?: QuestionFinishEventPayload | null;
}
