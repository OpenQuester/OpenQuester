import { GameCompletionResult } from "domain/types/game/GameCompletionResult";

export interface IGameLifecycleService {
  /**
   * Handle game completion sequence including statistics collection
   * @param gameId - The game ID to complete
   */
  handleGameCompletion(gameId: string): Promise<GameCompletionResult>;
}
