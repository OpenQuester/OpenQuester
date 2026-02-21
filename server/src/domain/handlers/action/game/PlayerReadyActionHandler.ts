import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { type SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { GameStartLogic } from "domain/logic/game/GameStartLogic";
import { PlayerReadinessLogic } from "domain/logic/game/PlayerReadinessLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  EmptyInputData,
  PlayerReadinessBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Stateless action handler for player ready state.
 *
 * Context-aware: receives prefetched game/player from the executor's
 * IN pipeline and returns mutations — only Redis call is PackageStore.getRound()
 * in the auto-start branch.
 */
export class PlayerReadyActionHandler
  implements GameActionHandler<EmptyInputData, PlayerReadinessBroadcastData>
{
  constructor(
    private readonly socketIOGameService: SocketIOGameService,
    private readonly packageStore: PackageStore
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<PlayerReadinessBroadcastData>> {
    const { game, currentPlayer } = ctx;

    // Validate player can set ready state
    if (!currentPlayer || currentPlayer.role !== PlayerRole.PLAYER) {
      throw new ClientError(ClientResponse.ONLY_PLAYERS_CAN_SET_READY);
    }

    GameStateValidator.validateGameNotFinished(game);

    if (ValueUtils.isValidDate(game.startedAt)) {
      throw new ClientError(ClientResponse.GAME_ALREADY_STARTED);
    }

    const playerId = currentPlayer.meta.id;

    // Update ready state in memory
    const readyPlayers = PlayerReadinessLogic.updateReadyState(
      game,
      playerId,
      true
    );

    const shouldAutoStart = PlayerReadinessLogic.shouldAutoStart(game);

    // Build readiness broadcasts
    const readinessResult = PlayerReadinessLogic.buildResult({
      game,
      playerId,
      isReady: true,
      readyPlayers,
      shouldAutoStart,
    });

    const broadcasts: SocketEventBroadcast[] = [...readinessResult.broadcasts];

    // Handle auto-start if all players are ready
    if (shouldAutoStart) {
      const firstRound = await this.packageStore.getRound(game.id, 0);
      const gameState = GameStartLogic.buildInitialGameState(game, firstRound);

      game.startedAt = new Date();
      game.gameState = gameState;

      const startResult = GameStartLogic.buildResult(game);
      broadcasts.push(...startResult.broadcasts);
    }

    const readyData: PlayerReadinessBroadcastData = {
      playerId,
      isReady: true,
      readyPlayers,
      autoStartTriggered: shouldAutoStart,
    };

    return {
      success: true,
      data: readyData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(broadcasts),
      ],
      broadcastGame: game,
    };
  }
}
