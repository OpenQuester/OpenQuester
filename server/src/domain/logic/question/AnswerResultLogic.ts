import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { AnswerShowStartEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishWithAnswerEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";
import { QuestionAnswerResultLogic } from "./QuestionAnswerResultLogic";

export interface AnswerResultMutation {
  playerAnswerResult: GameStateAnsweredPlayerData;
  nextState: QuestionState;
  question: PackageQuestionDTO | null;
  allPlayersSkipped: boolean;
  skippedQuestion: PackageQuestionDTO | null;
}

export interface AnswerResultResult {
  data: QuestionAnswerResultEventPayload;
  broadcasts: SocketEventBroadcast[];
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
   * For correct answers or all players exhausted, transitions to SHOWING_ANSWER
   * to display the answer before moving to CHOOSING.
   */
  public static determineNextState(isCorrect: boolean): QuestionState {
    return isCorrect ? QuestionState.SHOWING_ANSWER : QuestionState.SHOWING;
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

    const shouldShowAnswer =
      mutation.playerAnswerResult.answerType === AnswerResultType.CORRECT ||
      mutation.allPlayersSkipped;

    const questionData = mutation.allPlayersSkipped
      ? mutation.skippedQuestion
      : mutation.question;

    const broadcasts = shouldShowAnswer
      ? this.buildShowAnswerBroadcasts(
          game.id,
          mutation.playerAnswerResult,
          questionData,
          timer,
          game.gameState.currentTurnPlayerId ?? null
        )
      : this.buildContinueQuestionBroadcasts(
          game.id,
          mutation.playerAnswerResult,
          timer
        );

    const responseData = QuestionAnswerResultLogic.buildSocketPayload({
      answerResult: mutation.playerAnswerResult,
      timer,
    });

    return {
      data: responseData,
      broadcasts,
      playerAnswerResult: mutation.playerAnswerResult,
      game,
      question: mutation.question,
      timer,
      allPlayersSkipped: mutation.allPlayersSkipped,
      skippedQuestion: mutation.skippedQuestion,
    };
  }

  /**
   * Build broadcasts for transitioning to SHOWING_ANSWER state.
   * Sends ANSWER_RESULT → QUESTION_FINISH → ANSWER_SHOW_START.
   */
  private static buildShowAnswerBroadcasts(
    gameId: string,
    playerAnswerResult: GameStateAnsweredPlayerData,
    questionData: PackageQuestionDTO | null,
    timer: GameStateTimerDTO | null,
    nextTurnPlayerId: number | null
  ): SocketEventBroadcast[] {
    const answerResultPayload = QuestionAnswerResultLogic.buildSocketPayload({
      answerResult: playerAnswerResult,
      timer,
    });

    const questionFinishPayload: QuestionFinishWithAnswerEventPayload = {
      answerFiles: questionData?.answerFiles ?? null,
      answerText: questionData?.answerText ?? null,
      nextTurnPlayerId,
      answerResult: playerAnswerResult,
    };

    return [
      {
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: answerResultPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      } satisfies SocketEventBroadcast<QuestionAnswerResultEventPayload>,
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: questionFinishPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      } satisfies SocketEventBroadcast<QuestionFinishWithAnswerEventPayload>,
      {
        event: SocketIOGameEvents.ANSWER_SHOW_START,
        data: {} satisfies AnswerShowStartEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      } satisfies SocketEventBroadcast<AnswerShowStartEventPayload>,
    ];
  }

  /**
   * Build broadcasts for continuing the question (wrong answer, players remaining).
   */
  private static buildContinueQuestionBroadcasts(
    gameId: string,
    playerAnswerResult: GameStateAnsweredPlayerData,
    timer: GameStateTimerDTO | null
  ): SocketEventBroadcast[] {
    const resultPayload = QuestionAnswerResultLogic.buildSocketPayload({
      answerResult: playerAnswerResult,
      timer,
    });

    return [
      {
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: resultPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      } satisfies SocketEventBroadcast<QuestionAnswerResultEventPayload>,
    ];
  }
}
