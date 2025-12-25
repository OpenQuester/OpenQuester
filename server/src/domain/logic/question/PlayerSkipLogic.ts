import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { SpecialQuestionUtils } from "domain/utils/QuestionUtils";

export interface GiveUpMutation {
  penalty: number;
  playerAnswerResult: { player: number; score: number };
}

export interface GiveUpResult {
  game: Game;
  playerId: number;
  gaveUp: true;
  answerResult: { player: number; score: number };
  timer: GameStateTimerDTO;
}

export interface RegularSkipResult {
  game: Game;
  playerId: number;
  gaveUp: false;
}

export interface GiveUpBuildResultInput {
  game: Game;
  playerId: number;
  mutation: GiveUpMutation;
  timer: GameStateTimerDTO;
}

export interface RegularSkipBuildResultInput {
  game: Game;
  playerId: number;
}

export interface UnskipBuildResultInput {
  game: Game;
  playerId: number;
}

/**
 * Logic class for handling player skip scenarios in special questions.
 * Handles "give up" with penalty and regular skip operations.
 */
export class PlayerSkipLogic {
  /**
   * Calculate the penalty for giving up on a special question.
   * Delegates to SpecialQuestionUtils for the actual calculation.
   */
  public static calculateGiveUpPenalty(game: Game): number {
    return SpecialQuestionUtils.calculateGiveUpPenalty(game);
  }

  /**
   * Process give up scenario: applies penalty and sets up wrong answer state.
   */
  public static processGiveUp(game: Game, player: Player): GiveUpMutation {
    const penalty = this.calculateGiveUpPenalty(game);

    // Set up game state for wrong answer
    game.gameState.answeringPlayer = player.meta.id;

    // Clear special question data
    this.clearSpecialQuestionData(game);

    // Process the wrong answer
    const playerAnswerResult = game.handleQuestionAnswer(
      penalty,
      AnswerResultType.WRONG,
      QuestionState.SHOWING
    );

    return {
      penalty,
      playerAnswerResult,
    };
  }

  /**
   * Process regular skip: just marks player as skipped.
   */
  public static processRegularSkip(game: Game, player: Player): void {
    game.addSkippedPlayer(player.meta.id);
  }

  /**
   * Process unskip: removes player from skipped list.
   */
  public static processUnskip(game: Game, player: Player): void {
    game.removeSkippedPlayer(player.meta.id);
  }

  /**
   * Clear special question data from game state.
   */
  public static clearSpecialQuestionData(game: Game): void {
    if (game.gameState.secretQuestionData) {
      game.gameState.secretQuestionData = null;
    }
    if (game.gameState.stakeQuestionData) {
      game.gameState.stakeQuestionData = null;
    }
  }

  /**
   * Build result for give up scenario.
   */
  public static buildGiveUpResult(input: GiveUpBuildResultInput): GiveUpResult {
    const { game, playerId, mutation, timer } = input;

    return {
      game,
      playerId,
      gaveUp: true,
      answerResult: mutation.playerAnswerResult,
      timer,
    };
  }

  /**
   * Build result for regular skip scenario.
   */
  public static buildRegularSkipResult(
    input: RegularSkipBuildResultInput
  ): RegularSkipResult {
    const { game, playerId } = input;

    return {
      game,
      playerId,
      gaveUp: false,
    };
  }

  /**
   * Build result for unskip scenario.
   */
  public static buildUnskipResult(input: UnskipBuildResultInput): {
    game: Game;
    playerId: number;
  } {
    const { game, playerId } = input;

    return {
      game,
      playerId,
    };
  }
}
