import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";

/**
 * Interface for creating standardized game event broadcasts
 */
export interface IGameEventBroadcastService {
  createGameFinishedBroadcast(gameId: string): SocketEventBroadcast;

  createNextRoundBroadcast(
    gameState: GameStateDTO,
    gameId: string
  ): SocketEventBroadcast;

  createQuestionFinishBroadcast(
    payload: QuestionFinishEventPayload,
    gameId: string
  ): SocketEventBroadcast;
}
