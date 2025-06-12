import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";

export class GameStateValidator {
  /**
   * Throws an error if game is paused/finished/not started.
   */
  public static validateGameInProgress(game: Game) {
    this.validateGameStarted(game);
    this.validateGameNotPaused(game);
    this.validateGameNotFinished(game);
  }

  /**
   * Throws an error if game is finished.
   */
  public static validateGameNotFinished(game: Game) {
    if (game.finishedAt !== null) {
      throw new ClientError(ClientResponse.GAME_FINISHED);
    }
  }

  /**
   * Throws an error if game has not started yet.
   */
  public static validateGameStarted(game: Game) {
    if (game.startedAt === null || game.gameState === null) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }
  }

  /**
   * Throws an error if game is paused.
   */
  public static validateGameNotPaused(game: Game) {
    if (game.gameState.isPaused) {
      throw new ClientError(ClientResponse.GAME_IS_PAUSED);
    }
  }
}
