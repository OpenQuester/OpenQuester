import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GameEventBroadcastService } from "application/services/game/GameEventBroadcastService";
import { GameLifecycleService } from "application/services/game/GameLifecycleService";
import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { GameProgressionContext } from "domain/types/game/GameProgressionContext";
import { GameProgressionResult } from "domain/types/game/GameProgressionResult";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Service responsible for coordinating game progression operations.
 * Orchestrates the complete flow of game progression, broadcasting, and lifecycle events.
 */
@singleton()
export class GameProgressionCoordinator {
  constructor(
    private readonly gameLifecycleService: GameLifecycleService,
    private readonly gameEventBroadcastService: GameEventBroadcastService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Process game progression including broadcasts and lifecycle operations
   * @param context - The game progression context
   */
  public async processGameProgression(
    context: GameProgressionContext
  ): Promise<GameProgressionResult> {
    const { game, isGameFinished, nextGameState, questionFinishData } = context;
    const broadcasts: SocketEventBroadcast[] = [];

    try {
      // Always add question finish broadcast if we have finish data
      if (questionFinishData) {
        broadcasts.push(
          this.gameEventBroadcastService.createQuestionFinishBroadcast(
            questionFinishData,
            game.id
          )
        );
      }

      // Handle game finished scenario
      if (isGameFinished) {
        broadcasts.push(
          this.gameEventBroadcastService.createGameFinishedBroadcast(game.id)
        );

        // Execute game completion sequence (statistics collection)
        const completionResult =
          await this.gameLifecycleService.handleGameCompletion(game.id);

        if (!completionResult.success) {
          this.logger.warn(
            "Game completion had issues but progression continues",
            {
              prefix: LogPrefix.GAME,
              gameId: game.id,
              error: completionResult.error,
            }
          );
        }

        return {
          success: true,
          broadcasts,
        };
      }

      // Handle next round scenario
      if (nextGameState) {
        broadcasts.push(
          this.gameEventBroadcastService.createNextRoundBroadcast(
            nextGameState,
            game.id
          )
        );

        return {
          success: true,
          broadcasts,
          data: { gameState: nextGameState },
        };
      }

      // No progression needed - just return question finish if applicable
      return {
        success: true,
        broadcasts,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error("Failed to process game progression", {
        prefix: LogPrefix.GAME,
        gameId: game.id,
        isGameFinished,
        hasNextGameState: !!nextGameState,
        error: errorMessage,
      });

      // Return what we can, even if there was an error
      return {
        success: false,
        broadcasts,
      };
    }
  }
}
