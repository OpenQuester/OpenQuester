import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
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
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Stateless action handler for player unready state.
 *
 * Context-aware: receives prefetched game/player from the executor's
 * IN pipeline and returns mutations — no Redis calls.
 */
export class PlayerUnreadyActionHandler
  implements GameActionHandler<EmptyInputData, PlayerReadinessBroadcastData>
{
  constructor(private readonly socketIOGameService: SocketIOGameService) {}

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

    // Update ready state in memory (unready)
    const readyPlayers = PlayerReadinessLogic.updateReadyState(
      game,
      playerId,
      false
    );

    const readinessResult = PlayerReadinessLogic.buildResult({
      game,
      playerId,
      isReady: false,
      readyPlayers,
      shouldAutoStart: false,
    });

    const readyData: PlayerReadinessBroadcastData = {
      playerId,
      isReady: false,
      readyPlayers,
      autoStartTriggered: false,
    };

    return {
      success: true,
      data: readyData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          readinessResult.broadcasts
        ),
      ],
      broadcastGame: game,
    };
  }
}
