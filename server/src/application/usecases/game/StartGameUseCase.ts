import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameStartLogic } from "domain/logic/game/GameStartLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  type EmptyInputData,
  type GameStartBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameValidator } from "domain/validators/GameValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { ValueUtils } from "domain/utils/ValueUtils";

/**
 * Handles starting a game.
 *
 * Validates showman role, builds initial game state from the first round,
 * and starts statistics collection.
 */
export class StartGameUseCase implements GameActionHandler<EmptyInputData, GameStartBroadcastData> {
  constructor(
    private readonly packageStore: PackageStore,
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly logger: ILogger
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameStartBroadcastData>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer } = ctx;

    if (currentPlayer.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_START);
    }

    GameStateValidator.validateGameNotFinished(game);

    if (ValueUtils.isValidDate(game.startedAt)) {
      throw new ClientError(ClientResponse.GAME_ALREADY_STARTED);
    }

    const firstRound = await this.packageStore.getRound(game.id, 0);
    const gameState = GameStartLogic.buildInitialGameState(game, firstRound);

    game.startedAt = new Date();
    game.gameState = gameState;

    try {
      await this.gameStatisticsCollectorService.startCollection(
        game.id,
        game.startedAt,
        game.createdBy,
        game
      );
    } catch (error) {
      this.logger.warn("Failed to start statistics collection", {
        prefix: LogPrefix.STATS,
        gameId: game.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const result = GameStartLogic.buildResult(game);

    return {
      success: true,
      data: { currentRound: result.data.currentRound! },
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(result.broadcasts)
      ]
    };
  }
}
