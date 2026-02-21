import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameStartLogic } from "domain/logic/game/GameStartLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { ShowmanAction } from "domain/types/game/ShowmanAction";
import {
  EmptyInputData,
  GameStartBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Stateless action handler for starting a game.
 */
export class StartGameActionHandler
  implements GameActionHandler<EmptyInputData, GameStartBroadcastData>
{
  constructor(
    private readonly validationService: SocketGameValidationService,
    private readonly packageStore: PackageStore,
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly logger: ILogger
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameStartBroadcastData>> {
    const { game, currentPlayer } = ctx;

    this.validationService.validateShowmanRole(
      currentPlayer,
      ShowmanAction.START
    );
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
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const result = GameStartLogic.buildResult(game);

    return {
      success: true,
      data: { currentRound: result.data.currentRound! },
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
    };
  }
}
