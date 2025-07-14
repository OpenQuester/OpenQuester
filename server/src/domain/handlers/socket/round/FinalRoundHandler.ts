import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import {
  BaseRoundHandler,
  RoundProgressionOptions,
  RoundProgressionResult,
} from "domain/handlers/socket/round/BaseRoundHandler";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { FinalRoundTurnManager } from "domain/utils/FinalRoundTurnManager";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handler for final round type with specific game mechanics:
 * 1. Theme elimination phase where players eliminate unwanted themes
 * 2. Text answer submission phase with 75-second timer
 * 3. Showman review phase where answers are marked correct/wrong (nominal scoring only)
 * 4. Game finish after final round completion
 */
export class FinalRoundHandler extends BaseRoundHandler {
  constructor() {
    super(PackageRoundType.FINAL);
  }

  public async handleRoundProgression(
    game: Game,
    options: RoundProgressionOptions = {}
  ): Promise<RoundProgressionResult> {
    this.validateGameState(game);
    this.validateRoundProgression(game);

    const { forced = false } = options;

    // Final round is always the last round - completing it finishes the game
    if (forced || this.isFinalQuestionComplete(game)) {
      game.finish();
      return {
        isGameFinished: true,
        nextGameState: null,
      };
    }

    return {
      isGameFinished: false,
      nextGameState: null,
    };
  }

  public validateRoundProgression(game: Game): void {
    this.validateGameState(game);
    GameStateValidator.validateGameInProgress(game);

    // Ensure current round exists
    if (!game.gameState.currentRound) {
      throw new ClientError(ClientResponse.ROUND_CURRENT_ROUND_REQUIRED);
    }

    // Ensure it's actually a final round
    if (game.gameState.currentRound.type !== PackageRoundType.FINAL) {
      throw new ClientError(ClientResponse.INVALID_ROUND_TYPE);
    }
  }

  public getValidQuestionStates(): QuestionState[] {
    // Final round uses specific question states for its phases
    return [
      QuestionState.CHOOSING, // Theme elimination
      QuestionState.BIDDING, // Bid submission
      QuestionState.ANSWERING, // Answer submission
      QuestionState.REVIEWING, // Answer review by showman
    ];
  }

  /**
   * Check if all themes except one have been eliminated
   * Final round should progress when only one theme remains
   */
  public isThemeEliminationComplete(game: Game): boolean {
    if (!game.gameState || !game.gameState.currentRound) {
      return false;
    }

    const currentRound = game.gameState.currentRound;
    const activeThemes = currentRound.themes.filter(
      (theme) => !theme.questions?.some((q) => q.isPlayed)
    );

    // Theme elimination is complete when only one theme remains
    return activeThemes.length <= 1;
  }

  /**
   * Check if the final question has been answered and reviewed
   */
  public isFinalQuestionComplete(game: Game): boolean {
    if (!game.gameState || !game.gameState.currentRound) {
      return false;
    }

    const { played } = GameQuestionMapper.getPlayedAndAllQuestions(
      game.gameState
    );

    // In final round, we only need the remaining question to be played
    return this.isThemeEliminationComplete(game) && played.length > 0;
  }

  /**
   * Get the remaining active theme after elimination
   */
  public getRemainingTheme(game: Game) {
    if (!game.gameState || !game.gameState.currentRound) {
      return null;
    }

    const currentRound = game.gameState.currentRound;
    const activeThemes = currentRound.themes.filter(
      (theme) => !theme.questions?.some((q) => q.isPlayed)
    );

    return activeThemes.length === 1 ? activeThemes[0] : null;
  }

  /**
   * Initialize turn order for theme elimination
   * Should be called when final round starts
   */
  public initializeTurnOrder(game: Game): number[] {
    return FinalRoundTurnManager.initializeTurnOrder(game);
  }

  /**
   * Get current player whose turn it is to eliminate a theme
   */
  public getCurrentTurnPlayer(game: Game, turnOrder: number[]): number | null {
    return FinalRoundTurnManager.getCurrentTurnPlayer(game, turnOrder);
  }

  /**
   * Check if it's a specific player's turn to eliminate
   */
  public isPlayerTurn(
    game: Game,
    playerId: number,
    turnOrder: number[]
  ): boolean {
    return FinalRoundTurnManager.isPlayerTurn(game, playerId, turnOrder);
  }

  /**
   * Get all active themes that can be eliminated
   */
  public getActiveThemes(game: Game) {
    return FinalRoundTurnManager.getActiveThemes(game);
  }
}
