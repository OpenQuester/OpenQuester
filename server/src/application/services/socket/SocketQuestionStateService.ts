import { GameService } from "application/services/game/GameService";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";

export class SocketQuestionStateService {
  constructor(private readonly gameService: GameService) {
    //
  }

  /**
   * Updates question state with optional save operation
   */
  public async updateQuestionState(
    game: Game,
    questionState: QuestionState,
    opts?: { saveGame: boolean }
  ): Promise<Game | undefined> {
    if (game.gameState.questionState === questionState) {
      return;
    }

    game.gameState.questionState = questionState;

    if (opts?.saveGame) {
      await this.gameService.updateGame(game);
    }

    return game;
  }

  /**
   * Sets up timer for question answering phase
   */
  public async setupAnsweringTimer(
    game: Game,
    durationMs: number,
    answeringPlayerId: number
  ): Promise<GameStateTimer> {
    const timer = new GameStateTimer(durationMs);

    game.gameState.answeringPlayer = answeringPlayerId;
    game.gameState.questionState = QuestionState.ANSWERING;
    game.gameState.timer = timer.start();

    await this.gameService.updateGame(game);
    await this.gameService.saveTimer(timer.value()!, game.id);

    return timer;
  }

  /**
   * General timer setup strategy, using given duration and question state
   */
  public async setupQuestionTimer(
    game: Game,
    durationMs: number,
    questionState: QuestionState
  ): Promise<GameStateTimer> {
    const timer = new GameStateTimer(durationMs);

    await this.updateQuestionState(game, questionState, {
      saveGame: false,
    });

    game.gameState.timer = timer.start();

    await this.gameService.saveTimer(timer.value()!, game.id);

    return timer;
  }

  /**
   * Resets game to choosing state and clears timer
   */
  public async resetToChoosingState(game: Game): Promise<void> {
    game.resetToChoosingState();
    await this.gameService.updateGame(game);
    await this.gameService.clearTimer(game.id);
  }
}
