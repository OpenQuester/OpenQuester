import { GameProgressionContext } from "domain/types/game/GameProgressionContext";
import { GameProgressionResult } from "domain/types/game/GameProgressionResult";

export interface IGameProgressionCoordinator {
  /**
   * Process game progression including broadcasts and lifecycle operations
   * @param context - The game progression context
   */
  processGameProgression(
    context: GameProgressionContext
  ): Promise<GameProgressionResult>;
}
