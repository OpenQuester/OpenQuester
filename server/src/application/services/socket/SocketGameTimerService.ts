import { GameService } from "application/services/game/GameService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { SECOND_MS } from "domain/constants/time";
import { Game } from "domain/entities/game/Game";
import {
  GamePauseLogic,
  GamePauseResult,
} from "domain/logic/timer/GamePauseLogic";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";

export class SocketGameTimerService {
  constructor(private readonly gameService: GameService) {
    //
  }

  public async pauseGameTimer(game: Game): Promise<GamePauseResult> {
    const gameState = game.gameState;
    const questionState = gameState.questionState;

    const timer = await this.gameService.getTimer(game.id);
    if (timer) {
      GamePauseLogic.updateTimerForPause(timer);
      // Save timer with elapsed time
      await this.gameService.saveTimer(
        timer,
        game.id,
        Math.ceil(GAME_TTL_IN_SECONDS * SECOND_MS * 1.25), // Convert to ms
        questionState!
      );
      // Clear existing timer to avoid expiration
      await this.gameService.clearTimer(game.id);
    }

    game.pause();
    game.setTimer(null);
    await this.gameService.updateGame(game);

    return GamePauseLogic.buildResult({ game, timer });
  }

  public async unpauseGameTimer(game: Game): Promise<GamePauseResult> {
    const questionState = game.gameState.questionState;

    const timer = await this.gameService.getTimer(game.id, questionState!);

    if (timer) {
      // Clear timer with elapsed time
      await this.gameService.clearTimer(game.id, questionState!);
      // Update timer with new time to expire
      const remainingMs = GamePauseLogic.calculateRemainingTime(timer);
      await this.gameService.saveTimer(timer, game.id, remainingMs);
    }

    game.unpause();
    game.setTimer(timer);
    await this.gameService.updateGame(game);

    return GamePauseLogic.buildResult({ game, timer });
  }

  /**
   * Saves current timer with updated elapsed time. This timer can be reused
   * later.
   *
   * For example: Save timer for question showing when someone pressed
   * answer button. After saving timer for question showing - new timer for
   * question answering is started. If player answered incorrect - timer for
   * question showing can be reused from point where it stopped.
   */
  public async saveElapsedTimer(
    game: Game,
    expireTimeMs: number,
    questionState: QuestionState
  ): Promise<void> {
    const elapsedTimer = game.gameState.timer!;
    GamePauseLogic.updateTimerForPause(elapsedTimer);

    await this.gameService.saveTimer(
      elapsedTimer,
      game.id,
      Math.ceil(expireTimeMs * 1.5), // Apply safety margin for latency
      questionState
    );
  }
}
