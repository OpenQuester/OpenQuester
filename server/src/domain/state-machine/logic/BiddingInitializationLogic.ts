import { Game } from "domain/entities/game/Game";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/**
 * Result of bidding phase initialization
 */
export interface BiddingInitializationMutationResult {
  automaticBids: PlayerBidData[];
  allPlayersHaveAutomaticBids: boolean;
}

/**
 * Logic class for initializing the bidding phase.
 *
 * Players with score <= 1 automatically get a bid of 1.
 * If all players have automatic bids, the phase can transition immediately.
 */
export class BiddingInitializationLogic {
  /**
   * Process automatic bids for players with low scores.
   *
   * Pure mutation function that:
   * 1. Finds eligible players (in game, PLAYER role)
   * 2. Places automatic bid of 1 for players with score <= 1
   * 3. Returns bid data and whether all players received automatic bids
   */
  public static processAutomaticBids(
    game: Game
  ): BiddingInitializationMutationResult {
    const automaticBids: PlayerBidData[] = [];

    // Find eligible players
    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    // Place automatic bids for players with low scores
    for (const player of eligiblePlayers) {
      if (player.score <= 1) {
        FinalRoundStateManager.addBid(game, player.meta.id, 1);
        automaticBids.push({
          playerId: player.meta.id,
          bidAmount: 1,
        });
      }
    }

    // Check if all players received automatic bids
    const allPlayersHaveAutomaticBids = eligiblePlayers.every(
      (player) => player.score <= 1
    );

    return {
      automaticBids,
      allPlayersHaveAutomaticBids,
    };
  }
}
