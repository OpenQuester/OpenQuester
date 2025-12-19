import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { TransitionResult } from "domain/state-machine/types";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { FinalBidSubmitResult } from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundValidator } from "domain/validators/FinalRoundValidator";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Pure business logic for final round bid submission.
 *
 * This class encapsulates all validation and state mutation logic,
 * keeping the service layer thin and focused on orchestration.
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class FinalBidSubmitLogic {
  /**
   * Validates all preconditions for bid submission.
   *
   * @throws ClientError if validation fails
   */
  public static validate(
    game: Game,
    player: Player | null
  ): asserts player is Player {
    GameStateValidator.validateGameInProgress(game);

    if (!player) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    FinalRoundValidator.validateFinalRoundPlayer(player);
    FinalRoundValidator.validateBiddingPhase(game);
  }

  /**
   * Adds a bid for the player, normalizing it to valid range.
   *
   * @returns The normalized bid amount
   */
  public static addBid(game: Game, playerId: number, bid: number): number {
    const normalizedBid = FinalRoundStateManager.validateAndNormalizeBid(
      game,
      playerId,
      bid
    );

    FinalRoundStateManager.addBid(game, playerId, normalizedBid);

    return normalizedBid;
  }

  /**
   * Builds the result object from transition outcome.
   *
   * Extracts timer from transition data if phase completed.
   */
  public static buildResult(
    game: Game,
    playerId: number,
    bidAmount: number,
    transitionResult: TransitionResult | null
  ): FinalBidSubmitResult {
    let timer: GameStateTimerDTO | undefined;

    if (transitionResult?.success && transitionResult.data?.timer) {
      timer = transitionResult.data.timer as GameStateTimerDTO;
    }

    return {
      game,
      playerId,
      bidAmount,
      isPhaseComplete: transitionResult?.success ?? false,
      transitionResult,
      timer,
    };
  }
}
