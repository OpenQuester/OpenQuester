import { SYSTEM_PLAYER_ID } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  FinalPhaseCompleteEventData,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { ThemeEliminationTimeoutResult } from "domain/types/socket/finalround/FinalRoundResults";

/**
 * Type of turn player leave scenario
 */
export enum TurnPlayerScenarioType {
  FINAL_ROUND_THEME_ELIMINATION = "final_round_theme_elimination",
  REGULAR_ROUND = "regular_round",
  NOT_APPLICABLE = "not_applicable",
}

/**
 * Validation result for turn player leave
 */
export interface TurnPlayerLeaveValidation {
  isEligible: boolean;
  scenarioType: TurnPlayerScenarioType;
  reason?: string;
}

/**
 * Result of turn player leave operation
 */
export interface TurnPlayerLeaveResult {
  broadcasts: BroadcastEvent[];
  handledByFinalRoundService: boolean;
}

/**
 * Pure business logic for handling current turn player leaving.
 *
 * Handles two scenarios:
 * 1. Final round theme elimination: Auto-eliminate a random theme
 * 2. Regular round: Clear turn (showman must assign new turn player)
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class TurnPlayerLeaveLogic {
  /**
   * Validates and determines which turn player leave scenario applies.
   */
  public static validate(
    game: Game,
    userId: number
  ): TurnPlayerLeaveValidation {
    // Check if user is current turn player
    if (game.gameState.currentTurnPlayerId !== userId) {
      return {
        isEligible: false,
        scenarioType: TurnPlayerScenarioType.NOT_APPLICABLE,
        reason: "User is not current turn player",
      };
    }

    // Check for final round theme elimination scenario
    if (
      TransitionGuards.isFinalRound(game) &&
      TransitionGuards.isQuestionState(game, QuestionState.THEME_ELIMINATION)
    ) {
      return {
        isEligible: true,
        scenarioType: TurnPlayerScenarioType.FINAL_ROUND_THEME_ELIMINATION,
      };
    }

    // Regular round scenario
    return {
      isEligible: true,
      scenarioType: TurnPlayerScenarioType.REGULAR_ROUND,
    };
  }

  /**
   * Process regular round turn player leave.
   *
   * Clears turn - showman must assign a new turn player.
   * No broadcasts needed - showman handles reassignment manually.
   */
  public static processRegularRoundLeave(game: Game): void {
    game.gameState.currentTurnPlayerId = null;
  }

  /**
   * Builds result for final round theme elimination auto-elimination.
   *
   * Uses result from FinalRoundService.handleThemeEliminationTimeout.
   */
  public static buildFinalRoundResult(
    game: Game,
    timeoutResult: ThemeEliminationTimeoutResult
  ): TurnPlayerLeaveResult {
    const broadcasts: BroadcastEvent[] = [
      {
        event: SocketIOGameEvents.THEME_ELIMINATE,
        data: {
          themeId: timeoutResult.themeId,
          eliminatedBy: SYSTEM_PLAYER_ID,
          nextPlayerId: timeoutResult.nextPlayerId,
        } satisfies ThemeEliminateOutputData,
        room: game.id,
      },
    ];

    if (timeoutResult.isPhaseComplete) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        data: {
          phase: FinalRoundPhase.THEME_ELIMINATION,
          nextPhase: FinalRoundPhase.BIDDING,
        } satisfies FinalPhaseCompleteEventData,
        room: game.id,
      });
    }

    return {
      broadcasts,
      handledByFinalRoundService: true,
    };
  }
}
