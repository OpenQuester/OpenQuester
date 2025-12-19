import { Game } from "domain/entities/game/Game";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { AnswerData } from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/**
 * Data for a single auto-loss entry
 */
export interface AutoLossEntry {
  answerData: AnswerData;
  scoreChange: number;
}

/**
 * Result of auto-loss processing
 */
export interface AutoLossProcessMutationResult {
  autoLossEntries: AutoLossEntry[];
  isPhaseComplete: boolean;
}

/**
 * Logic class for processing auto-loss answers when answering timer expires.
 *
 * Finds players who haven't submitted answers and creates auto-loss entries
 * (empty answers marked incorrect with score penalty).
 */
export class AutoLossProcessLogic {
  /**
   * Process auto-loss for players who haven't submitted answers.
   *
   * Pure mutation function that:
   * 1. Finds eligible players (in game, with bids > 0, haven't submitted)
   * 2. Adds empty answer (auto-marked as autoLoss)
   * 3. Immediately reviews as incorrect (applies score penalty)
   * 4. Returns entries and phase completion status
   */
  public static processAutoLoss(game: Game): AutoLossProcessMutationResult {
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (
      !finalRoundData ||
      game.gameState.questionState !== QuestionState.ANSWERING
    ) {
      return {
        autoLossEntries: [],
        isPhaseComplete: false,
      };
    }

    const autoLossEntries: AutoLossEntry[] = [];

    // Find players who haven't submitted answers
    // Only process players with non-zero bids (bid=0 means they don't participate)
    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME &&
        (finalRoundData.bids[p.meta.id] || 0) > 0
    );

    for (const player of eligiblePlayers) {
      const hasSubmitted = finalRoundData.answers.some(
        (answer) => answer.playerId === player.meta.id
      );

      if (!hasSubmitted) {
        // Add empty answer as auto-loss (automatically marked by StateManager)
        const answer = FinalRoundStateManager.addAnswer(
          game,
          player.meta.id,
          ""
        );

        // Create answer data (answer.autoLoss is true for empty answers)
        const answerData: AnswerData = {
          id: answer.id,
          playerId: answer.playerId,
          answer: answer.answer,
          autoLoss: answer.autoLoss,
        };

        // Immediately mark as incorrect and update score
        const { scoreChange } = FinalRoundStateManager.reviewAnswer(
          game,
          answer.id,
          false
        );

        autoLossEntries.push({
          answerData,
          scoreChange,
        });
      }
    }

    // Check if ready for review phase
    const isPhaseComplete = FinalRoundStateManager.areAllAnswersSubmitted(game);

    return {
      autoLossEntries,
      isPhaseComplete,
    };
  }
}
