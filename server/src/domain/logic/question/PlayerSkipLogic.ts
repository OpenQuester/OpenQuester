import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import {
  QuestionSkipBroadcastData,
  QuestionUnskipBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { SpecialRegularQuestionUtils } from "domain/utils/QuestionUtils";

export interface GiveUpMutation {
  penalty: number;
  playerAnswerResult: GameStateAnsweredPlayerData;
}

export interface GiveUpResult {
  data: QuestionSkipBroadcastData;
  broadcasts: SocketEventBroadcast[];
  game: Game;
  playerId: number;
  gaveUp: true;
  answerResult: GameStateAnsweredPlayerData;
  timer: GameStateTimerDTO;
}

export interface RegularSkipResult {
  data: QuestionSkipBroadcastData;
  broadcasts: SocketEventBroadcast[];
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

export interface UnskipResult {
  data: QuestionUnskipBroadcastData;
  broadcasts: SocketEventBroadcast[];
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
    return SpecialRegularQuestionUtils.calculateGiveUpPenalty(game);
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
   * Includes ANSWER_RESULT broadcast for the penalty.
   */
  public static buildGiveUpResult(input: GiveUpBuildResultInput): GiveUpResult {
    const { game, playerId, mutation, timer } = input;

    const data: QuestionSkipBroadcastData = { playerId };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: {
          answerResult: mutation.playerAnswerResult,
          timer,
        },
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<QuestionAnswerResultEventPayload>,
    ];

    return {
      data,
      broadcasts,
      game,
      playerId,
      gaveUp: true,
      answerResult: mutation.playerAnswerResult,
      timer,
    };
  }

  /**
   * Build result for regular skip scenario.
   * Includes QUESTION_SKIP broadcast.
   */
  public static buildRegularSkipResult(
    input: RegularSkipBuildResultInput
  ): RegularSkipResult {
    const { game, playerId } = input;

    const data: QuestionSkipBroadcastData = { playerId };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.QUESTION_SKIP,
        data,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<QuestionSkipBroadcastData>,
    ];

    return {
      data,
      broadcasts,
      game,
      playerId,
      gaveUp: false,
    };
  }

  /**
   * Build result for unskip scenario.
   * Includes QUESTION_UNSKIP broadcast.
   */
  public static buildUnskipResult(input: UnskipBuildResultInput): UnskipResult {
    const { game, playerId } = input;

    const data: QuestionUnskipBroadcastData = { playerId };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.QUESTION_UNSKIP,
        data,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<QuestionUnskipBroadcastData>,
    ];

    return {
      data,
      broadcasts,
      game,
      playerId,
    };
  }
}
