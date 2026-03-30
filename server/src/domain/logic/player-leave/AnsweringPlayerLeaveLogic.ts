import { Game } from "domain/entities/game/Game";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { AutoLossProcessLogic } from "domain/state-machine/logic/AutoLossProcessLogic";
import { type TransitionResult } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  FinalAnswerSubmitOutputData,
  SocketIOFinalAutoLossEventPayload,
} from "domain/types/socket/events/FinalRoundEventData";

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
interface AnsweringPlayerLeaveValidation {
  isEligible: boolean;
  scenarioType: AnsweringScenarioType;
  reason?: string;
}

/**
 * Result of answering player leave operation
 */
export interface AnsweringPlayerLeaveFinalResult {
  broadcasts: BroadcastEvent[];
}

export interface AnsweringPlayerLeaveFinalResultInput {
  game: Game;
  userId: number;
  wasProcessed: boolean;
  transitionResult: TransitionResult | null;
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
   * Builds result for final round answering player leave.
   */
  public static buildFinalRoundResult(
    input: AnsweringPlayerLeaveFinalResultInput
  ): AnsweringPlayerLeaveFinalResult {
    const { game, userId, wasProcessed, transitionResult } = input;
    const broadcasts: BroadcastEvent[] = [];

    if (!wasProcessed) {
      return { broadcasts };
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

    return { broadcasts };
  }
}
