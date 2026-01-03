import { singleton } from "tsyringe";

import { Game } from "domain/entities/game/Game";
import { ServerResponse } from "domain/enums/ServerResponse";
import { ServerError } from "domain/errors/ServerError";
import { BaseRoundHandler } from "domain/handlers/socket/round/BaseRoundHandler";
import { FinalRoundHandler } from "domain/handlers/socket/round/FinalRoundHandler";
import { SimpleRoundHandler } from "domain/handlers/socket/round/SimpleRoundHandler";
import { PackageRoundType } from "domain/types/package/PackageRoundType";

/**
 * Factory for creating round handlers based on round type.
 */
@singleton()
export class RoundHandlerFactory {
  /**
   * Creates a round handler for the specified round type
   */
  public create(roundType: PackageRoundType): BaseRoundHandler {
    switch (roundType) {
      case PackageRoundType.SIMPLE:
        return new SimpleRoundHandler();
      case PackageRoundType.FINAL:
        return new FinalRoundHandler();
      default:
        throw new ServerError(
          ServerResponse.INVALID_ROUND_HANDLER_INPUT,
          undefined,
          {
            type: roundType,
          }
        );
    }
  }

  /**
   * Creates a round handler based on the game's current round
   */
  public createFromGame(game: Game): BaseRoundHandler {
    const roundType =
      game.gameState.currentRound?.type ?? PackageRoundType.SIMPLE;
    return this.create(roundType);
  }

  /**
   * Gets all supported round types
   */
  public static getSupportedRoundTypes(): PackageRoundType[] {
    return [PackageRoundType.SIMPLE, PackageRoundType.FINAL];
  }
}
