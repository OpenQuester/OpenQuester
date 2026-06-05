import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { GameService } from "application/services/game/GameService";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

/**
 * Service for managing question state transitions.
 */
@singleton()
export class SocketQuestionStateService {
  constructor(
    private readonly gameService: GameService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * General timer setup strategy, using given duration and question state
   *
   * Caller should update game state
   */
  public async setupQuestionTimer(game: Game, durationMs: number): Promise<GameStateTimer> {
    this.logger.debug("Setting up question timer", {
      prefix: LogPrefix.SOCKET_QUESTION,
      gameId: game.id,
      durationMs
    });

    const timer = new GameStateTimer(durationMs);

    game.gameState.timer = timer.start();

    await this.gameService.saveTimer(timer.value()!, game.id);

    return timer;
  }
}
