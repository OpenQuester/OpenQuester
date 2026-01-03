import { Game } from "domain/entities/game/Game";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionAnswerResultLogic } from "domain/logic/question/QuestionAnswerResultLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { AutoLossProcessLogic } from "domain/state-machine/logic/AutoLossProcessLogic";
import { TransitionResult } from "domain/state-machine/types";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  FinalAnswerSubmitOutputData,
  SocketIOFinalAutoLossEventPayload,
} from "domain/types/socket/events/FinalRoundEventData";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";

/**
 * Type of answering scenario
 */
export enum AnsweringScenarioType {
  FINAL_ROUND = "final_round",
  REGULAR_ROUND = "regular_round",
  NOT_APPLICABLE = "not_applicable",
}

/**
 * Validation result for answering player leave
 */
export interface AnsweringPlayerLeaveValidation {
  isEligible: boolean;
  scenarioType: AnsweringScenarioType;
  reason?: string;
}

/**
 * Result of processing regular round answering player leave
 */
export interface RegularAnsweringMutationResult {
  nextState: QuestionState;
  isSpecialQuestion: boolean;
  questionId?: number;
}

/**
 * Result of answering player leave operation
 */
export interface AnsweringPlayerLeaveFinalResult {
  broadcasts: BroadcastEvent[];
  requiresTimerSetup: boolean;
  nextState?: QuestionState;
  isSpecialQuestion?: boolean;
  questionId?: number;
}

export interface AnsweringPlayerLeaveRegularResult {
  broadcasts: BroadcastEvent[];
  requiresTimerSetup: boolean;
  nextState?: QuestionState;
  isSpecialQuestion?: boolean;
  questionId?: number;
}

export interface AnsweringPlayerLeaveRegularProcessInput {
  game: Game;
  mutationResult: RegularAnsweringMutationResult;
  timer: GameStateTimerDTO | null;
}

export interface AnsweringPlayerLeaveFinalProcessInput {
  game: Game;
  userId: number;
  wasProcessed: boolean;
  transitionResult: TransitionResult | null;
}

export interface AnsweringPlayerLeaveFinalResultInput {
  game: Game;
  userId: number;
  wasProcessed: boolean;
  transitionResult: TransitionResult | null;
}

export interface AnsweringPlayerLeaveRegularResultInput {
  game: Game;
  mutationResult: RegularAnsweringMutationResult;
  timer: GameStateTimerDTO | null;
}

