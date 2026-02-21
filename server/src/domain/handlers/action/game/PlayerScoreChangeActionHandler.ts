import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { PlayerScoreChangeLogic } from "domain/logic/game/PlayerScoreChangeLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  PlayerScoreChangeBroadcastData,
  PlayerScoreChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player score change.
 */
export class PlayerScoreChangeActionHandler
  implements
    GameActionHandler<
      PlayerScoreChangeInputData,
      PlayerScoreChangeBroadcastData
    >
{
  constructor(
    private readonly validationService: SocketGameValidationService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<PlayerScoreChangeInputData>
  ): Promise<ActionHandlerResult<PlayerScoreChangeBroadcastData>> {
    const { game, currentPlayer, action } = ctx;
    const { payload } = action;

    this.validationService.validatePlayerScoreChange(currentPlayer);

    const newScore = PlayerScoreChangeLogic.applyScore(
      game,
      payload.playerId,
      payload.newScore
    );

    const result = PlayerScoreChangeLogic.buildResult({
      game,
      targetPlayerId: payload.playerId,
      newScore,
    });

    const broadcastData: PlayerScoreChangeBroadcastData = {
      playerId: payload.playerId,
      newScore: result.data.newScore,
    };

    return {
      success: true,
      data: broadcastData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
    };
  }
}
