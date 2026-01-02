import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { IGameLifecycleService } from "domain/interfaces/game/IGameLifecycleService";
import { GameCompletionResult } from "domain/types/game/GameCompletionResult";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Service responsible for handling game lifecycle operations
 * Centralizes game completion logic and statistics collection
 */
export class GameLifecycleService implements IGameLifecycleService {
  constructor(
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Handle game completion sequence including statistics collection
   * @param gameId - The game ID to complete
   */
  public async handleGameCompletion(
    gameId: string
  ): Promise<GameCompletionResult> {
    try {
      // Trigger statistics collection and persistence
      await this.gameStatisticsCollectorService.finishCollection(gameId);

      this.logger.info("Game completion handled successfully", {
        prefix: LogPrefix.STATS,
        gameId,
      });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.warn("Failed to execute game completion sequence", {
        prefix: LogPrefix.STATS,
        gameId,
        error: errorMessage,
      });

      // Return success false but don't throw - game progression should continue
      // Statistics persistence failure shouldn't block game flow
      return {
        success: false,
        error: `Statistics collection failed: ${errorMessage}`,
      };
    }
  }
}