/**
 * Pure business logic for handling player leaving during answering phase.
 *
 * Handles two scenarios:
 * 1. Final round: Multiple players answer simultaneously - auto-loss for leaving player
 * 2. Regular round: Single answering player - auto-skip with 0 points
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class AnsweringPlayerLeaveLogic {
  /**
   * Validates and determines which answering scenario applies.
   */
  public static validate(
    game: Game,
    userId: number
  ): AnsweringPlayerLeaveValidation {
    // Check for final round answering scenario
    if (
      TransitionGuards.isFinalRound(game) &&
      TransitionGuards.isQuestionState(game, QuestionState.ANSWERING)
    ) {
      return {
        isEligible: true,
        scenarioType: AnsweringScenarioType.FINAL_ROUND,
      };
    }

    // Check for regular round answering scenario
    if (game.gameState.answeringPlayer === userId) {
      return {
        isEligible: true,
        scenarioType: AnsweringScenarioType.REGULAR_ROUND,
      };
    }

    return {
      isEligible: false,
      scenarioType: AnsweringScenarioType.NOT_APPLICABLE,
      reason: "Player not in answering state",
    };
  }

  /**
   * Process auto-loss for final round answering player leave.
   *
   * Delegates to AutoLossProcessLogic for consistent auto-loss handling.
   */
  public static processFinalRoundAutoLoss(game: Game, userId: number): boolean {
    const autoLossEntry = AutoLossProcessLogic.processPlayerAutoLoss(
      game,
      userId
    );
    return autoLossEntry !== null;
  }

  /**
   * Process auto-skip for regular round answering player leave.
   *
   * For special questions (secret/stake), go directly to CHOOSING.
   * For normal questions, go to SHOWING to display correct answer.
   */
  public static processRegularRoundAutoSkip(
    game: Game
  ): RegularAnsweringMutationResult {
    const currentQuestion = game.gameState.currentQuestion;
    const isSpecialQuestion =
      currentQuestion &&
      (currentQuestion.type === PackageQuestionType.SECRET ||
        currentQuestion.type === PackageQuestionType.STAKE);

    const nextState = isSpecialQuestion
      ? QuestionState.CHOOSING
      : QuestionState.SHOWING;

    // Auto-skip answer with 0 points
    game.handleQuestionAnswer(0, AnswerResultType.SKIP, nextState);

    // Get question ID for special questions (to mark as played)
    let questionId: number | undefined;
    if (isSpecialQuestion) {
      questionId =
        game.gameState.secretQuestionData?.questionId ||
        game.gameState.stakeQuestionData?.questionId;
    }

    return {
      nextState,
      isSpecialQuestion: isSpecialQuestion ?? false,
      questionId,
    };
  }

  /**
   * Handle special question cleanup after auto-skip.
   *
   * Marks question as played and clears special question data.
   */
  public static handleSpecialQuestionCleanup(
    game: Game,
    questionId: number
  ): void {
    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
      questionId
    );

    if (questionData) {
      GameQuestionMapper.setQuestionPlayed(
        game,
        questionId,
        questionData.theme.id!
      );
    }

    // Clear special question data and current question
    game.gameState.secretQuestionData = null;
    game.gameState.stakeQuestionData = null;
    game.gameState.currentQuestion = null;
  }

  /**
   * Builds result for final round answering player leave.
   */
  public static buildFinalRoundResult(
    input: AnsweringPlayerLeaveFinalResultInput
  ): AnsweringPlayerLeaveFinalResult {
    const { game, userId, wasProcessed, transitionResult } = input;
    const broadcasts: BroadcastEvent[] = [];

    if (!wasProcessed) {
      return { broadcasts, requiresTimerSetup: false };
    }

    // Signal submission
    broadcasts.push({
      event: SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
      data: {
        playerId: userId,
      } satisfies FinalAnswerSubmitOutputData,
      room: game.id,
    });

    // Signal auto-loss reason
    broadcasts.push({
      event: SocketIOGameEvents.FINAL_AUTO_LOSS,
      data: {
        playerId: userId,
        reason: FinalAnswerLossReason.EMPTY_ANSWER,
      } satisfies SocketIOFinalAutoLossEventPayload,
      room: game.id,
    });

    // Add transition broadcasts
    if (transitionResult) {
      broadcasts.push(...transitionResult.broadcasts);
    }

    return { broadcasts, requiresTimerSetup: false };
  }

  /**
   * Builds result for regular round answering player leave.
   */
  public static buildRegularRoundResult(
    input: AnsweringPlayerLeaveRegularResultInput
  ): AnsweringPlayerLeaveRegularResult {
    const { game, mutationResult, timer } = input;
    const broadcasts: BroadcastEvent[] = [];

    // Get answer result from game state (populated by handleQuestionAnswer)
    // Use the most recent answered player entry
    const answeredPlayers = game.gameState.answeredPlayers || [];
    const answerResult = answeredPlayers[answeredPlayers.length - 1];

    broadcasts.push({
      event: SocketIOGameEvents.ANSWER_RESULT,
      data: QuestionAnswerResultLogic.buildSocketPayload({
        answerResult,
        timer,
      }),
      room: game.id,
    });

    return {
      broadcasts,
      requiresTimerSetup: !mutationResult.isSpecialQuestion,
      nextState: mutationResult.nextState,
      isSpecialQuestion: mutationResult.isSpecialQuestion,
      questionId: mutationResult.questionId,
    };
  }
}
