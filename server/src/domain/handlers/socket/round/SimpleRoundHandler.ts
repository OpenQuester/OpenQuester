import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import {
  BaseRoundHandler,
  RoundProgressionOptions,
  RoundProgressionResult,
} from "domain/handlers/socket/round/BaseRoundHandler";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class SimpleRoundHandler extends BaseRoundHandler {
  constructor() {
    super(PackageRoundType.SIMPLE);
  }

  public async handleRoundProgression(
    game: Game,
    options: RoundProgressionOptions = {}
  ): Promise<RoundProgressionResult> {
    this.validateGameState(game);
    this.validateRoundProgression(game);

    const { forced = false } = options;

    // If forced (showman skip), always progress regardless of question completion
    if (forced) {
      const { isGameFinished, nextGameState } = this.getProgressionState(game);

      if (nextGameState) {
        game.gameState = nextGameState;
      }

      return { isGameFinished, nextGameState };
    }

    // Natural progression: Check if all questions in current round are played
    if (!this.isAllQuestionsPlayed(game)) {
      return { isGameFinished: false, nextGameState: null };
    }

    // All questions played, get next round or finish game
    const { isGameFinished, nextGameState } = this.getProgressionState(game);

    if (nextGameState) {
      game.gameState = nextGameState;
    }

    return { isGameFinished, nextGameState };
  }

  public validateRoundProgression(game: Game): void {
    this.validateGameState(game);
    GameStateValidator.validateGameInProgress(game);

    // Ensure current round exists
    if (!game.gameState.currentRound) {
      throw new ClientError(ClientResponse.ROUND_CURRENT_ROUND_REQUIRED);
    }
  }

  public getValidQuestionStates(): QuestionState[] {
    return [
      QuestionState.CHOOSING,
      QuestionState.SHOWING,
      QuestionState.ANSWERING,
    ];
  }

  /**
   * Check if all questions in the current round are played
   */
  private isAllQuestionsPlayed(game: Game): boolean {
    if (!game.gameState || !game.gameState.currentRound) {
      return false;
    }

    const { played, all } = GameQuestionMapper.getPlayedAndAllQuestions(
      game.gameState
    );

    return all.length > 0 && played.length === all.length;
  }

  /**
   * Get the next round for progression
   */
  private getNextRound(game: Game) {
    if (!ValueUtils.isNumber(game.gameState.currentRound?.order)) {
      return null;
    }

    const nextRound = GameStateMapper.getGameRound(
      game.package,
      game.gameState.currentRound.order + 1
    );

    return nextRound;
  }

  /**
   * Handle progression state when all questions are played
   */
  private getProgressionState(game: Game): RoundProgressionResult {
    return game.getProgressionState();
  }
}
