import { RoundProgressionService } from "application/services/game/RoundProgressionService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { type GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { type EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameValidator } from "domain/validators/GameValidator";

/**
 * Handles advancing to the next round.
 *
 * Flow:
 * 1. Validate showman role and game-in-progress state
 * 2. Delegate the round progression to RoundProgressionService
 */
export class NextRoundUseCase implements GameActionHandler<
  EmptyInputData,
  GameNextRoundEventPayload
> {
  constructor(private readonly roundProgressionService: RoundProgressionService) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameNextRoundEventPayload>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer } = ctx;

    if (currentPlayer.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_NEXT_ROUND);
    }

    GameStateValidator.validateGameInProgress(game);

    return this.roundProgressionService.advanceRound(game);
  }
}
