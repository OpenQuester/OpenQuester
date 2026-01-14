import {
  FINAL_ROUND_MIN_BID,
  MAX_SCORE_DELTA,
  SCORE_ABS_LIMIT,
} from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  BidConstraints,
  FinalRoundAnswer,
  FinalRoundGameData,
  FinalRoundQuestionData,
} from "domain/types/finalround/FinalRoundInterfaces";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Manages final round state transitions and data persistence
 */
export class FinalRoundStateManager {
  /**
   * Initialize final round data structure in game state
   */
  public static initializeFinalRoundData(game: Game): FinalRoundGameData {
    const finalRoundData: FinalRoundGameData = {
      phase: FinalRoundPhase.THEME_ELIMINATION,
      turnOrder: [],
      bids: {},
      answers: [],
      eliminatedThemes: [],
    };

    game.gameState.finalRoundData = finalRoundData;
    return finalRoundData;
  }

  /**
   * Get final round data from game state
   */
  public static getFinalRoundData(game: Game): FinalRoundGameData | null {
    if (!game.gameState.finalRoundData) {
      return null;
    }

    try {
      return game.gameState.finalRoundData;
    } catch {
      return null;
    }
  }

  /**
   * Update final round data in game state
   */
  public static updateFinalRoundData(
    game: Game,
    data: FinalRoundGameData
  ): void {
    game.gameState.finalRoundData = data;
  }

  /**
   * Transition to next phase of final round
   */
  public static transitionToPhase(game: Game, phase: FinalRoundPhase): void {
    const data =
      this.getFinalRoundData(game) || this.initializeFinalRoundData(game);
    data.phase = phase;

    // Update question state to match phase
    switch (phase) {
      case FinalRoundPhase.THEME_ELIMINATION:
        game.setQuestionState(QuestionState.THEME_ELIMINATION);
        break;
      case FinalRoundPhase.BIDDING:
        game.setQuestionState(QuestionState.BIDDING);
        break;
      case FinalRoundPhase.ANSWERING:
        game.setQuestionState(QuestionState.ANSWERING);
        break;
      case FinalRoundPhase.REVIEWING:
        game.setQuestionState(QuestionState.REVIEWING);
        break;
    }

    this.updateFinalRoundData(game, data);
  }

  /**
   * Add player bid to final round data
   */
  public static addBid(game: Game, playerId: number, bidAmount: number): void {
    const data = this.getFinalRoundData(game);
    if (!data) {
      throw new ServerError("Final round data not initialized");
    }

    data.bids[playerId] = bidAmount;
    this.updateFinalRoundData(game, data);
  }

  /**
   * Set question data for the final round.
   * This is called when transitioning from bidding to answering phase.
   * The data is stored so that players joining during answering/reviewing can access it.
   */
  public static setQuestionData(
    game: Game,
    questionData: FinalRoundQuestionData
  ): void {
    const data = this.getFinalRoundData(game);
    if (!data) {
      throw new ServerError("Final round data not initialized");
    }

    data.questionData = questionData;
    this.updateFinalRoundData(game, data);
  }

  /**
   * Get question data from final round data
   */
  public static getQuestionData(
    game: Game
  ): FinalRoundQuestionData | undefined {
    const data = this.getFinalRoundData(game);
    return data?.questionData;
  }

  /**
   * Check if all eligible players have submitted bids
   */
  public static areAllBidsSubmitted(game: Game): boolean {
    const data = this.getFinalRoundData(game);
    if (!data) {
      return false;
    }

    const eligiblePlayerIds = game.players
      .filter(
        (p) =>
          p.role === PlayerRole.PLAYER &&
          p.gameStatus === PlayerGameStatus.IN_GAME
      )
      .map((p) => p.meta.id);

    return eligiblePlayerIds.every((id) => data.bids[id] !== undefined);
  }

