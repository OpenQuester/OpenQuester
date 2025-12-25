import { Game } from "domain/entities/game/Game";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";

export interface AnswerResultMutation {
  playerAnswerResult: GameStateAnsweredPlayerData;
  nextState: QuestionState;
  question: PackageQuestionDTO | null;
  allPlayersSkipped: boolean;
  skippedQuestion: PackageQuestionDTO | null;
}

export interface AnswerResultResult {
  playerAnswerResult: GameStateAnsweredPlayerData;
  game: Game;
  question: PackageQuestionDTO | null;
  timer: GameStateTimerDTO | null;
  allPlayersSkipped: boolean;
  skippedQuestion: PackageQuestionDTO | null;
}

export interface AnswerResultBuildResultInput {
  game: Game;
  mutation: AnswerResultMutation;
  timer: GameStateTimerDTO | null;
}

/**
 * Logic class for handling question answer result processing.
 * Extracts business logic from SocketIOQuestionService.handleAnswerResult.
 */
export class AnswerResultLogic {
  /**
   * Determine the next question state based on answer correctness.
   */
  public static determineNextState(isCorrect: boolean): QuestionState {
    return isCorrect ? QuestionState.CHOOSING : QuestionState.SHOWING;
  }

  /**
   * Process the answer result mutation on game state.
   * Returns mutation result with extracted question data.
   */
  public static processAnswer(
    game: Game,
    data: AnswerResultData
  ): AnswerResultMutation {
    const isCorrect = data.answerType === AnswerResultType.CORRECT;
    const nextState = this.determineNextState(isCorrect);

    const playerAnswerResult = game.handleQuestionAnswer(
      data.scoreResult,
      data.answerType,
      nextState
    );

    let question: PackageQuestionDTO | null = null;
    let allPlayersSkipped = false;
    let skippedQuestion: PackageQuestionDTO | null = null;

    const correctAnswerSimpleRound =
      isCorrect &&
      game.gameState.currentRound?.type === PackageRoundType.SIMPLE;

    if (correctAnswerSimpleRound) {
      // Update current turn player ID to the one who answered correctly
      game.gameState.currentTurnPlayerId = playerAnswerResult.player;
    }

    // Process correct answer - get question and mark as played
    if (isCorrect) {
      const currentQuestion = game.gameState.currentQuestion;
      if (currentQuestion) {
        const questionData = GameQuestionMapper.getQuestionAndTheme(
          game.package,
          game.gameState.currentRound!.id,
          currentQuestion.id!
        );

        if (questionData) {
          question = questionData.question;
          GameQuestionMapper.setQuestionPlayed(
            game,
            question.id!,
            questionData.theme.id!
          );
        }
      }

      game.gameState.currentQuestion = null;
    } else if (game.areAllPlayersExhausted()) {
      // Wrong answer and all players exhausted
      allPlayersSkipped = true;
      const currentQuestion = game.gameState.currentQuestion;
      if (currentQuestion) {
        const questionData = GameQuestionMapper.getQuestionAndTheme(
          game.package,
          game.gameState.currentRound!.id,
          currentQuestion.id!
        );
        if (questionData) {
          skippedQuestion = questionData.question;
        }
      }
    }

    return {
      playerAnswerResult,
      nextState,
      question,
      allPlayersSkipped,
      skippedQuestion,
    };
  }

  /**
   * Build the final result object for answer processing.
   */
  public static buildResult(
    input: AnswerResultBuildResultInput
  ): AnswerResultResult {
    const { game, mutation, timer } = input;

    return {
      playerAnswerResult: mutation.playerAnswerResult,
      game,
      question: mutation.question,
      timer,
      allPlayersSkipped: mutation.allPlayersSkipped,
      skippedQuestion: mutation.skippedQuestion,
    };
  }
}