  /**
   * Add player answer to final round data
   */
  public static addAnswer(
    game: Game,
    playerId: number,
    answerText: string,
    isAutoLoss: boolean
  ): FinalRoundAnswer {
    const data = this.getFinalRoundData(game);
    if (!data) {
      throw new ServerError("Final round data not initialized");
    }

    const answer: FinalRoundAnswer = {
      id: ValueUtils.generateUUID(),
      playerId,
      answer: answerText,
      submittedAt: new Date(),
      autoLoss: isAutoLoss,
      // Auto-loss answers are automatically marked as incorrect (no showman review needed)
      isCorrect: isAutoLoss ? false : undefined,
    };

    data.answers.push(answer);
    this.updateFinalRoundData(game, data);
    return answer;
  }

  /**
   * Check if all eligible players have submitted answers
   */
  public static areAllAnswersSubmitted(game: Game): boolean {
    const data = this.getFinalRoundData(game);
    if (!data) {
      return false;
    }

    // Players with zero bids are excluded from answering requirement.
    const eligiblePlayerIds = game.players
      .filter(
        (p) =>
          p.role === PlayerRole.PLAYER &&
          p.gameStatus === PlayerGameStatus.IN_GAME
      )
      .map((p) => p.meta.id)
      .filter((id) => (data.bids[id] ?? 0) > 0);

    return eligiblePlayerIds.every((id) =>
      data.answers.some((answer) => answer.playerId === id)
    );
  }

  /**
   * Review an answer and update scores
   */
  public static reviewAnswer(
    game: Game,
    answerId: string,
    isCorrect: boolean
  ): { answer: FinalRoundAnswer; scoreChange: number } {
    const data = this.getFinalRoundData(game);
    if (!data) {
      throw new ClientError(ClientResponse.FINAL_ROUND_NOT_INITIALIZED);
    }

    const answer = data.answers.find((a) => a.id === answerId);
    if (!answer) {
      throw new ClientError(ClientResponse.ANSWER_NOT_FOUND);
    }

    answer.isCorrect = isCorrect;
    answer.reviewedAt = new Date();

    // Calculate score change based on bid and correctness
    const bidAmount = data.bids[answer.playerId] || FINAL_ROUND_MIN_BID;
    const rawChange = isCorrect ? bidAmount : -bidAmount;
    const scoreChange = ValueUtils.clampAbs(rawChange, MAX_SCORE_DELTA);

    // Update player score with saturation to absolute score limit (soft cap)
    const player = game.players.find((p) => p.meta.id === answer.playerId);
    if (player) {
      const tentative = player.score + scoreChange;
      player.score = ValueUtils.clampAbs(tentative, SCORE_ABS_LIMIT);
    }

    this.updateFinalRoundData(game, data);
    return { answer, scoreChange };
  }

  /**
   * Check if all answers have been reviewed
   */
  public static areAllAnswersReviewed(game: Game): boolean {
    const data = this.getFinalRoundData(game);
    if (!data) {
      return false;
    }

    return data.answers.every((answer) => answer.isCorrect !== undefined);
  }

  /**
   * Get bid constraints for a player
   */
  public static getBidConstraints(
    game: Game,
    playerId: number
  ): BidConstraints {
    const player = game.players.find((p) => p.meta.id === playerId);
    if (!player) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    const playerScore = player.score;
    const maxBid = Math.max(playerScore, FINAL_ROUND_MIN_BID);

    return {
      minBid: FINAL_ROUND_MIN_BID,
      maxBid: maxBid,
      playerScore: playerScore,
    };
  }

  /**
   * Validate and normalize bid amount
   */
  public static validateAndNormalizeBid(
    game: Game,
    playerId: number,
    bidAmount: number
  ): number {
    const constraints = this.getBidConstraints(game, playerId);

    if (bidAmount <= 0 || constraints.playerScore <= 0) {
      return FINAL_ROUND_MIN_BID;
    }

    return Math.min(
      Math.max(bidAmount, constraints.minBid),
      constraints.maxBid
    );
  }
}
